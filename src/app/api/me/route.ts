import { NextResponse } from "next/server";
import { requireCurrentPlayer } from "@/lib/auth";
import { handleRouteError } from "@/lib/http";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { player } = await requireCurrentPlayer();

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
