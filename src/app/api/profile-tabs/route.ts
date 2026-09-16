import { NextResponse } from "next/server";
import { requireCurrentPlayer } from "@/lib/auth";
import { handleRouteError, jsonError, readJsonObject } from "@/lib/http";
import { getProfileTabsState, saveArmyListData, saveDiaryData, saveIngresarData, saveInvertirData } from "@/lib/profileTabsService";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { player } = await requireCurrentPlayer();
    const data = await getProfileTabsState(player.id);

    return NextResponse.json(data);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const { player } = await requireCurrentPlayer();
    const body = await readJsonObject(request);
    const section = String(body.section ?? "");

    if (section === "armyList") {
      return NextResponse.json(await saveArmyListData(player.id, body.data));
    }

    if (section === "diary") {
      return NextResponse.json(await saveDiaryData(player.id, body.data));
    }

    if (section === "invertir") {
      return NextResponse.json(await saveInvertirData(player.id, (body.data ?? {}) as Record<string, unknown>));
    }

    if (section === "ingresar") {
      return NextResponse.json(await saveIngresarData(player.id, (body.data ?? {}) as Record<string, unknown>));
    }

    return jsonError(400, "Unknown profile tab section.");
  } catch (error) {
    if (error instanceof Error && (error as { status?: unknown }).status === 403) {
      return jsonError(403, error.message);
    }

    return handleRouteError(error);
  }
}
