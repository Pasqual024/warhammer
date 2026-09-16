import { NextResponse } from "next/server";
import { AuthError } from "@/lib/auth";

export function jsonError(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

export function handleRouteError(error: unknown) {
  if (error instanceof AuthError) {
    return jsonError(error.status, error.message);
  }

  if (error instanceof Error) {
    return jsonError(400, error.message);
  }

  return jsonError(500, "Unexpected server error");
}

export async function readJsonObject(request: Request) {
  const body = await request.json().catch(() => ({}));

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("JSON object expected");
  }

  return body as Record<string, unknown>;
}
