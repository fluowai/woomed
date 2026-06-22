import express from "express";
import path from "path";
import { createServer as createHttpServer } from "http";
import { createServer as createViteServer } from "vite";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { PORT, setWhatsmeowApiUrl } from "./server/config";
import { isDatabaseAvailable, runMigrations, runSeed } from "./server/database";
import { registerRoutes } from "./server/routes/index";
import { registerWhatsAppRoutes } from "./server/routes/whatsapp";
import { registerPhase1Routes } from "./server/routes/phase1";
import { registerPhase2Routes } from "./server/routes/phase2";
import { registerAgentRoutes } from "./server/routes/agents-v2";
import { registerSaaSRoutes } from "./server/routes/saas";
import { registerCrmRoutes } from "./server/routes/crm";
import { registerModules360Routes } from "./server/routes/modules-360";
import { registerSetupRoutes } from "./server/routes/setup";
import { scheduleAutoBackup } from "./server/backup";
import { startBridge, stopBridge } from "./server/whatsmeow-bridge-manager";
import { startScheduler } from "./server/modules/scheduler";
import type { Express } from "express";

const requestId = () => Math.random().toString(36).slice(2, 10);

function errorHandler(err: any, req: express.Request, res: express.Response, _next: express.NextFunction) {
  console.error(`[${requestId()}] ${err?.message || err}`);
  res.status(err?.status || 500).json({ error: err?.message || "Erro interno do servidor." });
}

async function startServer() {
  const app = express();
  const httpServer = createHttpServer(app);

  const corsOrigin = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN === "true" ? true : process.env.CORS_ORIGIN.split(",").map(s => s.trim())
    : process.env.NODE_ENV === "production"
      ? process.env.APP_URL || false
      : true;
  app.use(cors({
    origin: corsOrigin,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-session-token"],
    credentials: true
  }));
  app.use(helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https://api.dicebear.com", "https://*.supabase.co"],
        connectSrc: ["'self'", "ws:", "wss:", "https://*.supabase.co", "https://api.openai.com", "https://api.anthropic.com", "https://api.groq.com", "https://generativelanguage.googleapis.com"],
        fontSrc: ["'self'", "data:"],
        frameAncestors: ["'none'"],
        formAction: ["'self'"],
        baseUri: ["'self'"],
        upgradeInsecureRequests: []
      }
    },
    crossOriginEmbedderPolicy: false
  }));
  app.use(express.json({ limit: "10mb" }));

  // Request logger
  app.use((req, _res, next) => {
    const rid = requestId();
    (req as any).requestId = rid;
    const start = Date.now();
    _res.on("finish", () => {
      console.log(`[${rid}] ${req.method} ${req.path} ${_res.statusCode} ${Date.now() - start}ms`);
    });
    next();
  });

  // Setup routes (unauthenticated, no rate limit)
  registerSetupRoutes(app);

  // Rate limiting
  const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: { error: "Muitas tentativas de login. Tente novamente em 15 minutos." }, standardHeaders: true, legacyHeaders: false });
  app.use("/api/auth/login", authLimiter);
  app.use("/api/v2/auth/login", authLimiter);
  const mfaRateLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: { error: "Muitas tentativas MFA. Tente novamente em 15 minutos." }, standardHeaders: true, legacyHeaders: false });
  app.use("/api/v2/auth/mfa", mfaRateLimiter);
  app.use("/api/v2/auth/change-password", mfaRateLimiter);
  const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: 200, message: { error: "Muitas requisicoes. Tente novamente em 1 minuto." }, standardHeaders: true, legacyHeaders: false });
  app.use("/api/", apiLimiter);

  // Database
  if (isDatabaseAvailable()) {
    try {
      await runMigrations();
      await runSeed();
      console.log("PostgreSQL connected and migrations applied.");
    } catch (error) {
      console.error("PostgreSQL migration failed, falling back to JSON storage:", error);
    }
  } else {
    console.log("No DATABASE_URL configured. Using JSON file storage.");
  }

  // Serve uploaded files
  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

  // Start whatsmeow bridge as managed subprocess
  if (!process.env.WHATSMEOW_API_URL) {
    startBridge()
      .then(async (bridgeUrl) => {
        setWhatsmeowApiUrl(bridgeUrl);
        console.log(`Whatsmeow bridge integrated at ${bridgeUrl}`);
        // Try to reconnect previously connected WhatsApp sessions
        try {
          const { loadData } = await import("./server/data");
          const { callWhatsmeowBridge, sanitizeConnection } = await import("./server/whatsapp-utils");
          const data = await loadData();
          const connectedSessions = data.whatsappConnections.filter(c => c.status === "connected" || c.status === "connecting");
          for (const conn of connectedSessions) {
            try {
              const resp = await callWhatsmeowBridge<Record<string, unknown>>(`/connections/${conn.id}/connect`, {
                method: "POST",
                body: JSON.stringify({ id: conn.id, name: conn.name, phoneNumber: conn.normalizedPhone, formattedPhone: conn.phoneNumber })
              });
              if (resp) conn.status = "connected";
              if (resp?.deviceJid) conn.deviceJid = String(resp.deviceJid);
              console.log(`[WhatsApp] Auto-reconnected session ${conn.name}`);
            } catch (e) {
              console.warn(`[WhatsApp] Failed to reconnect ${conn.name}:`, e instanceof Error ? e.message : e);
              conn.status = "disconnected";
            }
            conn.updatedAt = new Date().toISOString();
          }
          if (connectedSessions.length > 0) {
            const { saveData } = await import("./server/data");
            await saveData(data);
          }
        } catch (e) {
          console.warn("[WhatsApp] Auto-reconnect check failed:", e);
        }
      })
      .catch((error) => {
        console.error("Failed to start embedded whatsmeow bridge:", error);
        console.log("WhatsApp features will be unavailable. Set WHATSMEOW_API_URL to use an external bridge.");
      });
  }

  // Routes
  registerRoutes(app);
  registerWhatsAppRoutes(app, httpServer);
  registerPhase1Routes(app);
  registerPhase2Routes(app);
  registerAgentRoutes(app);
  registerSaaSRoutes(app);
  registerCrmRoutes(app);
  registerModules360Routes(app);

  // Scheduler routes
  const { registerSchedulerRoutes } = await import("./server/routes/scheduler-routes");
  registerSchedulerRoutes(app);

  // Start background scheduler
  startScheduler();

  // Auto backup
  scheduleAutoBackup().catch(console.error);

  // Vite / Static
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => res.sendFile(path.join(distPath, "index.html")));
  }

  // Error handler (must be last)
  app.use(errorHandler);

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

process.on("SIGINT", () => { stopBridge().finally(() => process.exit(0)); });
process.on("SIGTERM", () => { stopBridge().finally(() => process.exit(0)); });
