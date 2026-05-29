import express from "express";
import path from "path";
import { createServer as createHttpServer } from "http";
import { createServer as createViteServer } from "vite";
import cors from "cors";
import helmet from "helmet";
import { PORT } from "./server/config";
import { isDatabaseAvailable, runMigrations } from "./server/database";
import { registerRoutes } from "./server/routes/index";
import { registerWhatsAppRoutes } from "./server/routes/whatsapp";
import { registerPhase1Routes } from "./server/routes/phase1";
import { registerPhase2Routes } from "./server/routes/phase2";
import { scheduleAutoBackup } from "./server/backup";

async function startServer() {
  const app = express();
  const httpServer = createHttpServer(app);

  app.use(cors({ origin: process.env.CORS_ORIGIN || true }));
  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
  app.use(express.json({ limit: "10mb" }));

  // Database
  if (isDatabaseAvailable()) {
    try {
      await runMigrations();
      console.log("PostgreSQL connected and migrations applied.");
    } catch (error) {
      console.error("PostgreSQL migration failed, falling back to JSON storage:", error);
    }
  } else {
    console.log("No DATABASE_URL configured. Using JSON file storage.");
  }

  // Serve uploaded files
  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

  // Routes
  registerRoutes(app);
  registerWhatsAppRoutes(app, httpServer);
  registerPhase1Routes(app);
  registerPhase2Routes(app);

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

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
