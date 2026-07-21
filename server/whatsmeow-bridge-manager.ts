import { spawn, ChildProcess } from "child_process";
import path from "path";
import fs from "fs";
import * as net from "net";

let bridgeProcess: ChildProcess | null = null;
let bridgeUrl = "";
let bridgePort = 0;
let isShuttingDown = false;

function getBridgeDir() {
  return path.join(process.cwd(), "whatsmeow-bridge");
}

function getDataDir() {
  return path.join(process.cwd(), "data", "whatsmeow");
}

function binaryName() {
  return process.platform === "win32" ? "whatsmeow-bridge.exe" : "whatsmeow-bridge";
}

function binaryPath() {
  return path.join(getBridgeDir(), binaryName());
}

async function findAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const port = (server.address() as net.AddressInfo).port;
      server.close(() => resolve(port));
    });
    server.on("error", reject);
  });
}

async function buildBridge(): Promise<void> {
  const bridgeDir = getBridgeDir();
  const out = binaryPath();

  const alreadyBuilt = fs.existsSync(out);
  if (alreadyBuilt) {
    console.log(`Whatsmeow bridge binary found at ${out}`);
    return;
  }

  console.log("Building whatsmeow bridge (Go)...");
  return new Promise((resolve, reject) => {
    const proc = spawn("go", ["build", "-trimpath", "-ldflags=-s -w", "-o", out, "."], {
      cwd: bridgeDir,
      stdio: ["ignore", "inherit", "inherit"],
    });
    proc.on("close", (code) => {
      if (code === 0) {
        console.log("Whatsmeow bridge built successfully.");
        resolve();
      } else {
        reject(new Error(`Go build failed with exit code ${code}`));
      }
    });
    proc.on("error", reject);
  });
}

export async function startBridge(): Promise<string> {
  if (process.env.WHATSMEOW_EXTERNAL_URL) {
    bridgeUrl = process.env.WHATSMEOW_EXTERNAL_URL;
    console.log(`[WhatsMeow Manager] Usando bridge externa conteinerizada em: ${bridgeUrl}`);
    return bridgeUrl;
  }

  if (bridgeUrl) return bridgeUrl;

  const port = await findAvailablePort();
  const dataDir = getDataDir();
  fs.mkdirSync(dataDir, { recursive: true });

  const appUrl = process.env.APP_URL || `http://127.0.0.1:${process.env.PORT || 5173}`;
  const webhookUrl = `${appUrl.replace(/\/+$/, "")}/api/whatsapp/webhook`;
  const webhookSecret = process.env.WHATSMEOW_WEBHOOK_SECRET || "bridge-local";

  await buildBridge();

  const env: Record<string, string> = {
    PORT: String(port),
    WHATSMEOW_DATA_DIR: dataDir,
    APP_WEBHOOK_URL: webhookUrl,
    WHATSMEOW_WEBHOOK_SECRET: webhookSecret,
    WHATSMEOW_API_TOKEN: process.env.WHATSMEOW_API_TOKEN || "",
  };

  return new Promise((resolve, reject) => {
    const proc = spawn(binaryPath(), [], {
      cwd: getBridgeDir(),
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let started = false;
    const startupTimeout = setTimeout(() => {
      if (!started) {
        proc.kill();
        reject(new Error("Whatsmeow bridge startup timed out"));
      }
    }, 45000);

    const onBridgeOutput = (text: string, isStderr: boolean) => {
      if (isStderr) {
        process.stderr.write(`[whatsmeow:err] ${text}`);
      } else {
        process.stdout.write(`[whatsmeow] ${text}`);
      }
      if (!started && (text.includes("listening") || text.includes("Listening"))) {
        started = true;
        clearTimeout(startupTimeout);
        bridgeUrl = `http://127.0.0.1:${port}`;
        bridgePort = port;
        bridgeProcess = proc;
        console.log(`Whatsmeow bridge running at ${bridgeUrl}`);
        resolve(bridgeUrl);
      }
    };

    const healthPoll = setInterval(async () => {
      if (started) { clearInterval(healthPoll); return; }
      try {
        const resp = await fetch(`http://127.0.0.1:${port}/health`);
        if (resp.ok) {
          const json = await resp.json();
          if (json?.ok) {
            clearInterval(healthPoll);
            started = true;
            clearTimeout(startupTimeout);
            bridgeUrl = `http://127.0.0.1:${port}`;
            bridgePort = port;
            bridgeProcess = proc;
            console.log(`Whatsmeow bridge running at ${bridgeUrl}`);
            resolve(bridgeUrl);
          }
        }
      } catch {}
    }, 1000);

    proc.stdout?.on("data", (data: Buffer) => onBridgeOutput(data.toString(), false));
    proc.stderr?.on("data", (data: Buffer) => onBridgeOutput(data.toString(), true));

    proc.on("error", (err) => {
      clearTimeout(startupTimeout);
      if (!started) reject(err);
    });

    proc.on("exit", (code) => {
      clearTimeout(startupTimeout);
      bridgeProcess = null;
      bridgeUrl = "";
      if (!started) {
        reject(new Error(`Whatsmeow bridge exited with code ${code} before starting`));
      } else if (!isShuttingDown) {
        console.error(`Whatsmeow bridge crashed (code ${code}). Restarting in 2s...`);
        setTimeout(() => {
          startBridge().catch((e) => console.error("Failed to restart bridge:", e));
        }, 2000);
      }
    });
  });
}

export function getBridgeUrl(): string {
  return bridgeUrl;
}

export function isBridgeRunning(): boolean {
  if (process.env.WHATSMEOW_EXTERNAL_URL) return true;
  return Boolean(bridgeUrl && bridgeProcess);
}

export async function stopBridge(): Promise<void> {
  isShuttingDown = true;
  if (bridgeProcess) {
    bridgeProcess.kill("SIGTERM");
    await new Promise((resolve) => {
      bridgeProcess!.on("exit", resolve);
      setTimeout(() => bridgeProcess?.kill("SIGKILL"), 3000);
    });
    bridgeProcess = null;
    bridgeUrl = "";
    bridgePort = 0;
  }
  isShuttingDown = false;
}
