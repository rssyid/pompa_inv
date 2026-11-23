import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { SESSION_COOKIE_NAME, signSessionToken, verifyPassword } from "@/lib/auth";

const loginSchema = z.object({
  username: z.string().min(1, "Username wajib diisi."),
  password: z.string().min(1, "Kata sandi wajib diisi."),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Data login tidak valid." },
        { status: 400 }
      );
    }

    const db = getDb();
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.username, parsed.data.username.trim()))
      .limit(1);

    if (!user || !user.isActive) {
      return NextResponse.json(
        { error: "Username tidak ditemukan atau akun sedang dinonaktifkan." },
        { status: 401 }
      );
    }

    const ok = await verifyPassword(parsed.data.password, user.passwordHash);
    if (!ok) {
      return NextResponse.json({ error: "Kata sandi tidak sesuai." }, { status: 401 });
    }

    const role = user.role === "admin" ? "admin" : "petugas";
    const token = await signSessionToken({
      userId: user.id,
      username: user.username,
      name: user.name,
      role,
      defaultEstateId: user.defaultEstateId ?? null,
    });

    const response = NextResponse.json({
      user: {
        userId: user.id,
        username: user.username,
        name: user.name,
        role,
        defaultEstateId: user.defaultEstateId ?? null,
      },
    });

    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json(
      { error: "Gagal memproses login. Periksa koneksi database." },
      { status: 500 }
    );
  }
}
