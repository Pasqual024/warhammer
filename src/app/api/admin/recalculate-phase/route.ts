import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth";
import { recalculateCurrentPhase } from "@/lib/gameService";
import { handleRouteError } from "@/lib/http";

export const runtime = "nodejs";

export async function POST() {
  try {
    await requireSuperAdmin();
    const result = await recalculateCurrentPhase();
    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
