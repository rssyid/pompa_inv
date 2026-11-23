import { NextRequest, NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { estates, users } from "@/db/schema";
import { hashPassword, requireApiSession } from "@/lib/auth";

const createUserSchema = z.object({
  username: z
    .string()
    .min(3, "Username minimal 3 karakter.")
    .max(40)
    .regex(/^[a-zA-Z0-9._-]+$/, "Username hanya boleh huruf, angka, titik, garis bawah, atau hubung."),
  name: z.string().min(2, "Nama lengkap wajib diisi.").max(80),
  password: z.string().min(6, "Kata sandi minimal 6 karakter."),
  role: z.enum(["admin", "petugas"]),
  defaultEstateId: z.number().int().positive().nullable().optional(),
});

export async function GET() {
  const auth = await requireApiSession("admin");
  if ("error" in auth) return auth.error;

  const db = getDb();
  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      name: users.name,
      role: users.role,
      defaultEstateId: users.defaultEstateId,
      defaultEstateCode: estates.code,
      isActive: users.isActive,
      createdAt: users.createdAt,
    })
    .from(users)
    .leftJoin(estates, eq(users.defaultEstateId, estates.id))
    .orderBy(asc(users.name));

  return NextResponse.json({ users: rows });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiSession("admin");
  if ("error" in auth) return auth.error;

  try {
    const body = await request.json();
    const parsed = createUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Data user tidak valid." },
        { status: 400 }
      );
    }

    const db = getDb();
    const username = parsed.data.username.trim().toLowerCase();
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    if (existing) {
      return NextResponse.json(
        { error: `Username "${username}" sudah digunakan.` },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(parsed.data.password);
    const [created] = await db
      .insert(users)
      .values({
        username,
        name: parsed.data.name.trim(),
        passwordHash,
        role: parsed.data.role,
        defaultEstateId: parsed.data.defaultEstateId ?? null,
        isActive: true,
      })
      .returning({
        id: users.id,
        username: users.username,
        name: users.name,
        role: users.role,
        defaultEstateId: users.defaultEstateId,
        isActive: users.isActive,
        createdAt: users.createdAt,
      });

    return NextResponse.json({ user: created }, { status: 201 });
  } catch (err) {
    console.error("Create user error:", err);
    return NextResponse.json({ error: "Gagal menambahkan user baru." }, { status: 500 });
  }
}
