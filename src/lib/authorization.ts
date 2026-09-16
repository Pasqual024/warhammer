export type SessionIdentity = {
  playerId: string;
  role: string;
};

export function isSuperAdmin(session: SessionIdentity | null | undefined) {
  return session?.role === "superadmin";
}

export function canViewPlayerMoves(session: SessionIdentity | null | undefined, targetPlayerId: string) {
  return Boolean(session && (isSuperAdmin(session) || session.playerId === targetPlayerId));
}

export function canViewEncounter(session: SessionIdentity | null | undefined, participantPlayerIds: string[]) {
  return Boolean(session && (isSuperAdmin(session) || participantPlayerIds.includes(session.playerId)));
}

export function canModifyMoves(session: SessionIdentity | null | undefined, hasSubmitted: boolean) {
  return Boolean(session && (isSuperAdmin(session) || !hasSubmitted));
}

export function assertNoManualIdentityOverride(input: Record<string, unknown>) {
  const forbiddenKeys = ["code", "playerCode", "playerId", "factionCode", "factionName"];
  const providedForbiddenKey = forbiddenKeys.find((key) => Object.prototype.hasOwnProperty.call(input, key));

  if (providedForbiddenKey) {
    throw new Error(`Manual identity override is not allowed: ${providedForbiddenKey}`);
  }
}

export function extractMoveToggleInput(input: Record<string, unknown>) {
  assertNoManualIdentityOverride(input);

  if (typeof input.cellId !== "string" || input.cellId.trim().length === 0) {
    throw new Error("A valid cellId is required");
  }

  return {
    cellId: input.cellId.trim().toUpperCase()
  };
}
