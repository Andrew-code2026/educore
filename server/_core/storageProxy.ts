import type { Express } from "express";
import fs from "node:fs";
import path from "node:path";
import { ENV } from "./env";

export function registerStorageProxy(app: Express) {
  app.get("/manus-storage/*", async (req, res) => {
    const key = (req.params as Record<string, string>)[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }

    // 1. Check local file in uploads root
    const uploadsRoot = path.resolve(process.cwd(), "uploads");
    const localPath = path.resolve(uploadsRoot, key);
    if (fs.existsSync(localPath)) {
      res.sendFile(localPath);
      return;
    }

    // Also check with decoded key
    try {
      const decodedKey = decodeURIComponent(key);
      const decodedPath = path.resolve(uploadsRoot, decodedKey);
      if (fs.existsSync(decodedPath)) {
        res.sendFile(decodedPath);
        return;
      }
    } catch {
      // ignore
    }

    // Also check in branding subfolder
    const baseName = path.basename(key);
    const brandingPath = path.resolve(uploadsRoot, "branding", baseName);
    if (fs.existsSync(brandingPath)) {
      res.sendFile(brandingPath);
      return;
    }

    if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
      res.status(404).send("File not found");
      return;
    }

    try {
      const forgeUrl = new URL(
        "v1/storage/presign/get",
        ENV.forgeApiUrl.replace(/\/+$/, "") + "/",
      );
      forgeUrl.searchParams.set("path", key);

      const forgeResp = await fetch(forgeUrl, {
        headers: { Authorization: `Bearer ${ENV.forgeApiKey}` },
      });

      if (!forgeResp.ok) {
        const body = await forgeResp.text().catch(() => "");
        console.error(`[StorageProxy] forge error: ${forgeResp.status} ${body}`);
        res.status(502).send("Storage backend error");
        return;
      }

      const { url } = (await forgeResp.json()) as { url: string };
      if (!url) {
        res.status(502).send("Empty signed URL from backend");
        return;
      }

      res.set("Cache-Control", "no-store");
      res.redirect(307, url);
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      res.status(502).send("Storage proxy error");
    }
  });
}
