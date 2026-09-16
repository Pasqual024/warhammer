import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth";
import { advanceCurrentPhase } from "@/lib/gameService";
import { handleRouteError } from "@/lib/http";

export const runtime = "nodejs";

export async function POST() {
  try {
    await requireSuperAdmin();
    const game = await advanceCurrentPhase(false);
    return NextResponse.json({ game });
  } catch (error) {
    return handleRouteError(error);
  }
}
