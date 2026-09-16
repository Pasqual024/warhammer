import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { FACTIONS, generateBoardCells, PRINCIPAL_CELLS, SECONDARY_CELLS } from "../src/lib/gameEngine";

const prisma = new PrismaClient();

async function upsertPlayer(input: {
  username: string;
  password: string;
  factionName: string;
  code: number | null;
  shortCode: string | null;
  colorName: string | null;
  colorHex: string | null;
  role: string;
}) {
  const passwordHash = await bcrypt.hash(input.password, 12);

  return prisma.player.upsert({
    where: { username: input.username },
    update: {
      passwordHash,
      factionName: input.factionName,
      code: input.code,
      shortCode: input.shortCode,
      colorName: input.colorName,
      colorHex: input.colorHex,
      role: input.role
    },
    create: {
      username: input.username,
      passwordHash,
      factionName: input.factionName,
      code: input.code,
      shortCode: input.shortCode,
      colorName: input.colorName,
      colorHex: input.colorHex,
      role: input.role
    }
  });
}

async function upsertZone(name: string, type: string, cellIds: string[], colorRule: string) {
  const zone = await prisma.specialZone.upsert({
    where: {
      name_type: {
        name,
        type
      }
    },
    update: { colorRule },
    create: {
      name,
      type,
      colorRule
    }
  });

  await prisma.specialZoneCell.deleteMany({ where: { zoneId: zone.id } });
  await prisma.specialZoneCell.createMany({
    data: cellIds.map((cellId) => ({
      zoneId: zone.id,
      cellId
    }))
  });

  return zone;
}

async function main() {
  await Promise.all(
    generateBoardCells().map((cell) =>
      prisma.cell.upsert({
        where: { id: cell.id },
        update: {
          col: cell.col,
          row: cell.row,
          isActive: cell.isActive
        },
        create: {
          id: cell.id,
          col: cell.col,
          row: cell.row,
          isActive: cell.isActive
        }
      })
    )
  );

  await upsertPlayer({
    username: "altos",
    password: "altos123",
    factionName: FACTIONS[0].name,
    code: FACTIONS[0].code,
    shortCode: FACTIONS[0].shortCode,
    colorName: FACTIONS[0].colorName,
    colorHex: FACTIONS[0].colorHex,
    role: "player"
  });

  await upsertPlayer({
    username: "oscuros",
    password: "oscuros123",
    factionName: FACTIONS[1].name,
    code: FACTIONS[1].code,
    shortCode: FACTIONS[1].shortCode,
    colorName: FACTIONS[1].colorName,
    colorHex: FACTIONS[1].colorHex,
    role: "player"
  });

  await upsertPlayer({
    username: "silvanos",
    password: "silvanos123",
    factionName: FACTIONS[2].name,
    code: FACTIONS[2].code,
    shortCode: FACTIONS[2].shortCode,
    colorName: FACTIONS[2].colorName,
    colorHex: FACTIONS[2].colorHex,
    role: "player"
  });

  await upsertPlayer({
    username: "admin",
    password: "admin123",
    factionName: "Administrador",
    code: null,
    shortCode: null,
    colorName: null,
    colorHex: null,
    role: "superadmin"
  });

  await upsertZone("Principal", "principal", PRINCIPAL_CELLS, "public_coordinate_no_identity");
  await upsertZone("Secundarias", "secondary", SECONDARY_CELLS, "identity_or_private_war");

  const existingActiveGame = await prisma.game.findFirst({ where: { status: "active" } });

  if (!existingActiveGame) {
    await prisma.game.create({
      data: {
        name: "Partida principal",
        currentTurn: 1,
        currentPhase: 1,
        currentState: "movement_open",
        status: "active"
      }
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
