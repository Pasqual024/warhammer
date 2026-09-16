import crypto from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";

export const SESSION_COOKIE_NAME = "hidden_board_session";

export type SessionPayload = {
  playerId: string;
  username: string;
  role: string;
  exp: number;
};

export class AuthError extends Error {
  status = 401;
}

function getSessionSecret() {
  return process.env.SESSION_SECRET || "development-only-change-me";
}

function encode(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function decode<T>(value: string): T {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as T;
}

function sign(value: string) {
  return crypto.createHmac("sha256", getSessionSecret()).update(value).digest("base64url");
}

function timingSafeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export function createSessionToken(payload: Omit<SessionPayload, "exp">, maxAgeSeconds = 60 * 60 * 24 * 14) {
  const body = encode({
    ...payload,
    exp: Math.floor(Date.now() / 1000) + maxAgeSeconds
  });
  const signature = sign(body);

  return `${body}.${signature}`;
}

export function verifySessionToken(token: string | undefined): SessionPayload | null {
  if (!token) {
    return null;
  }

  const [body, signature] = token.split(".");

  if (!body || !signature || !timingSafeEqual(sign(body), signature)) {
    return null;
  }

  const payload = decode<SessionPayload>(body);

  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
    return null;
  }

  return payload;
}

export async function setSessionCookie(payload: Omit<SessionPayload, "exp">) {
  const cookieStore = await cookies();
  const maxAge = 60 * 60 * 24 * 14;

  cookieStore.set(SESSION_COOKIE_NAME, createSessionToken(payload, maxAge), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE === "true",
    path: "/",
    maxAge
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function getSession() {
  const cookieStore = await cookies();
  return verifySessionToken(cookieStore.get(SESSION_COOKIE_NAME)?.value);
}

export async function requireSession() {
  const session = await getSession();

  if (!session) {
    throw new AuthError("Session required");
  }

  return session;
}

export async function requireCurrentPlayer() {
  const session = await requireSession();
  const player = await prisma.player.findUnique({ where: { id: session.playerId } });

  if (!player) {
    throw new AuthError("Player not found");
  }

  return { session, player };
}

export async function requireSuperAdmin() {
  const { session, player } = await requireCurrentPlayer();

  if (session.role !== "superadmin" || player.role !== "superadmin") {
    const error = new AuthError("Superadmin role required");
    error.status = 403;
    throw error;
  }

  return { session, player };
}
