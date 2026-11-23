export interface UploadPhotoInput {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  folderPath?: string[];
}

export interface UploadPhotoResult {
  storageProvider: "gdrive" | "local";
  storageKey: string;
}

export interface PhotoStreamResult {
  buffer: Buffer;
  mimeType: string;
}

export interface PhotoStorageProvider {
  providerName: "gdrive" | "local";
  upload(input: UploadPhotoInput): Promise<UploadPhotoResult>;
  read(storageKey: string, knownMimeType?: string): Promise<PhotoStreamResult>;
  remove(storageKey: string): Promise<void>;
}
