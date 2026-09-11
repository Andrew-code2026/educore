import net from "node:net";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

export async function checkPortListening(port: number, host = "127.0.0.1", timeoutMs = 1500): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let isResolved = false;

    socket.setTimeout(timeoutMs);
    socket.on("connect", () => {
      isResolved = true;
      socket.destroy();
      resolve(true);
    });

    socket.on("timeout", () => {
      if (!isResolved) {
        isResolved = true;
        socket.destroy();
        resolve(false);
      }
    });

    socket.on("error", () => {
      if (!isResolved) {
        isResolved = true;
        socket.destroy();
        resolve(false);
      }
    });

    socket.connect(port, host);
  });
}

export async function ensureDatabaseRunning(): Promise<boolean> {
  const dbUrl = process.env.DATABASE_URL || "";
  const match = dbUrl.match(/@(localhost|127\.0\.0\.1):(\d+)/);
  const port = match ? parseInt(match[2], 10) : 3307;
  const host = match ? match[1] : "127.0.0.1";

  const isAlreadyListening = await checkPortListening(port, host);
  if (isAlreadyListening) {
    return true;
  }

  const localAppData = process.env.LOCALAPPDATA || (process.env.USERPROFILE ? path.join(process.env.USERPROFILE, "AppData", "Local") : "");
  if (!localAppData) return false;

  const mysqldPath = path.join(localAppData, "Programs", "mariadb-portable", "bin", "mysqld.exe");
  const iniPath = path.join(localAppData, "Programs", "mariadb-portable", "data", "my.ini");

  if (!fs.existsSync(mysqldPath) || !fs.existsSync(iniPath)) {
    console.warn("[Database] MariaDB portable not found at expected path:", mysqldPath);
    return false;
  }

  console.log(`[Database] Port ${port} is not listening. Automatically launching portable MariaDB...`);
  try {
    const child = spawn(
      mysqldPath,
      [`--defaults-file=${iniPath}`],
      {
        detached: true,
        stdio: "ignore",
        windowsHide: true,
      }
    );
    child.unref();

    // Poll until MariaDB is ready (up to 10 seconds)
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 500));
      const isReady = await checkPortListening(port, host, 500);
      if (isReady) {
        console.log(`[Database] Portable MariaDB is ready and listening on port ${port}!`);
        return true;
      }
    }
  } catch (err) {
    console.error("[Database] Failed to auto-launch portable MariaDB:", err);
  }

  return false;
}
