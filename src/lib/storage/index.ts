import { gdriveStorageProvider } from "./gdrive";
import { localStorageProvider } from "./local";
import { PhotoStorageProvider } from "./types";

export function getStorageProvider(override?: "gdrive" | "local"): PhotoStorageProvider {
  const mode = override ?? (process.env.STORAGE_PROVIDER === "local" ? "local" : "gdrive");
  return mode === "local" ? localStorageProvider : gdriveStorageProvider;
}
