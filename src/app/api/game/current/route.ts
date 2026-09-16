import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getCurrentGameSummary } from "@/lib/gameService";
import { handleRouteError } from "@/lib/http";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireSession();
    const summary = await getCurrentGameSummary();

    return NextResponse.json({
      game: {
        id: summary.game.id,
        name: summary.game.name,
        currentTurn: summary.game.currentTurn,
        currentPhase: summary.game.currentPhase,
        currentState: summary.game.currentState,
        status: summary.game.status
      },
      players: summary.players,
      submissions: summary.submissions.map((submission) => ({
        playerId: submission.playerId,
        factionName: submission.player.factionName,
        colorHex: submission.player.colorHex,
        submittedAt: submission.submittedAt
      })),
      requiredSubmissions: summary.requiredSubmissions
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
