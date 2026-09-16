import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getCurrentAnnouncements } from "@/lib/gameService";
import { handleRouteError } from "@/lib/http";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireSession();
    const announcements = await getCurrentAnnouncements();
    return NextResponse.json({ announcements });
  } catch (error) {
    return handleRouteError(error);
  }
}
