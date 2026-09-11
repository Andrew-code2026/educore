import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { ensureDatabaseRunning } from "./ensureDatabase";

// Ensure console.log flushes immediately on Windows when piped
if ((process.stdout as any)._handle?.setBlocking) (process.stdout as any)._handle.setBlocking(true);
if ((process.stderr as any)._handle?.setBlocking) (process.stderr as any)._handle.setBlocking(true);

function listenOnAvailablePort(server: ReturnType<typeof createServer>, port: number, maxPort: number) {
  server.once("error", (err: any) => {
    if (err.code === "EADDRINUSE" && port < maxPort) {
      console.log(`Port ${port} is busy, trying port ${port + 1}...`);
      listenOnAvailablePort(server, port + 1, maxPort);
    } else {
      console.error("[EduCore] Server listen error:", err);
    }
  });
  server.listen(port, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

async function startServer() {
  console.log("[EduCore] Starting server...");
  await ensureDatabaseRunning();
  const app = express();
  const server = createServer(app);

  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  registerStorageProxy(app);
  registerOAuthRoutes(app);

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV !== "production") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  listenOnAvailablePort(server, preferredPort, preferredPort + 20);
}

startServer().catch(err => console.error("[EduCore] Start error:", err));
