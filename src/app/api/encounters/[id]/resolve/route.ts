import { NextResponse } from "next/server";
import { requireCurrentPlayer } from "@/lib/auth";
import { resolveEncounter } from "@/lib/gameService";
import { handleRouteError, readJsonObject } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { player } = await requireCurrentPlayer();
    const { id } = await context.params;
    const body = await readJsonObject(request);
    const encounters = await resolveEncounter(id, player.id, player.role, {
      status: typeof body.status === "string" ? body.status : "resolved",
      winnerPlayerId: typeof body.winnerPlayerId === "string" && body.winnerPlayerId ? body.winnerPlayerId : null,
      resolutionNotes: typeof body.resolutionNotes === "string" ? body.resolutionNotes : null
    });

    return NextResponse.json({ encounters });
  } catch (error) {
    return handleRouteError(error);
  }
}
