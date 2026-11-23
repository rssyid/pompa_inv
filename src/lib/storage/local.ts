import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { PhotoStorageProvider, PhotoStreamResult, UploadPhotoInput, UploadPhotoResult } from "./types";

const UPLOAD_DIR = path.resolve(process.cwd(), ".local-uploads");

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function guessMime(filePath: string): string {
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

function resolveSafePath(relativeKey: string): string {
  const resolved = path.resolve(UPLOAD_DIR, relativeKey);
  if (!resolved.startsWith(UPLOAD_DIR + path.sep) && resolved !== UPLOAD_DIR) {
    throw new Error("Path penyimpanan lokal tidak valid.");
  }
  return resolved;
}

export const localStorageProvider: PhotoStorageProvider = {
  providerName: "local",

  async upload(input: UploadPhotoInput): Promise<UploadPhotoResult> {
    const safeSegments = (input.folderPath ?? [])
      .map((s) => sanitizeFileName(s))
      .filter(Boolean);
    const targetDir = path.join(UPLOAD_DIR, ...safeSegments);
    await fs.mkdir(targetDir, { recursive: true });

    const uniqueFile = `${crypto.randomBytes(3).toString("hex")}_${sanitizeFileName(input.fileName)}`;
    const relativeKey = [...safeSegments, uniqueFile].join("/");
    const targetPath = resolveSafePath(relativeKey);
    await fs.writeFile(targetPath, input.buffer);

    return {
      storageProvider: "local",
      storageKey: relativeKey,
    };
  },

  async read(storageKey: string): Promise<PhotoStreamResult> {
    const targetPath = resolveSafePath(storageKey);
    const buffer = await fs.readFile(targetPath);
    return {
      buffer,
      mimeType: guessMime(targetPath),
    };
  },

  async remove(storageKey: string): Promise<void> {
    const targetPath = resolveSafePath(storageKey);
    await fs.unlink(targetPath).catch(() => undefined);
  },
};
