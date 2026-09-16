import { prisma } from "@/lib/db";
import {
  advancePhaseIfPossible,
  calculateCellSums,
  detectEncounters,
  detectPrincipalPresence,
  detectSecondaryPresence,
  formatParticipantNames,
  getEncounterSymbolForPlayer,
  getFactionByCode,
  isSecondaryCell,
  type PhaseState
} from "@/lib/gameEngine";
import { AuthError } from "@/lib/auth";

function forbidden(message: string) {
  const error = new AuthError(message);
  error.status = 403;
  return error;
}

function phaseWhere(game: { id: string; currentTurn: number; currentPhase: number }) {
  return {
    gameId: game.id,
    turnNumber: game.currentTurn,
    phaseNumber: game.currentPhase
  };
}

function previousPhaseWhere(game: { id: string; currentTurn: number; currentPhase: number }) {
  if (game.currentPhase > 1) {
    return {
      gameId: game.id,
      turnNumber: game.currentTurn,
      phaseNumber: game.currentPhase - 1
    };
  }

  if (game.currentTurn <= 1) {
    return null;
  }

  return {
    gameId: game.id,
    turnNumber: game.currentTurn - 1,
    phaseNumber: 3
  };
}

export function canShowEncounterCells(currentState: string) {
  return ["results_available", "encounters_pending", "phase_closed"].includes(currentState);
}

export async function getActiveGame() {
  const game = await prisma.game.findFirst({ where: { status: "active" }, orderBy: { createdAt: "asc" } });

  if (!game) {
    throw new Error("No active game found. Run the Prisma seed first.");
  }

  return game;
}

export async function getPlayerRoster() {
  return prisma.player.findMany({
    where: { role: "player" },
    orderBy: { code: "asc" },
    select: {
      id: true,
      username: true,
      factionName: true,
      code: true,
      shortCode: true,
      colorName: true,
      colorHex: true
    }
  });
}

export async function getCurrentGameSummary() {
  const game = await getActiveGame();
  const players = await getPlayerRoster();
  const submissions = await prisma.phaseSubmission.findMany({
    where: phaseWhere(game),
    include: {
      player: {
        select: {
          id: true,
          factionName: true,
          colorHex: true,
          colorName: true
        }
      }
    },
    orderBy: { submittedAt: "asc" }
  });

  return {
    game,
    players,
    submissions,
    requiredSubmissions: players.length
  };
}

export async function getMyMovesState(playerId: string) {
  const game = await getActiveGame();
  const [moves, submission] = await Promise.all([
    prisma.move.findMany({
      where: {
        ...phaseWhere(game),
        playerId,
        occupied: true
      },
      select: { cellId: true },
      orderBy: { cellId: "asc" }
    }),
    prisma.phaseSubmission.findUnique({
      where: {
        gameId_turnNumber_phaseNumber_playerId: {
          ...phaseWhere(game),
          playerId
        }
      }
    })
  ]);

  return {
    turnNumber: game.currentTurn,
    phaseNumber: game.currentPhase,
    state: game.currentState,
    selectedCellIds: moves.map((move) => move.cellId),
    submittedAt: submission?.submittedAt ?? null,
    isSubmitted: Boolean(submission),
    isLocked: Boolean(submission) || !["movement_open", "waiting_for_players"].includes(game.currentState)
  };
}

export async function toggleMyMove(playerId: string, cellId: string) {
  const game = await getActiveGame();

  if (!["movement_open", "waiting_for_players"].includes(game.currentState)) {
    throw forbidden("Movements are locked for this phase.");
  }

  const [cell, submission, existing] = await Promise.all([
    prisma.cell.findUnique({ where: { id: cellId } }),
    prisma.phaseSubmission.findUnique({
      where: {
        gameId_turnNumber_phaseNumber_playerId: {
          ...phaseWhere(game),
          playerId
        }
      }
    }),
    prisma.move.findUnique({
      where: {
        gameId_turnNumber_phaseNumber_playerId_cellId: {
          ...phaseWhere(game),
          playerId,
          cellId
        }
      }
    })
  ]);

  if (!cell?.isActive) {
    throw new Error("Cell is not active.");
  }

  if (submission) {
    throw forbidden("Movements already confirmed for this phase.");
  }

  const occupied = !existing?.occupied;

  await prisma.move.upsert({
    where: {
      gameId_turnNumber_phaseNumber_playerId_cellId: {
        ...phaseWhere(game),
        playerId,
        cellId
      }
    },
    update: { occupied },
    create: {
      ...phaseWhere(game),
      playerId,
      cellId,
      occupied
    }
  });

  return getMyMovesState(playerId);
}

export async function submitMyMoves(playerId: string) {
  const game = await getActiveGame();

  if (!["movement_open", "waiting_for_players"].includes(game.currentState)) {
    throw forbidden("This phase is no longer accepting movement submissions.");
  }

  await prisma.phaseSubmission.create({
    data: {
      ...phaseWhere(game),
      playerId
    }
  }).catch((error: unknown) => {
    if (error instanceof Error) {
      throw forbidden("Movements already confirmed for this phase.");
    }
    throw error;
  });

  const [requiredCount, submittedCount] = await Promise.all([
    prisma.player.count({ where: { role: "player" } }),
    prisma.phaseSubmission.count({ where: phaseWhere(game) })
  ]);

  if (submittedCount >= requiredCount) {
    await prisma.game.update({
      where: { id: game.id },
      data: { currentState: "calculating_results" }
    });

    const result = await recalculateCurrentPhase();

    if (result.encounterCount === 0) {
      const nextGame = await advanceCurrentPhase(false);

      return {
        ...result,
        advanced: true,
        nextTurn: nextGame.currentTurn,
        nextPhase: nextGame.currentPhase
      };
    }

    return {
      ...result,
      advanced: false
    };
  }

  await prisma.game.update({
    where: { id: game.id },
    data: { currentState: "waiting_for_players" }
  });

  return {
    calculated: false,
    submittedCount,
    requiredCount
  };
}

async function clearPhaseResults(game: { id: string; currentTurn: number; currentPhase: number }) {
  const where = phaseWhere(game);
  const priorEncounters = await prisma.encounter.findMany({
    where,
    select: { id: true }
  });
  const encounterIds = priorEncounters.map((encounter) => encounter.id);

  if (encounterIds.length > 0) {
    await prisma.encounterResolutionConfirmation.deleteMany({ where: { encounterId: { in: encounterIds } } });
    await prisma.encounterParticipant.deleteMany({ where: { encounterId: { in: encounterIds } } });
    await prisma.encounter.deleteMany({ where: { id: { in: encounterIds } } });
  }

  await prisma.phaseAnnouncement.deleteMany({ where });
}

export async function recalculateCurrentPhase() {
  const game = await getActiveGame();
  const where = phaseWhere(game);

  await clearPhaseResults(game);

  const [players, moves] = await Promise.all([
    getPlayerRoster(),
    prisma.move.findMany({
      where: {
        ...where,
        occupied: true
      },
      select: {
        playerId: true,
        cellId: true,
        occupied: true
      }
    })
  ]);

  const cellSums = calculateCellSums(moves, players);
  const principalPresence = detectPrincipalPresence(cellSums);
  const secondaryPresence = detectSecondaryPresence(cellSums);
  const encounters = detectEncounters(cellSums);

  const announcements = [
    ...principalPresence.map((presence) => ({
      ...where,
      type: "principal",
      cellId: presence.cellId,
      message: `Presencia en zona Principal: ${presence.cellId}`,
      visibility: "public"
    })),
    ...secondaryPresence.map((presence) => {
      if (presence.isWar) {
        return {
          ...where,
          type: "secondary_war",
          cellId: presence.cellId,
          message: `WAR en zona Secundaria: ${presence.cellId}`,
          visibility: "public"
        };
      }

      const faction = getFactionByCode(presence.participantCodes[0]);

      return {
        ...where,
        type: "secondary",
        cellId: presence.cellId,
        message: `Zona Secundaria ${presence.cellId}: ${faction?.name ?? "Presencia"} (${faction?.colorName ?? "color"})`,
        visibility: "public"
      };
    })
  ];

  if (announcements.length > 0) {
    await prisma.phaseAnnouncement.createMany({ data: announcements });
  }

  for (const encounter of encounters) {
    const participantPlayers = encounter.participantCodes
      .map((code) => players.find((player) => player.code === code))
      .filter(Boolean);

    if (participantPlayers.length < 2) {
      continue;
    }

    await prisma.encounter.create({
      data: {
        ...where,
        cellId: encounter.cellId,
        sumCode: encounter.sumCode,
        status: "pending",
        participants: {
          create: participantPlayers.map((player) => ({
            playerId: player!.id
          }))
        }
      }
    });
  }

  await prisma.game.update({
    where: { id: game.id },
    data: {
      currentState: encounters.length > 0 ? "encounters_pending" : "results_available"
    }
  });

  return {
    calculated: true,
    principalPresenceCount: principalPresence.length,
    secondaryPresenceCount: secondaryPresence.length,
    encounterCount: encounters.length
  };
}

export async function getCurrentAnnouncements() {
  const game = await getActiveGame();
  const currentAnnouncements = await prisma.phaseAnnouncement.findMany({
    where: phaseWhere(game),
    orderBy: [{ type: "asc" }, { cellId: "asc" }]
  });

  if (currentAnnouncements.length > 0 || game.currentState !== "movement_open") {
    return currentAnnouncements;
  }

  const previousWhere = previousPhaseWhere(game);

  if (!previousWhere) {
    return [];
  }

  return prisma.phaseAnnouncement.findMany({
    where: previousWhere,
    orderBy: [{ type: "asc" }, { cellId: "asc" }]
  });
}

export async function getMyEncounters(playerId: string, role: string) {
  const player = await prisma.player.findUnique({ where: { id: playerId } });

  if (!player) {
    throw new Error("Player not found.");
  }

  const encounters = await prisma.encounter.findMany({
    where:
      role === "superadmin"
        ? {}
        : {
            participants: {
              some: { playerId }
            }
          },
    include: {
      participants: {
        include: {
          player: {
            select: {
              id: true,
              factionName: true,
              code: true,
              shortCode: true,
              colorName: true,
              colorHex: true
            }
          }
        },
        orderBy: {
          player: {
            code: "asc"
          }
        }
      },
      confirmations: {
        include: {
          player: {
            select: {
              id: true,
              factionName: true
            }
          }
        }
      },
      winnerPlayer: {
        select: {
          id: true,
          factionName: true
        }
      }
    },
    orderBy: [{ turnNumber: "desc" }, { phaseNumber: "desc" }, { cellId: "asc" }]
  });

  return encounters.map((encounter) => {
    const participantPlayers = encounter.participants.map((participant) => participant.player);
    const opponentPlayers = participantPlayers.filter((participant) => participant.id !== playerId);
    const participantCodes = participantPlayers.map((participant) => participant.code).filter((code): code is number => typeof code === "number");
    const isWar = isSecondaryCell(encounter.cellId) && participantPlayers.length > 1;

    return {
      id: encounter.id,
      turnNumber: encounter.turnNumber,
      phaseNumber: encounter.phaseNumber,
      cellId: encounter.cellId,
      sumCode: encounter.sumCode,
      status: encounter.status,
      symbol: player.code ? getEncounterSymbolForPlayer(player.code, encounter.sumCode) : "",
      opponents: opponentPlayers,
      participants: participantPlayers,
      isSecondaryWar: isWar,
      warLabel: isWar ? `WAR: ${formatParticipantNames(participantCodes)}` : null,
      resolutionNotes: encounter.resolutionNotes,
      winnerPlayer: encounter.winnerPlayer,
      resolvedAt: encounter.resolvedAt,
      confirmations: encounter.confirmations.map((confirmation) => ({
        playerId: confirmation.playerId,
        factionName: confirmation.player.factionName,
        confirmedAt: confirmation.confirmedAt
      }))
    };
  });
}

export async function getVisibleEncounterCells() {
  const game = await getActiveGame();

  if (!canShowEncounterCells(game.currentState)) {
    return {
      canShowEncounters: false,
      encounterCellIds: []
    };
  }

  const encounters = await prisma.encounter.findMany({
    where: phaseWhere(game),
    select: {
      cellId: true
    },
    orderBy: {
      cellId: "asc"
    }
  });

  return {
    canShowEncounters: true,
    encounterCellIds: Array.from(new Set(encounters.map((encounter) => encounter.cellId)))
  };
}

export async function markEncounterInProgress(encounterId: string, playerId: string, role: string) {
  const encounter = await prisma.encounter.findUnique({
    where: { id: encounterId },
    include: { participants: true }
  });

  if (!encounter) {
    throw new Error("Encounter not found.");
  }

  const participantIds = encounter.participants.map((participant) => participant.playerId);

  if (role !== "superadmin" && !participantIds.includes(playerId)) {
    throw forbidden("You cannot update this encounter.");
  }

  return prisma.encounter.update({
    where: { id: encounterId },
    data: { status: "in_progress" }
  });
}

export async function resolveEncounter(
  encounterId: string,
  playerId: string,
  role: string,
  input: { status?: string; winnerPlayerId?: string | null; resolutionNotes?: string | null }
) {
  const encounter = await prisma.encounter.findUnique({
    where: { id: encounterId },
    include: { participants: true }
  });

  if (!encounter) {
    throw new Error("Encounter not found.");
  }

  const participantIds = encounter.participants.map((participant) => participant.playerId);

  if (role !== "superadmin" && !participantIds.includes(playerId)) {
    throw forbidden("You cannot resolve this encounter.");
  }

  if (input.winnerPlayerId && !participantIds.includes(input.winnerPlayerId)) {
    throw new Error("Winner must be one of the encounter participants.");
  }

  const status = input.status === "cancelled" ? "cancelled" : "resolved";

  await prisma.encounter.update({
    where: { id: encounterId },
    data: {
      status,
      winnerPlayerId: input.winnerPlayerId || null,
      resolutionNotes: input.resolutionNotes?.trim() || null,
      resolvedAt: new Date()
    }
  });

  if (role !== "superadmin") {
    await prisma.encounterResolutionConfirmation.upsert({
      where: {
        encounterId_playerId: {
          encounterId,
          playerId
        }
      },
      update: { confirmedAt: new Date() },
      create: {
        encounterId,
        playerId
      }
    });
  }

  const game = await getActiveGame();
  const unresolvedCount = await prisma.encounter.count({
    where: {
      ...phaseWhere(game),
      status: {
        notIn: ["resolved", "cancelled"]
      }
    }
  });

  if (unresolvedCount === 0 && game.currentState === "encounters_pending") {
    await advanceCurrentPhase(false);
  }

  return getMyEncounters(playerId, role);
}

export async function advanceCurrentPhase(force = false) {
  const game = await getActiveGame();
  const encounters = await prisma.encounter.findMany({
    where: phaseWhere(game),
    select: { status: true }
  });
  const decision = advancePhaseIfPossible(
    {
      currentTurn: game.currentTurn,
      currentPhase: game.currentPhase,
      currentState: game.currentState as PhaseState
    },
    encounters,
    force
  );

  if (!decision.canAdvance) {
    throw forbidden("Cannot advance phase while encounters are pending.");
  }

  const occupiedMoves = await prisma.move.findMany({
    where: {
      ...phaseWhere(game),
      occupied: true
    },
    select: {
      playerId: true,
      cellId: true
    }
  });

  return prisma.$transaction(async (tx) => {
    const updatedGame = await tx.game.update({
      where: { id: game.id },
      data: {
        currentTurn: decision.next.currentTurn,
        currentPhase: decision.next.currentPhase,
        currentState: decision.next.currentState
      }
    });

    for (const move of occupiedMoves) {
      await tx.move.upsert({
        where: {
          gameId_turnNumber_phaseNumber_playerId_cellId: {
            gameId: game.id,
            turnNumber: decision.next.currentTurn,
            phaseNumber: decision.next.currentPhase,
            playerId: move.playerId,
            cellId: move.cellId
          }
        },
        update: { occupied: true },
        create: {
          gameId: game.id,
          turnNumber: decision.next.currentTurn,
          phaseNumber: decision.next.currentPhase,
          playerId: move.playerId,
          cellId: move.cellId,
          occupied: true
        }
      });
    }

    return updatedGame;
  });
}

export async function resetActiveGame() {
  const game = await getActiveGame();
  const encounters = await prisma.encounter.findMany({
    where: { gameId: game.id },
    select: { id: true }
  });
  const encounterIds = encounters.map((encounter) => encounter.id);

  return prisma.$transaction(async (tx) => {
    if (encounterIds.length > 0) {
      await tx.encounterResolutionConfirmation.deleteMany({ where: { encounterId: { in: encounterIds } } });
      await tx.encounterParticipant.deleteMany({ where: { encounterId: { in: encounterIds } } });
      await tx.encounter.deleteMany({ where: { id: { in: encounterIds } } });
    }

    await tx.phaseAnnouncement.deleteMany({ where: { gameId: game.id } });
    await tx.phaseSubmission.deleteMany({ where: { gameId: game.id } });
    await tx.move.deleteMany({ where: { gameId: game.id } });

    return tx.game.update({
      where: { id: game.id },
      data: {
        currentTurn: 1,
        currentPhase: 1,
        currentState: "movement_open",
        status: "active"
      }
    });
  });
}
