import express from "express";
import path from "path";
import { createServer as createHttpServer } from "http";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { PORT, setWhatsmeowApiUrl } from "./server/config";
import { isDatabaseAvailable, runMigrations, runSeed } from "./server/database";
import { registerRoutes } from "./server/routes/index";
import { registerSetupRoutes } from "./server/routes/setup";
import { registerOnboardingRoutes } from "./server/routes/onboarding";
import { registerPublicRoutes } from "./server/routes/public";
import { logger } from "./server/logger";
import type { Express } from "express";

export function createApp(): Express {
  const app = express();

  const corsOrigin = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN === "true" ? true : process.env.CORS_ORIGIN.split(",").map(s => s.trim())
    : process.env.NODE_ENV === "production"
      ? process.env.APP_URL || false
      : ["http://localhost:5173", "http://localhost:3000"];
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
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https://api.dicebear.com"],
        connectSrc: ["'self'", "ws:", "wss:", "https://api.openai.com", "https://api.anthropic.com", "https://api.groq.com", "https://generativelanguage.googleapis.com"],
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

  const requestId = () => Math.random().toString(36).slice(2, 10);
  app.use((req, _res, next) => {
    (req as any).requestId = requestId();
    const start = Date.now();
    _res.on("finish", () => {
      logger.info(`${req.method} ${req.path} ${_res.statusCode}`, { requestId: (req as any).requestId, meta: { duration: `${Date.now() - start}ms` } });
    });
    next();
  });

  // Rate limiting
  const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: { error: "Muitas tentativas de login. Tente novamente em 15 minutos." }, standardHeaders: true, legacyHeaders: false });
  app.use("/api/auth/login", authLimiter);
  app.use("/api/v2/auth/login", authLimiter);
  const mfaRateLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: { error: "Muitas tentativas MFA. Tente novamente em 15 minutos." }, standardHeaders: true, legacyHeaders: false });
  app.use("/api/v2/auth/mfa", mfaRateLimiter);
  app.use("/api/v2/auth/change-password", mfaRateLimiter);
  const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: 200, message: { error: "Muitas requisicoes. Tente novamente em 1 minuto." }, standardHeaders: true, legacyHeaders: false });
  app.use("/api/", apiLimiter);
  const publicLimiter = rateLimit({ windowMs: 60 * 1000, max: 30, message: { error: "Muitas requisicoes. Tente novamente em 1 minuto." }, standardHeaders: true, legacyHeaders: false });
  app.use("/api/v2/public/", publicLimiter);
  app.use("/api/v2/portal/", publicLimiter);
  app.use("/api/v2/setup/", publicLimiter);

  // Unauthenticated routes
  registerSetupRoutes(app);
  registerOnboardingRoutes(app);

  // Public routes (no auth, public scheduling + patient portal)
  registerPublicRoutes(app);

  // Serve uploaded files
  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

  return app;
}

export async function registerAllRoutes(app: Express, httpServer?: import("http").Server) {
  const { registerWhatsAppRoutes } = await import("./server/routes/whatsapp");
  const { registerPhase1Routes } = await import("./server/routes/phase1");
  const { registerPhase2Routes } = await import("./server/routes/phase2");
  const { registerAgentRoutes } = await import("./server/routes/agents-v2");
  const { registerSaaSRoutes } = await import("./server/routes/saas");
  const { registerCrmRoutes } = await import("./server/routes/crm");
  const { registerModules360Routes } = await import("./server/routes/modules-360");

  registerRoutes(app);
  if (httpServer) registerWhatsAppRoutes(app, httpServer);
  registerPhase1Routes(app);
  registerPhase2Routes(app);
  registerAgentRoutes(app);
  registerSaaSRoutes(app);
  registerCrmRoutes(app);
  registerModules360Routes(app);
}

async function startServer() {
  const app = createApp();
  const httpServer = createHttpServer(app);

  // Database
  if (isDatabaseAvailable()) {
    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    let lastError: unknown = null;
    for (let attempt = 1; attempt <= 30; attempt += 1) {
      try {
        await runMigrations();
        await runSeed();
        logger.info("PostgreSQL connected and migrations applied.");
        lastError = null;
        break;
      } catch (error) {
        lastError = error;
        logger.warn(`PostgreSQL not ready yet (${attempt}/30)`, { meta: { error: error instanceof Error ? error.message : error } });
        await sleep(2000);
      }
    }
    if (lastError) {
      logger.error("PostgreSQL migration failed after retries", { meta: { error: lastError instanceof Error ? lastError.message : lastError } });
      if (process.env.NODE_ENV === "production") throw lastError;
    }
  } else {
    logger.info("No DATABASE_URL configured. Using JSON file storage.");
  }

  // Start whatsmeow bridge
  if (!process.env.WHATSMEOW_API_URL) {
    const { startBridge, stopBridge } = await import("./server/whatsmeow-bridge-manager");
    startBridge()
      .then(async (bridgeUrl: string) => {
        setWhatsmeowApiUrl(bridgeUrl);
        logger.info(`Whatsmeow bridge integrated at ${bridgeUrl}`);
        try {
          const { loadData } = await import("./server/data");
          const { callWhatsmeowBridge } = await import("./server/whatsapp-utils");
          const data = await loadData();
          const connectedSessions = data.whatsappConnections.filter((c: any) => c.status === "connected" || c.status === "connecting");
          for (const conn of connectedSessions) {
            try {
              const resp = await callWhatsmeowBridge<Record<string, unknown>>(`/connections/${conn.id}/connect`, {
                method: "POST",
                body: JSON.stringify({ id: conn.id, name: conn.name, phoneNumber: conn.normalizedPhone, formattedPhone: conn.phoneNumber })
              });
              if (resp) conn.status = "connected";
              if (resp?.deviceJid) conn.deviceJid = String(resp.deviceJid);
              logger.info(`[WhatsApp] Auto-reconnected session ${conn.name}`);
            } catch (e) {
              logger.warn(`[WhatsApp] Failed to reconnect ${conn.name}`, { meta: { error: e instanceof Error ? e.message : e } });
              conn.status = "disconnected";
            }
            conn.updatedAt = new Date().toISOString();
          }
          if (connectedSessions.length > 0) {
            const { saveData } = await import("./server/data");
            await saveData(data);
          }
        } catch (e) {
          logger.warn("[WhatsApp] Auto-reconnect check failed", { meta: { error: e instanceof Error ? e.message : e } });
        }
      })
      .catch((error: Error) => {
        logger.error("Failed to start embedded whatsmeow bridge", { meta: { error: error.message } });
        logger.info("WhatsApp features will be unavailable. Set WHATSMEOW_API_URL to use an external bridge.");
      });
  }

  // All routes
  await registerAllRoutes(app, httpServer);

  // Scheduler routes
  const { registerSchedulerRoutes } = await import("./server/routes/scheduler-routes");
  registerSchedulerRoutes(app);

  // Start background scheduler
  const { startScheduler } = await import("./server/modules/scheduler");
  startScheduler();

  // Auto backup
  const { scheduleAutoBackup } = await import("./server/backup");
  scheduleAutoBackup().catch(console.error);

  // Vite / Static
  if (process.env.NODE_ENV !== "production") {
    const viteMod = await import("vite");
    const vite = await viteMod.createServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => res.sendFile(path.join(distPath, "index.html")));
  }

  function errorHandler(err: any, req: express.Request, res: express.Response, _next: express.NextFunction) {
    const requestId = (req as any).requestId || "unknown";
    const status = err?.status || 500;
    logger.error(`${err?.message || err}`, { requestId, meta: { status } });
    if (process.env.NODE_ENV === "production") {
      res.status(status).json({ error: status === 500 ? "Erro interno do servidor." : err?.message || "Erro." });
    } else {
      res.status(status).json({ error: err?.message || "Erro interno do servidor." });
    }
  }
  app.use(errorHandler);

  httpServer.listen(PORT, "0.0.0.0", () => {
    logger.info(`Server running on http://0.0.0.0:${PORT}`);
  });
}

if (!process.env.VITEST) {
  startServer();
}

process.on("SIGINT", () => {
  import("./server/whatsmeow-bridge-manager").then(m => m.stopBridge()).finally(() => process.exit(0));
});
process.on("SIGTERM", () => {
  import("./server/whatsmeow-bridge-manager").then(m => m.stopBridge()).finally(() => process.exit(0));
});
