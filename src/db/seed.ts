import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { getDb } from "./index";
import { users } from "./schema";
import { hashPassword } from "../lib/auth";
import { parsePumpWorkbook } from "../lib/excel/parser";
import { ensureBasePresets, importParsedPumpRecords } from "../lib/import-service";

async function seed() {
  const db = getDb();
  console.log("Memulai seed database PT TH Indoplantation...");

  await ensureBasePresets();

  const adminPass = process.env.SEED_ADMIN_PASSWORD || "AdminThip2026!";
  const petugasPass = process.env.SEED_PETUGAS_PASSWORD || "Petugas2026!";

  await db
    .insert(users)
    .values([
      {
        username: "admin",
        name: "Admin Pompa THIP",
        passwordHash: await hashPassword(adminPass),
        role: "admin",
      },
      {
        username: "petugas",
        name: "Petugas Lapangan",
        passwordHash: await hashPassword(petugasPass),
        role: "petugas",
      },
    ])
    .onConflictDoNothing({ target: users.username });

  const [adminUser] = await db
    .select()
    .from(users)
    .where(eq(users.username, "admin"))
    .limit(1);

  const dataFiles = [
    { fileName: "Form Pemeriksaan Pompa Region 1.xlsx" },
    { fileName: "Form Pemeriksaan Pompa Wilayah 2.xlsx" },
    { fileName: "Form Pemeriksaan Pompa PUL.xlsx", defaultEstateCode: "PUL" },
  ];

  for (const df of dataFiles) {
    const fullPath = path.resolve(process.cwd(), "data", df.fileName);
    const buffer = await fs.readFile(fullPath);
    console.log(`Memparsing ${df.fileName}...`);
    const parsed = await parsePumpWorkbook(buffer, {
      fileName: df.fileName,
      defaultEstateCode: df.defaultEstateCode,
    });
    console.log(`  Ditemukan ${parsed.length} form pompa. Mengimpor ke database & storage...`);

    const result = await importParsedPumpRecords({
      records: parsed,
      companyCode: "THIP",
      companyName: "PT TH Indoplantation",
      inspectorId: adminUser?.id ?? null,
      inspectorName: adminUser?.name ?? "Admin Import",
      source: "excel_import",
      skipExistingPumps: true,
    });

    console.log(
      `  Selesai: +${result.pumpsCreated} pompa baru, ${result.pumpsSkippedDuplicate} duplikat dilewati, +${result.photosUploaded} foto.`
    );
  }

  console.log("Seed selesai!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed gagal:", err);
  process.exit(1);
});
