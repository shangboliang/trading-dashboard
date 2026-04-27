import { randomBytes, scrypt, timingSafeEqual, createHash } from "crypto";
import { promisify } from "util";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { SESSION_COOKIE_NAME } from "@/lib/auth-constants";

const scryptAsync = promisify(scrypt);
const SESSION_DAYS = 30;

export class AuthError extends Error {
  status: number;

  constructor(message = "请先登录", status = 401) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

export type CurrentUser = {
  id: number;
  uuid: string;
  email: string;
  name: string | null;
  role: "USER" | "ADMIN" | "PREMIUM";
};

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  return `scrypt:${salt}:${derivedKey.toString("hex")}`;
}

export async function verifyPassword(password: string, passwordHash: string) {
  const [algorithm, salt, storedHash] = passwordHash.split(":");

  if (algorithm !== "scrypt" || !salt || !storedHash) {
    return false;
  }

  const storedBuffer = Buffer.from(storedHash, "hex");
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;

  return (
    storedBuffer.length === derivedKey.length &&
    timingSafeEqual(storedBuffer, derivedKey)
  );
}

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: number) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await prisma.$executeRaw`
    INSERT INTO "Session" ("tokenHash", "userId", "expiresAt")
    VALUES (${hashSessionToken(token)}, ${userId}, ${expiresAt})
  `;

  return { token, expiresAt };
}

export function setSessionCookie(token: string, expiresAt: Date) {
  cookies().set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export function clearSessionCookie() {
  cookies().set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const token = cookies().get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const rows = await prisma.$queryRaw<Array<{
    sessionId: number;
    expiresAt: Date;
    id: number;
    uuid: string;
    email: string;
    name: string | null;
    role: "USER" | "ADMIN" | "PREMIUM";
    status: "ACTIVE" | "SUSPENDED" | "DELETED";
  }>>`
    SELECT
      s."id" AS "sessionId",
      s."expiresAt",
      u."id",
      u."uuid",
      u."email",
      u."name",
      u."role",
      u."status"
    FROM "Session" s
    INNER JOIN "User" u ON u."id" = s."userId"
    WHERE s."tokenHash" = ${hashSessionToken(token)}
    LIMIT 1
  `;
  const session = rows[0];

  if (!session) {
    return null;
  }

  if (session.expiresAt <= new Date()) {
    await prisma.$executeRaw`
      DELETE FROM "Session" WHERE "id" = ${session.sessionId}
    `.catch(() => {});
    return null;
  }

  if (session.status !== "ACTIVE") {
    return null;
  }

  return {
    id: session.id,
    uuid: session.uuid,
    email: session.email,
    name: session.name,
    role: session.role,
  };
}

export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    throw new AuthError();
  }

  return user;
}

export async function deleteCurrentSession() {
  const token = cookies().get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    await prisma.$executeRaw`
      DELETE FROM "Session" WHERE "tokenHash" = ${hashSessionToken(token)}
    `;
  }

  clearSessionCookie();
}

export async function requireApiKeyOwner(apiKeyId: number, userId: number) {
  const apiKey = await prisma.apiKey.findFirst({
    where: {
      id: apiKeyId,
      userId,
    },
    select: { id: true },
  });

  if (!apiKey) {
    throw new AuthError("API Key 不存在或无权访问", 404);
  }
}

export function authErrorResponse(error: AuthError) {
  return NextResponse.json({ error: error.message }, { status: error.status });
}
