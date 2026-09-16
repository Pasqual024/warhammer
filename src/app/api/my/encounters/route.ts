import { NextResponse } from "next/server";
import { requireCurrentPlayer } from "@/lib/auth";
import { getMyEncounters } from "@/lib/gameService";
import { handleRouteError } from "@/lib/http";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { player } = await requireCurrentPlayer();
    const encounters = await getMyEncounters(player.id, player.role);

    return NextResponse.json({ encounters });
  } catch (error) {
    return handleRouteError(error);
  }
}
