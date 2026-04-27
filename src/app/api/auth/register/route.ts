import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  createSession,
  hashPassword,
  normalizeEmail,
  setSessionCookie,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = normalizeEmail(String(body.email || ""));
    const password = String(body.password || "");
    const name = body.name ? String(body.name).trim() : null;

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: "请输入有效邮箱" }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "密码至少需要 8 位" }, { status: 400 });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingUser) {
      return NextResponse.json({ error: "该邮箱已注册" }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        settings: {
          create: {},
        },
      },
      select: {
        id: true,
        uuid: true,
        email: true,
        name: true,
        role: true,
      },
    });

    const session = await createSession(user.id);
    setSessionCookie(session.token, session.expiresAt);

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    console.error("Register failed:", error);
    return NextResponse.json({ error: "注册失败" }, { status: 500 });
  }
}
