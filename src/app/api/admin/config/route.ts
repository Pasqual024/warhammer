import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { handleRouteError, readJsonObject } from "@/lib/http";

export const runtime = "nodejs";

type PlayerColorInput = {
  id?: unknown;
  colorName?: unknown;
  colorHex?: unknown;
};

type ZoneInput = {
  id?: unknown;
  cellIds?: unknown;
};

function normalizeCellIds(value: unknown) {
  if (!Array.isArray(value)) {
    throw new Error("Zone cellIds must be an array.");
  }

  return [...new Set(value.map((cellId) => String(cellId).trim().toUpperCase()).filter(Boolean))];
}

export async function POST(request: Request) {
  try {
    await requireSuperAdmin();
    const body = await readJsonObject(request);
    const playerInputs = Array.isArray(body.players) ? (body.players as PlayerColorInput[]) : [];
    const zoneInputs = Array.isArray(body.zones) ? (body.zones as ZoneInput[]) : [];

    await prisma.$transaction(async (tx) => {
      for (const player of playerInputs) {
        if (typeof player.id !== "string") {
          continue;
        }

        await tx.player.update({
          where: { id: player.id },
          data: {
            colorName: typeof player.colorName === "string" ? player.colorName.trim() : undefined,
            colorHex: typeof player.colorHex === "string" ? player.colorHex.trim() : undefined
          }
        });
      }

      for (const zone of zoneInputs) {
        if (typeof zone.id !== "string") {
          continue;
        }

        const zoneId = zone.id;
        const cellIds = normalizeCellIds(zone.cellIds);
        const existingCells = await tx.cell.findMany({
          where: { id: { in: cellIds } },
          select: { id: true }
        });
        const existingCellIds = new Set(existingCells.map((cell) => cell.id));
        const missing = cellIds.filter((cellId) => !existingCellIds.has(cellId));

        if (missing.length > 0) {
          throw new Error(`Unknown cells: ${missing.join(", ")}`);
        }

        await tx.specialZoneCell.deleteMany({ where: { zoneId } });
        if (cellIds.length > 0) {
          await tx.specialZoneCell.createMany({
            data: cellIds.map((cellId) => ({
              zoneId,
              cellId
            }))
          });
        }
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
