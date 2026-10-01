// Preconfigured storage helpers for Manus WebDev templates
// Uploads via Forge Server presigned URL to S3 when configured,
// or transparently falls back to local disk storage in /uploads/
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { ENV } from "./_core/env";

function getForgeConfig() {
  const forgeUrl = ENV.forgeApiUrl;
  const forgeKey = ENV.forgeApiKey;

  if (!forgeUrl || !forgeKey) {
    return null;
  }

  return { forgeUrl: forgeUrl.replace(/\/+$/, ""), forgeKey };
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function appendHashSuffix(relKey: string): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  const safeRelKey = normalizeKey(relKey).replace(/[^a-zA-Z0-9._\-/]/g, "_");
  const key = appendHashSuffix(safeRelKey);
  const buffer = typeof data === "string" ? Buffer.from(data) : Buffer.from(data);

  // 1. Try Forge if configured
  const forgeConfig = getForgeConfig();
  if (forgeConfig) {
    try {
      const { forgeUrl, forgeKey } = forgeConfig;
      const presignUrl = new URL("v1/storage/presign/put", forgeUrl + "/");
      presignUrl.searchParams.set("path", key);

      const presignResp = await fetch(presignUrl, {
        headers: { Authorization: `Bearer ${forgeKey}` },
      });

      if (presignResp.ok) {
        const { url: s3Url } = (await presignResp.json()) as { url: string };
        if (s3Url) {
          const blob = new Blob([buffer], { type: contentType });
          const uploadResp = await fetch(s3Url, {
            method: "PUT",
            headers: { "Content-Type": contentType },
            body: blob,
          });
          if (uploadResp.ok) {
            return { key, url: `/manus-storage/${key}` };
          }
        }
      }
    } catch (err) {
      console.warn("[Storage] Forge upload failed, falling back to local storage:", err);
    }
  }

  // 2. Local disk storage fallback (persisted in uploads/ directory)
  const uploadsRoot = path.resolve(process.cwd(), "uploads");
  const localFilePath = path.resolve(uploadsRoot, key);
  fs.mkdirSync(path.dirname(localFilePath), { recursive: true });
  fs.writeFileSync(localFilePath, buffer);

  return { key, url: `/uploads/${key}` };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  const uploadsRoot = path.resolve(process.cwd(), "uploads");
  const localFilePath = path.resolve(uploadsRoot, key);
  if (fs.existsSync(localFilePath)) {
    return { key, url: `/uploads/${key}` };
  }
  return { key, url: `/manus-storage/${key}` };
}

export async function storageGetSignedUrl(relKey: string): Promise<string> {
  const key = normalizeKey(relKey);
  const uploadsRoot = path.resolve(process.cwd(), "uploads");
  const localFilePath = path.resolve(uploadsRoot, key);
  if (fs.existsSync(localFilePath)) {
    return `/uploads/${key}`;
  }

  const forgeConfig = getForgeConfig();
  if (!forgeConfig) {
    return `/uploads/${key}`;
  }

  try {
    const { forgeUrl, forgeKey } = forgeConfig;
    const getUrl = new URL("v1/storage/presign/get", forgeUrl + "/");
    getUrl.searchParams.set("path", key);

    const resp = await fetch(getUrl, {
      headers: { Authorization: `Bearer ${forgeKey}` },
    });

    if (resp.ok) {
      const { url } = (await resp.json()) as { url: string };
      if (url) return url;
    }
  } catch (err) {
    console.warn("[Storage] Forge get URL failed:", err);
  }

  return `/uploads/${key}`;
}
