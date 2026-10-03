export type NumericInputs = Record<string, unknown>;

export type ArmyRowData = Record<string, string>;

export type ArmyData = {
  id: string;
  name: string;
  collapsed?: boolean;
  rows: ArmyRowData[];
};

export type ArmyListData = {
  armies: ArmyData[];
};

export type DiaryData = {
  cells: Record<string, string>;
};

export type KillsRankingSource = {
  userName: string;
  armyList: ArmyListData;
};

export type KillsRankingItem = {
  userName: string;
  unitName: string;
  unitType: string;
  kills: number;
};

export type ExperienceRankingSource = {
  userName: string;
  armyList: ArmyListData;
};

export type ExperienceRankingItem = {
  userName: string;
  unitName: string;
  experience: string;
  rank: string;
  battles: string;
};

export type InvertirCalculation = {
  cells: Record<string, number>;
  editableInputs: Record<string, number>;
};

export type IngresarCalculation = {
  cells: Record<string, number>;
  editableInputs: Record<string, number>;
};

export const ARMY_COLUMNS = [
  { key: "armyName", label: "NOMBRE EJERCITO" },
  { key: "campaignGeneral", label: "NOMBRE GENERAL CAMPAÑA" },
  { key: "kills", label: "Muertes" },
  { key: "secondaryCharacters", label: "NOMBRE PERSONAJES SECUNDRIOS" },
  { key: "unitName", label: "NOMBRE UNIDADES" },
  { key: "unitType", label: "TIPO UNIDAD" },
  { key: "magicLore", label: "SABER DE MAGIA" },
  { key: "mageLevel", label: "NIVEL MAGO" },
  { key: "health", label: "H (x/totals)" },
  { key: "hunger", label: "NIVEL HAMBRE" },
  { key: "mounts", label: "MONTURAS" },
  { key: "commandGroup", label: "GRUPO MANDO" },
  { key: "equipment", label: "EQUIPAMIENTO" },
  { key: "magicItems", label: "OBJ MAGICOS" },
  { key: "xp", label: "EXPERIENCIA (XP)" },
  { key: "rank", label: "RANGO (XP)" },
  { key: "battles", label: "Nº BATLLAS" },
  { key: "attributeImprovements", label: "MEJORAS ATRIBUTOS ADQUIRIDAS" },
  { key: "specialRules", label: "REGLAS ESPECIALES ADQUIRIDAS" },
  { key: "points", label: "PUNTOS", numeric: true }
] as const;

export const INVERTIR_ROWS = [
  { row: 3, label: "CAMPAMENTO", cost: 100, turns: 1 },
  { row: 4, label: "Talaia 1", cost: 150, turns: 1 },
  { row: 5, label: "Talaia 2 (+ cost)", cost: 75, turns: 1 },
  { row: 6, label: "Talaia 3 (+ cost)", cost: 100, turns: 1 },
  { row: 7, label: "POBLADO", cost: 300, turns: 2 },
  { row: 8, label: "Mercado", cost: 250, turns: 1 },
  { row: 9, label: "Templo", cost: 200, turns: 1 },
  { row: 10, label: "Escuela de Magia", cost: 200, turns: 1 },
  { row: 11, label: "Quadra", cost: 150, turns: 1 },
  { row: 12, label: "Herreria", cost: 150, turns: 1 },
  { row: 13, label: "Granja", cost: 175, turns: 1 },
  { row: 14, label: "Constr. Magica", cost: 300, turns: 1 },
  { row: 15, label: "Fragua", cost: 150, turns: 1 },
  { row: 16, label: "E. de Guerra I", cost: 200, turns: 1 },
  { row: 17, label: "Puerto", cost: 600, turns: 2 },
  { row: 18, label: "Barco pequeño", cost: 500, turns: 1 },
  { row: 19, label: "Barco grande", cost: 1000, turns: 2 },
  { row: 20, label: "CIUDAD", cost: 1300, turns: 3 },
  { row: 21, label: "Marabilla", cost: 900, turns: 3 },
  { row: 22, label: "Uni de Magia", cost: 400, turns: 2 },
  { row: 23, label: "E. de Guerra II", cost: 400, turns: 2 },
  { row: 24, label: "Fortificación", cost: 1500, turns: 3 }
] as const;

export const INVERTIR_EXTRA_ROWS = [
  { row: 25, label: "COMIDA UNIDADES:" },
  { row: 26, label: "TASA POR TERRITORIO EXTRA A PARTIR DEL 20" },
  { row: 27, label: "CREAR UNIDADES Y OBJETOS MAG.:" }
] as const;

export const INGRESAR_ROWS = [
  { row: 4, label: "CAMPAMENTO", base: 25, region: 50 },
  { row: 5, label: "POBLADO", base: 75, region: 150 },
  { row: 6, label: "Mercado", base: 50, region: 100 },
  { row: 7, label: "Templo", base: 40, region: 80 },
  { row: 8, label: "Puerto", base: 150, region: 300 },
  { row: 11, label: "CIUDAD", base: 350, region: 700 },
  { row: 12, label: "Marabilla", base: 300, region: 600 }
] as const;

export const DIARY_FIXED_ROWS = [
  { row: 1, a: "DIARIO DE CAMPAÑA", b: "" },
  { row: 2, a: "TURNOS:", b: "" },
  { row: 3, a: "A- PREPARACIÓN:", b: "" },
  { row: 4, a: "1º", b: "SANAR" },
  { row: 5, a: "2º", b: "MANTENIMIENTO TROPAS" },
  { row: 6, a: "3º", b: "DIVISIÓN & COMBINACIÓN EJERCITOS" },
  { row: 7, a: "B- INVERTIR:", b: "" },
  { row: 8, a: "1º", b: "CONSTRUCCIONES" },
  { row: 9, a: "2º", b: "UNIDADES" },
  { row: 10, a: "3º", b: "OBJETOS MAGICOS Y MEJORAS" },
  { row: 11, a: "C- INGRESAR:", b: "" },
  { row: 12, a: "", b: "TERRITORIOS, BATALLAS, CONSTRUCCIONES" },
  { row: 13, a: "D- MOVIMIENTO (Casilla inicial a final):", b: "" },
  { row: 14, a: "", b: "EJERCITOS:" },
  { row: 15, a: "E- ENCUENTROS:", b: "" },
  { row: 16, a: "", b: "BATALLAS: (Nombre y puntos enemigo / resultado / % bajas)" },
  { row: 17, a: "", b: "EJERCITOS:" },
  { row: 18, a: "", b: "HUIDAS: (a que casilla se huye / % bajas)" },
  { row: 19, a: "", b: "EJERCITOS:" },
  ...Array.from({ length: 13 }, (_, index) => ({ row: index + 20, a: "", b: "" }))
] as const;

export function toNumber(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const normalized = value.trim().replace(",", ".");
    if (!normalized) {
      return 0;
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

export function sanitizeInvertirInputs(inputs: NumericInputs = {}) {
  const sanitized: Record<string, number> = {};

  for (const row of INVERTIR_ROWS) {
    sanitized[`D${row.row}`] = toNumber(inputs[`D${row.row}`]);
  }

  for (const row of INVERTIR_EXTRA_ROWS) {
    sanitized[`E${row.row}`] = toNumber(inputs[`E${row.row}`]);
  }

  return sanitized;
}

export function sanitizeIngresarInputs(inputs: NumericInputs = {}) {
  const sanitized: Record<string, number> = {};

  for (const row of INGRESAR_ROWS) {
    sanitized[`D${row.row}`] = toNumber(inputs[`D${row.row}`]);
    sanitized[`E${row.row}`] = toNumber(inputs[`E${row.row}`]);
  }

  sanitized.F13 = toNumber(inputs.F13);
  return sanitized;
}

export function calculateInvertir({
  editableInputs = {},
  previousTurnIngresarD16 = 0
}: {
  editableInputs?: NumericInputs;
  previousTurnIngresarD16?: unknown;
}): InvertirCalculation {
  const inputs = sanitizeInvertirInputs(editableInputs);
  const cells: Record<string, number> = {};

  for (const row of INVERTIR_ROWS) {
    cells[`E${row.row}`] = row.cost * inputs[`D${row.row}`];
  }

  for (const row of INVERTIR_EXTRA_ROWS) {
    cells[`E${row.row}`] = inputs[`E${row.row}`];
  }

  cells.E28 = Object.entries(cells)
    .filter(([cell]) => /^E([3-9]|1[0-9]|2[0-7])$/.test(cell))
    .reduce((total, [, value]) => total + value, 0);
  cells.E29 = toNumber(previousTurnIngresarD16);
  cells.E30 = cells.E29 - cells.E28;

  return { cells, editableInputs: inputs };
}

export function calculateIngresar({
  editableInputs = {},
  currentTurnInvertirE30 = 0
}: {
  editableInputs?: NumericInputs;
  currentTurnInvertirE30?: unknown;
}): IngresarCalculation {
  const inputs = sanitizeIngresarInputs(editableInputs);
  const cells: Record<string, number> = {};

  for (const row of INGRESAR_ROWS) {
    cells[`F${row.row}`] = row.base * inputs[`D${row.row}`];
    cells[`G${row.row}`] = row.region * inputs[`E${row.row}`];
  }

  cells.F13 = inputs.F13;
  const incomeCellsTotal = Object.entries(cells)
    .filter(([cell]) => /^([FG])([4-8]|1[1-3])$/.test(cell))
    .reduce((total, [, value]) => total + value, 0);

  cells.D14 = incomeCellsTotal;
  cells.D16 = cells.D14 + toNumber(currentTurnInvertirE30);

  return { cells, editableInputs: inputs };
}

export function calculateArmyPoints(army: ArmyData) {
  return army.rows.reduce((total, row) => total + toNumber(row.points), 0);
}

export function calculateTotalArmyPoints(armies: ArmyData[] = []) {
  return armies.reduce((total, army) => total + calculateArmyPoints(army), 0);
}

export function getTopKillsRanking(sources: KillsRankingSource[] = []): KillsRankingItem[] {
  return sources
    .flatMap((source, sourceIndex) =>
      source.armyList.armies.flatMap((army, armyIndex) =>
        army.rows.map((row, rowIndex) => ({
          userName: source.userName,
          unitName: String(row.unitName ?? ""),
          unitType: String(row.unitType ?? ""),
          kills: toNumber(row.kills),
          stableIndex: `${sourceIndex}:${armyIndex}:${rowIndex}`
        }))
      )
    )
    .filter((item) => item.kills > 0)
    .sort((a, b) => {
      if (b.kills !== a.kills) {
        return b.kills - a.kills;
      }

      const byUser = a.userName.localeCompare(b.userName);
      if (byUser !== 0) {
        return byUser;
      }

      const byUnit = a.unitName.localeCompare(b.unitName);
      if (byUnit !== 0) {
        return byUnit;
      }

      return a.stableIndex.localeCompare(b.stableIndex);
    })
    .slice(0, 5)
    .map(({ userName, unitName, unitType, kills }) => ({ userName, unitName, unitType, kills }));
}

export function getTopExperienceRanking(sources: ExperienceRankingSource[] = []): ExperienceRankingItem[] {
  return sources
    .flatMap((source, sourceIndex) =>
      source.armyList.armies.flatMap((army, armyIndex) =>
        army.rows.map((row, rowIndex) => ({
          userName: source.userName,
          unitName: String(row.unitName ?? ""),
          experience: String(row.xp ?? ""),
          rank: String(row.rank ?? ""),
          battles: String(row.battles ?? ""),
          experienceValue: toNumber(row.xp),
          stableIndex: `${sourceIndex}:${armyIndex}:${rowIndex}`
        }))
      )
    )
    .filter((item) => item.experienceValue > 0)
    .sort((a, b) => {
      if (b.experienceValue !== a.experienceValue) {
        return b.experienceValue - a.experienceValue;
      }

      const byUser = a.userName.localeCompare(b.userName);
      if (byUser !== 0) {
        return byUser;
      }

      const byUnit = a.unitName.localeCompare(b.unitName);
      if (byUnit !== 0) {
        return byUnit;
      }

      return a.stableIndex.localeCompare(b.stableIndex);
    })
    .slice(0, 5)
    .map(({ userName, unitName, experience, rank, battles }) => ({ userName, unitName, experience, rank, battles }));
}

export function normalizeArmyListData(value: unknown): ArmyListData {
  if (!value || typeof value !== "object" || !Array.isArray((value as ArmyListData).armies)) {
    return { armies: [] };
  }

  return {
    armies: (value as ArmyListData).armies.map((army, index) => ({
      id: String(army.id || `army-${index + 1}`),
      name: String(army.name || `Ejercito ${index + 1}`),
      collapsed: Boolean(army.collapsed),
      rows: Array.isArray(army.rows)
        ? army.rows.map((row) => {
            const next: ArmyRowData = {};
            for (const column of ARMY_COLUMNS) {
              next[column.key] = "numeric" in column && column.numeric ? String(toNumber(row[column.key])) : String(row[column.key] ?? "");
            }
            return next;
          })
        : []
    }))
  };
}

export function normalizeDiaryData(value: unknown): DiaryData {
  if (!value || typeof value !== "object") {
    return { cells: {} };
  }

  const cells = (value as DiaryData).cells;
  if (!cells || typeof cells !== "object") {
    return { cells: {} };
  }

  return {
    cells: Object.fromEntries(Object.entries(cells).map(([key, cellValue]) => [key, String(cellValue ?? "").slice(0, 1000)]))
  };
}
