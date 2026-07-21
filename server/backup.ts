import path from "path";
import fs from "fs/promises";
import crypto from "crypto";
import { dataDir, dataFile, loadData } from "./data";
import { getSecret } from "./secrets";

const BACKUP_DIR = path.join(process.cwd(), "backups");
const MAX_BACKUPS = 30;

function getBackupEncryptionKey(): Buffer {
  const key = getSecret("ENCRYPTION_MASTER_KEY");
  return key ? Buffer.from(key, "hex") : crypto.randomBytes(32);
}

function encryptBuffer(data: Buffer, key: Buffer): Buffer {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]);
}

function decryptBuffer(data: Buffer, key: Buffer): Buffer {
  const iv = data.subarray(0, 16);
  const authTag = data.subarray(16, 32);
  const encrypted = data.subarray(32);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

function formatDate(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}_${hh}-${min}`;
}

export async function createBackup(): Promise<{ path: string; verified: boolean }> {
  await fs.mkdir(BACKUP_DIR, { recursive: true });
  const data = await loadData();
  const sanitized = { ...data };
  delete (sanitized as any).__agentRuntime;
  const encryptionKey = getBackupEncryptionKey();
  const backupName = `consultio-backup-${formatDate(new Date())}.enc`;
  const backupPath = path.join(BACKUP_DIR, backupName);
  const plaintext = Buffer.from(JSON.stringify(sanitized), "utf-8");
  const encrypted = encryptBuffer(plaintext, encryptionKey);
  await fs.writeFile(backupPath, encrypted);

  let verified = false;
  try {
    const readBack = await fs.readFile(backupPath);
    const decrypted = decryptBuffer(readBack, encryptionKey);
    JSON.parse(decrypted.toString("utf-8"));
    verified = true;
  } catch {
    console.error("[Backup] Verification failed for", backupName);
  }

  await cleanOldBackups();
  return { path: backupPath, verified };
}

async function cleanOldBackups(): Promise<void> {
  try {
    const files = await fs.readdir(BACKUP_DIR);
    const backupFiles = files.filter(f => f.startsWith("consultio-backup-")).sort().reverse();
    if (backupFiles.length > MAX_BACKUPS) {
      for (let i = MAX_BACKUPS; i < backupFiles.length; i++) {
        await fs.unlink(path.join(BACKUP_DIR, backupFiles[i])).catch(() => {});
      }
    }
  } catch {
    // Directory may not exist yet
  }
}

export async function listBackups(): Promise<{ name: string; size: number; date: string }[]> {
  try {
    const files = await fs.readdir(BACKUP_DIR);
    const backupFiles = files.filter(f => f.startsWith("consultio-backup-")).sort().reverse();
    const result = [];
    for (const file of backupFiles) {
      const stat = await fs.stat(path.join(BACKUP_DIR, file));
      result.push({ name: file, size: stat.size, date: stat.mtime.toISOString() });
    }
    return result;
  } catch {
    return [];
  }
}

export async function restoreBackup(backupName: string): Promise<boolean> {
  try {
    const backupPath = path.join(BACKUP_DIR, backupName);
    const encryptionKey = getBackupEncryptionKey();
    const encrypted = await fs.readFile(backupPath);
    const decrypted = decryptBuffer(encrypted, encryptionKey);
    JSON.parse(decrypted.toString("utf-8")); // Validate JSON
    await fs.writeFile(dataFile, decrypted);
    return true;
  } catch {
    return false;
  }
}

export async function scheduleAutoBackup(): Promise<void> {
  const BACKUP_INTERVAL = Number(process.env.BACKUP_INTERVAL_MINUTES || 60) * 60 * 1000;

  const runBackup = async () => {
    try {
      const result = await createBackup();
      if (result.verified) {
        console.log(`[Backup] Verified backup created at ${new Date().toISOString()}`);
      } else {
        console.error("[Backup] Backup created but verification FAILED at", new Date().toISOString());
      }
    } catch (error) {
      console.error("[Backup] Auto backup failed:", error instanceof Error ? error.message : error);
    }
  };

  await runBackup(); // Run immediately on startup
  setInterval(runBackup, BACKUP_INTERVAL);
}
