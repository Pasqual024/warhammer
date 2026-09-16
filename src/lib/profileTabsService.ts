import { prisma } from "@/lib/db";
import { getActiveGame } from "@/lib/gameService";
import {
  calculateIngresar,
  calculateInvertir,
  getTopExperienceRanking,
  getTopKillsRanking,
  normalizeArmyListData,
  normalizeDiaryData,
  sanitizeIngresarInputs,
  sanitizeInvertirInputs,
  type ArmyListData,
  type DiaryData,
  type NumericInputs
} from "@/lib/profileCalculations";

type StoredEconomy = {
  turnNumber: number;
  invertirData: string;
  ingresarData: string;
};

function parseJson(value: string | null | undefined, fallback: unknown) {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function stringify(value: unknown) {
  return JSON.stringify(value);
}

function getRankingUserName(player: { username: string; factionName: string }) {
  const username = player.username.toLowerCase();

  if (username.includes("altos")) {
    return "Altos";
  }

  if (username.includes("silvanos")) {
    return "Silvanos";
  }

  if (username.includes("oscuros")) {
    return "Oscuros";
  }

  return player.factionName || player.username;
}

function readInvertirInputs(economy: Pick<StoredEconomy, "invertirData"> | null | undefined) {
  return sanitizeInvertirInputs(parseJson(economy?.invertirData, {}));
}

function readIngresarInputs(economy: Pick<StoredEconomy, "ingresarData"> | null | undefined) {
  return sanitizeIngresarInputs(parseJson(economy?.ingresarData, {}));
}

export async function calculatePreviousTurnIngresarD16(gameId: string, playerId: string, currentTurn: number) {
  if (currentTurn <= 1) {
    return 0;
  }

  const economies = await prisma.playerTurnEconomy.findMany({
    where: {
      gameId,
      playerId,
      turnNumber: { lt: currentTurn }
    },
    orderBy: { turnNumber: "asc" },
    select: {
      turnNumber: true,
      invertirData: true,
      ingresarData: true
    }
  });

  const byTurn = new Map(economies.map((economy) => [economy.turnNumber, economy]));
  let previousD16 = 0;

  for (let turn = 1; turn < currentTurn; turn += 1) {
    const economy = byTurn.get(turn);
    const invertir = calculateInvertir({
      editableInputs: readInvertirInputs(economy),
      previousTurnIngresarD16: previousD16
    });
    const ingresar = calculateIngresar({
      editableInputs: readIngresarInputs(economy),
      currentTurnInvertirE30: invertir.cells.E30
    });

    previousD16 = ingresar.cells.D16;
  }

  return previousD16;
}

export async function getProfileTabsState(playerId: string) {
  const game = await getActiveGame();
  const [profile, economy, previousTurnIngresarD16] = await Promise.all([
    prisma.playerProfileTabs.findUnique({
      where: {
        gameId_playerId: {
          gameId: game.id,
          playerId
        }
      }
    }),
    prisma.playerTurnEconomy.findUnique({
      where: {
        gameId_playerId_turnNumber: {
          gameId: game.id,
          playerId,
          turnNumber: game.currentTurn
        }
      }
    }),
    calculatePreviousTurnIngresarD16(game.id, playerId, game.currentTurn)
  ]);

  const invertirInputs = readInvertirInputs(economy);
  const invertir = calculateInvertir({
    editableInputs: invertirInputs,
    previousTurnIngresarD16
  });
  const ingresarInputs = readIngresarInputs(economy);
  const ingresar = calculateIngresar({
    editableInputs: ingresarInputs,
    currentTurnInvertirE30: invertir.cells.E30
  });

  return {
    game: {
      id: game.id,
      currentTurn: game.currentTurn,
      currentPhase: game.currentPhase
    },
    armyList: normalizeArmyListData(parseJson(profile?.armyListData, { armies: [] })),
    diary: normalizeDiaryData(parseJson(profile?.diaryData, { cells: {} })),
    invertir: {
      editableInputs: invertir.editableInputs,
      calculatedCells: invertir.cells
    },
    ingresar: {
      editableInputs: ingresar.editableInputs,
      calculatedCells: ingresar.cells
    },
    previousTurnIngresarD16
  };
}

export async function getPublicKillsRanking() {
  const game = await getActiveGame();
  const profiles = await prisma.playerProfileTabs.findMany({
    where: {
      gameId: game.id
    },
    include: {
      player: {
        select: {
          username: true,
          factionName: true
        }
      }
    },
    orderBy: {
      updatedAt: "asc"
    }
  });

  return getTopKillsRanking(
    profiles.map((profile) => ({
      userName: getRankingUserName(profile.player),
      armyList: normalizeArmyListData(parseJson(profile.armyListData, { armies: [] }))
    }))
  );
}

export async function getPublicExperienceRanking() {
  const game = await getActiveGame();
  const profiles = await prisma.playerProfileTabs.findMany({
    where: {
      gameId: game.id
    },
    include: {
      player: {
        select: {
          username: true,
          factionName: true
        }
      }
    },
    orderBy: {
      updatedAt: "asc"
    }
  });

  return getTopExperienceRanking(
    profiles.map((profile) => ({
      userName: getRankingUserName(profile.player),
      armyList: normalizeArmyListData(parseJson(profile.armyListData, { armies: [] }))
    }))
  );
}

export async function saveArmyListData(playerId: string, data: unknown) {
  const game = await getActiveGame();
  const armyList = normalizeArmyListData(data);

  await prisma.playerProfileTabs.upsert({
    where: {
      gameId_playerId: {
        gameId: game.id,
        playerId
      }
    },
    update: { armyListData: stringify(armyList) },
    create: {
      gameId: game.id,
      playerId,
      armyListData: stringify(armyList),
      diaryData: stringify({ cells: {} })
    }
  });

  return getProfileTabsState(playerId);
}

export async function saveDiaryData(playerId: string, data: unknown) {
  const game = await getActiveGame();
  const diary = normalizeDiaryData(data);

  await prisma.playerProfileTabs.upsert({
    where: {
      gameId_playerId: {
        gameId: game.id,
        playerId
      }
    },
    update: { diaryData: stringify(diary) },
    create: {
      gameId: game.id,
      playerId,
      armyListData: stringify({ armies: [] }),
      diaryData: stringify(diary)
    }
  });

  return getProfileTabsState(playerId);
}

export async function saveInvertirData(playerId: string, data: NumericInputs) {
  const game = await getActiveGame();

  if (game.currentPhase !== 1) {
    const error = new Error("Disponible solo en Fase 1.");
    Object.assign(error, { status: 403 });
    throw error;
  }

  const editableInputs = sanitizeInvertirInputs(data);

  await prisma.playerTurnEconomy.upsert({
    where: {
      gameId_playerId_turnNumber: {
        gameId: game.id,
        playerId,
        turnNumber: game.currentTurn
      }
    },
    update: { invertirData: stringify(editableInputs) },
    create: {
      gameId: game.id,
      playerId,
      turnNumber: game.currentTurn,
      invertirData: stringify(editableInputs),
      ingresarData: stringify({})
    }
  });

  return getProfileTabsState(playerId);
}

export async function saveIngresarData(playerId: string, data: NumericInputs) {
  const game = await getActiveGame();

  if (game.currentPhase !== 1) {
    const error = new Error("Disponible solo en Fase 1.");
    Object.assign(error, { status: 403 });
    throw error;
  }

  const editableInputs = sanitizeIngresarInputs(data);

  await prisma.playerTurnEconomy.upsert({
    where: {
      gameId_playerId_turnNumber: {
        gameId: game.id,
        playerId,
        turnNumber: game.currentTurn
      }
    },
    update: { ingresarData: stringify(editableInputs) },
    create: {
      gameId: game.id,
      playerId,
      turnNumber: game.currentTurn,
      invertirData: stringify({}),
      ingresarData: stringify(editableInputs)
    }
  });

  return getProfileTabsState(playerId);
}
