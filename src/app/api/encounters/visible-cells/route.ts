import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getVisibleEncounterCells } from "@/lib/gameService";
import { handleRouteError } from "@/lib/http";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireSession();
    const result = await getVisibleEncounterCells();

    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
