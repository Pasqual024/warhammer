import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { generateBoardCells } from "@/lib/gameEngine";
import { handleRouteError } from "@/lib/http";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireSession();
    return NextResponse.json({ cells: generateBoardCells() });
  } catch (error) {
    return handleRouteError(error);
  }
}
