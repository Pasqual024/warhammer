import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { handleRouteError, jsonError, readJsonObject } from "@/lib/http";
import { setSessionCookie } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await readJsonObject(request);
    const username = String(body.username ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");

    if (!username || !password) {
      return jsonError(400, "Username and password are required.");
    }

    const player = await prisma.player.findUnique({ where: { username } });

    if (!player || !(await bcrypt.compare(password, player.passwordHash))) {
      return jsonError(401, "Invalid username or password.");
    }

    await setSessionCookie({
      playerId: player.id,
      username: player.username,
      role: player.role
    });

    return NextResponse.json({
      player: {
        id: player.id,
        username: player.username,
        factionName: player.factionName,
        code: player.code,
        shortCode: player.shortCode,
        colorName: player.colorName,
        colorHex: player.colorHex,
        role: player.role
      }
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
