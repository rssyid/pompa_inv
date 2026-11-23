import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  SESSION_COOKIE_NAME,
  SessionPayload,
  UserRole,
  signSessionToken,
  verifySessionToken,
} from "./jwt";

export { SESSION_COOKIE_NAME, signSessionToken, verifySessionToken };
export type { SessionPayload, UserRole };

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function getSessionUser(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function requireApiSession(
  requiredRole?: UserRole
): Promise<{ user: SessionPayload } | { error: NextResponse }> {
  const user = await getSessionUser();
  if (!user) {
    return {
      error: NextResponse.json({ error: "Sesi berakhir. Silakan login kembali." }, { status: 401 }),
    };
  }
  if (requiredRole && user.role !== requiredRole) {
    return {
      error: NextResponse.json(
        { error: "Akses ditolak. Fitur ini khusus Admin." },
        { status: 403 }
      ),
    };
  }
  return { user };
}
