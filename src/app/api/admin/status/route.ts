import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getCurrentGameSummary } from "@/lib/gameService";
import { handleRouteError } from "@/lib/http";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireSuperAdmin();
    const summary = await getCurrentGameSummary();
    const phaseWhere = {
      gameId: summary.game.id,
      turnNumber: summary.game.currentTurn,
      phaseNumber: summary.game.currentPhase
    };
    const [encounterCounts, announcementCount, activeCellCount, zones] = await Promise.all([
      prisma.encounter.groupBy({
        by: ["status"],
        where: phaseWhere,
        _count: true
      }),
      prisma.phaseAnnouncement.count({ where: phaseWhere }),
      prisma.cell.count({ where: { isActive: true } }),
      prisma.specialZone.findMany({
        include: {
          cells: {
            orderBy: { cellId: "asc" }
          }
        },
        orderBy: { name: "asc" }
      })
    ]);

    return NextResponse.json({
      ...summary,
      metrics: {
        activeCellCount,
        announcementCount,
        encounterCounts
      },
      zones
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
