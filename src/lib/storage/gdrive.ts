import { google, drive_v3 } from "googleapis";
import { Readable } from "node:stream";
import { PhotoStorageProvider, PhotoStreamResult, UploadPhotoInput, UploadPhotoResult } from "./types";

const folderCache = new Map<string, Promise<string>>();

function getDriveClient(): drive_v3.Drive {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "Kredensial Google Drive (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN) belum lengkap."
    );
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  return google.drive({ version: "v3", auth: oauth2Client });
}

function escapeDriveQueryValue(val: string): string {
  return val.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function ensureChildFolder(
  drive: drive_v3.Drive,
  parentId: string | undefined,
  folderName: string
): Promise<string> {
  const cacheKey = `${parentId ?? "root"}::${folderName}`;
  const cached = folderCache.get(cacheKey);
  if (cached) return cached;

  const task = (async () => {
    const parentClause = parentId ? `'${escapeDriveQueryValue(parentId)}' in parents and ` : "";
    const query = `${parentClause}name = '${escapeDriveQueryValue(
      folderName
    )}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;

    const existing = await drive.files.list({
      q: query,
      fields: "files(id, name)",
      spaces: "drive",
      pageSize: 1,
    });

    const foundId = existing.data.files?.[0]?.id;
    if (foundId) return foundId;

    const created = await drive.files.create({
      requestBody: {
        name: folderName,
        mimeType: "application/vnd.google-apps.folder",
        parents: parentId ? [parentId] : undefined,
      },
      fields: "id",
    });

    const newId = created.data.id;
    if (!newId) {
      throw new Error(`Gagal membuat folder Google Drive "${folderName}".`);
    }
    return newId;
  })();

  folderCache.set(cacheKey, task);
  try {
    return await task;
  } catch (err) {
    folderCache.delete(cacheKey);
    throw err;
  }
}

async function resolveTargetFolderId(
  drive: drive_v3.Drive,
  rootFolderId: string | undefined,
  folderPath?: string[]
): Promise<string | undefined> {
  let currentParent = rootFolderId;
  if (!folderPath || folderPath.length === 0) return currentParent;

  for (const rawSegment of folderPath) {
    const segment = rawSegment.trim();
    if (!segment) continue;
    currentParent = await ensureChildFolder(drive, currentParent, segment);
  }
  return currentParent;
}

export const gdriveStorageProvider: PhotoStorageProvider = {
  providerName: "gdrive",

  async upload(input: UploadPhotoInput): Promise<UploadPhotoResult> {
    const drive = getDriveClient();
    const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID?.trim() || undefined;
    const targetFolderId = await resolveTargetFolderId(drive, rootFolderId, input.folderPath);

    const response = await drive.files.create({
      requestBody: {
        name: input.fileName,
        parents: targetFolderId ? [targetFolderId] : undefined,
      },
      media: {
        mimeType: input.mimeType,
        body: Readable.from(input.buffer),
      },
      fields: "id",
    });

    const fileId = response.data.id;
    if (!fileId) {
      throw new Error("Google Drive tidak mengembalikan File ID setelah upload.");
    }

    return {
      storageProvider: "gdrive",
      storageKey: fileId,
    };
  },

  async read(storageKey: string): Promise<PhotoStreamResult> {
    const drive = getDriveClient();
    const meta = await drive.files.get({
      fileId: storageKey,
      fields: "mimeType",
    });

    const media = await drive.files.get(
      { fileId: storageKey, alt: "media" },
      { responseType: "arraybuffer" }
    );

    return {
      buffer: Buffer.from(media.data as ArrayBuffer),
      mimeType: meta.data.mimeType ?? "image/jpeg",
    };
  },

  async remove(storageKey: string): Promise<void> {
    const drive = getDriveClient();
    await drive.files.delete({ fileId: storageKey });
  },
};
