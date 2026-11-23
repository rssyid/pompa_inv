import { SignJWT, jwtVerify } from "jose";

export type UserRole = "admin" | "petugas";

export interface SessionPayload {
  userId: number;
  username: string;
  name: string;
  role: UserRole;
  defaultEstateId: number | null;
}

export const SESSION_COOKIE_NAME = "pompa_session";

function getJwtSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET || "dev-only-secret-change-in-production-32ch";
  return new TextEncoder().encode(secret);
}

export async function signSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({
    userId: payload.userId,
    username: payload.username,
    name: payload.name,
    role: payload.role,
    defaultEstateId: payload.defaultEstateId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getJwtSecret());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    if (typeof payload.userId !== "number" || typeof payload.username !== "string") {
      return null;
    }
    return {
      userId: payload.userId,
      username: payload.username,
      name: String(payload.name ?? payload.username),
      role: payload.role === "admin" ? "admin" : "petugas",
      defaultEstateId:
        typeof payload.defaultEstateId === "number" ? payload.defaultEstateId : null,
    };
  } catch {
    return null;
  }
}
