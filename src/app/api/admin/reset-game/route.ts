import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth";
import { resetActiveGame } from "@/lib/gameService";
import { handleRouteError } from "@/lib/http";

export const runtime = "nodejs";

export async function POST() {
  try {
    await requireSuperAdmin();
    const game = await resetActiveGame();
    return NextResponse.json({ game });
  } catch (error) {
    return handleRouteError(error);
  }
}
