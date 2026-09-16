export type PlayerCode = 1 | 2 | 4;
export type PhaseState =
  | "movement_open"
  | "waiting_for_players"
  | "calculating_results"
  | "results_available"
  | "encounters_pending"
  | "phase_closed";

export type BoardCell = {
  id: string;
  col: string;
  row: number;
  isActive: boolean;
  zoneTypes: string[];
};

export type PlayerLike = {
  id?: string;
  code: number | null;
  factionName?: string | null;
  shortCode?: string | null;
  colorName?: string | null;
  colorHex?: string | null;
};

export type MoveLike = {
  playerId?: string;
  playerCode?: number;
  code?: number;
  cellId: string;
  occupied?: boolean;
};

export type EncounterDetection = {
  cellId: string;
  sumCode: number;
  participantCodes: PlayerCode[];
};

export type PresenceDetection = {
  cellId: string;
  sumCode: number;
  participantCodes: PlayerCode[];
  isWar: boolean;
};

export const BOARD_COLUMNS = "ABCDEFGHIJKLMNOPQRS".split("");
export const BOARD_ROWS = Array.from({ length: 32 }, (_, index) => index + 4);

export const FACTIONS = [
  {
    name: "Altos Elfos",
    code: 1 as PlayerCode,
    shortCode: "K",
    colorName: "Azul",
    colorHex: "#2563eb"
  },
  {
    name: "Elfos Oscuros",
    code: 2 as PlayerCode,
    shortCode: "A",
    colorName: "Morado",
    colorHex: "#7c3aed"
  },
  {
    name: "Elfos Silvanos",
    code: 4 as PlayerCode,
    shortCode: "X",
    colorName: "Verde",
    colorHex: "#16a34a"
  }
] as const;

export const PRINCIPAL_CELLS = [
  "I17",
  "I19",
  "J16",
  "J18",
  "J20",
  "K19",
  "K17",
];

export const SECONDARY_CELLS = [
  "E11",
  "E23",
  "I31",
  "P26",
  "P18",
  "L8"
];

const SYMBOLS_BY_PLAYER_AND_SUM: Record<PlayerCode, Record<number, string>> = {
  1: {
    3: "A",
    5: "X",
    7: "XA"
  },
  2: {
    3: "K",
    6: "X",
    7: "XK"
  },
  4: {
    5: "K",
    6: "A",
    7: "AK"
  }
};

export function isPlayerCode(value: number | null | undefined): value is PlayerCode {
  return value === 1 || value === 2 || value === 4;
}

export function getFactionByCode(code: number | null | undefined) {
  return FACTIONS.find((faction) => faction.code === code) ?? null;
}

export function getFactionByShortCode(shortCode: string | null | undefined) {
  return FACTIONS.find((faction) => faction.shortCode === shortCode) ?? null;
}

export function isPrincipalCell(cellId: string) {
  return PRINCIPAL_CELLS.includes(cellId);
}

export function isSecondaryCell(cellId: string) {
  return SECONDARY_CELLS.includes(cellId);
}

export function isActiveCellCoordinate(col: string, row: number) {
  const colIndex = BOARD_COLUMNS.indexOf(col);

  if (colIndex === -1 || !BOARD_ROWS.includes(row)) {
    return false;
  }

  if (row === 4) {
    return true;
  }

  if (row % 2 === 1) {
    return colIndex % 2 === 0;
  }

  return colIndex % 2 === 1;
}

export function generateBoardCells(): BoardCell[] {
  return BOARD_ROWS.flatMap((row) =>
    BOARD_COLUMNS.map((col) => {
      const id = `${col}${row}`;
      const zoneTypes: string[] = [];

      if (isPrincipalCell(id)) {
        zoneTypes.push("principal");
      }

      if (isSecondaryCell(id)) {
        zoneTypes.push("secondary");
      }

      return {
        id,
        col,
        row,
        isActive: isActiveCellCoordinate(col, row),
        zoneTypes
      };
    })
  );
}

export function getActiveCells(cells = generateBoardCells()) {
  return cells.filter((cell) => cell.isActive);
}

export function calculateCellSums(moves: MoveLike[], players: PlayerLike[] = []) {
  const playerCodes = new Map<string, number>();
  const cellSums = new Map<string, number>();

  for (const player of players) {
    if (player.id && isPlayerCode(player.code)) {
      playerCodes.set(player.id, player.code);
    }
  }

  for (const move of moves) {
    if (move.occupied === false) {
      continue;
    }

    const code = move.playerCode ?? move.code ?? (move.playerId ? playerCodes.get(move.playerId) : undefined);

    if (!isPlayerCode(code)) {
      continue;
    }

    cellSums.set(move.cellId, (cellSums.get(move.cellId) ?? 0) + code);
  }

  return cellSums;
}

export function getParticipantsFromSum(sumCode: number): PlayerCode[] {
  return FACTIONS.filter((faction) => (sumCode & faction.code) === faction.code).map((faction) => faction.code);
}

export function detectEncounters(cellSums: Map<string, number>): EncounterDetection[] {
  const encounters: EncounterDetection[] = [];

  for (const [cellId, sumCode] of cellSums.entries()) {
    const participantCodes = getParticipantsFromSum(sumCode);

    if (participantCodes.length >= 2) {
      encounters.push({ cellId, sumCode, participantCodes });
    }
  }

  return encounters.sort((left, right) => left.cellId.localeCompare(right.cellId, "en", { numeric: true }));
}

export function detectPrincipalPresence(cellSums: Map<string, number>, principalCells = PRINCIPAL_CELLS) {
  return principalCells
    .filter((cellId) => (cellSums.get(cellId) ?? 0) > 0)
    .map((cellId) => ({
      cellId,
      sumCode: cellSums.get(cellId) ?? 0
    }));
}

export function detectSecondaryPresence(cellSums: Map<string, number>, secondaryCells = SECONDARY_CELLS): PresenceDetection[] {
  return secondaryCells
    .filter((cellId) => (cellSums.get(cellId) ?? 0) > 0)
    .map((cellId) => {
      const sumCode = cellSums.get(cellId) ?? 0;
      const participantCodes = getParticipantsFromSum(sumCode);

      return {
        cellId,
        sumCode,
        participantCodes,
        isWar: participantCodes.length > 1
      };
    });
}

export function getEncounterSymbolForPlayer(playerCode: number, sumCode: number) {
  if (!isPlayerCode(playerCode)) {
    return "";
  }

  return SYMBOLS_BY_PLAYER_AND_SUM[playerCode][sumCode] ?? "";
}

export function getOpponentCodesForPlayer(playerCode: number, sumCode: number) {
  return getParticipantsFromSum(sumCode).filter((code) => code !== playerCode);
}

export function getNextTurnPhase(currentTurn: number, currentPhase: number) {
  if (currentPhase >= 3) {
    return { turnNumber: currentTurn + 1, phaseNumber: 1 };
  }

  return { turnNumber: currentTurn, phaseNumber: currentPhase + 1 };
}

export function advancePhaseIfPossible(
  game: { currentTurn: number; currentPhase: number; currentState: PhaseState },
  encounters: { status: string }[],
  force = false
) {
  if (!force && !["results_available", "encounters_pending", "phase_closed"].includes(game.currentState)) {
    return {
      canAdvance: false,
      reason: "phase_not_ready",
      next: game
    };
  }

  const unresolvedCount = encounters.filter((encounter) => !["resolved", "cancelled"].includes(encounter.status)).length;

  if (!force && unresolvedCount > 0) {
    return {
      canAdvance: false,
      reason: "encounters_pending",
      next: game
    };
  }

  const nextPhase = getNextTurnPhase(game.currentTurn, game.currentPhase);

  return {
    canAdvance: true,
    reason: null,
    next: {
      currentTurn: nextPhase.turnNumber,
      currentPhase: nextPhase.phaseNumber,
      currentState: "movement_open" as PhaseState
    }
  };
}

export function formatParticipantNames(codes: number[]) {
  return codes
    .map((code) => getFactionByCode(code)?.name)
    .filter(Boolean)
    .join(", ");
}
