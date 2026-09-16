import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { requireCurrentPlayer } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { handleRouteError, jsonError, readJsonObject } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { player } = await requireCurrentPlayer();
    const body = await readJsonObject(request);
    const currentPassword = String(body.currentPassword ?? "");
    const newPassword = String(body.newPassword ?? "");

    if (!currentPassword || !newPassword) {
      return jsonError(400, "Current and new password are required.");
    }

    if (newPassword.length < 8) {
      return jsonError(400, "New password must have at least 8 characters.");
    }

    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, player.passwordHash);

    if (!isCurrentPasswordValid) {
      return jsonError(403, "Current password is not valid.");
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await prisma.player.update({
      where: { id: player.id },
      data: { passwordHash }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
