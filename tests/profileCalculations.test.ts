import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  calculateArmyPoints,
  calculateIngresar,
  calculateInvertir,
  calculateTotalArmyPoints,
  getTopExperienceRanking,
  getTopKillsRanking,
  sanitizeIngresarInputs,
  sanitizeInvertirInputs
} from "../src/lib/profileCalculations.ts";

describe("profile tab calculations", () => {
  test("calculates Invertir formulas and reads E29 from previous Ingresar D16", () => {
    const result = calculateInvertir({
      editableInputs: {
        D3: 2,
        D4: "3",
        E25: "bad",
        E26: 10,
        E27: ""
      },
      previousTurnIngresarD16: 1000
    });

    assert.equal(result.cells.E3, 200);
    assert.equal(result.cells.E4, 450);
    assert.equal(result.cells.E25, 0);
    assert.equal(result.cells.E26, 10);
    assert.equal(result.cells.E28, 660);
    assert.equal(result.cells.E29, 1000);
    assert.equal(result.cells.E30, 340);
  });

  test("calculates Ingresar D16 as D14 plus current Invertir E30", () => {
    const invertir = calculateInvertir({
      editableInputs: {
        D3: 1
      },
      previousTurnIngresarD16: 500
    });
    const ingresar = calculateIngresar({
      editableInputs: {
        D4: 2,
        E4: 1,
        F13: 25
      },
      currentTurnInvertirE30: invertir.cells.E30
    });

    assert.equal(ingresar.cells.F4, 50);
    assert.equal(ingresar.cells.G4, 50);
    assert.equal(ingresar.cells.D14, 125);
    assert.equal(ingresar.cells.D16, 525);
  });

  test("sanitizes editable cells and ignores calculated-cell injection", () => {
    const invertir = sanitizeInvertirInputs({ D3: "2", E30: 9999 });
    const ingresar = sanitizeIngresarInputs({ D4: "4", D16: 9999 });

    assert.equal(invertir.D3, 2);
    assert.equal("E30" in invertir, false);
    assert.equal(ingresar.D4, 4);
    assert.equal("D16" in ingresar, false);
  });

  test("calculates army points without NaN", () => {
    const army = {
      id: "a1",
      name: "Ejercito",
      rows: [{ points: "100", kills: "20" }, { points: "", kills: "10" }, { points: "texto", kills: "abc" }, { points: "25.5", kills: "" }]
    };

    assert.equal(calculateArmyPoints(army), 125.5);
    assert.equal(calculateTotalArmyPoints([army]), 125.5);
  });

  test("builds top kills ranking from all users safely", () => {
    const ranking = getTopKillsRanking([
      {
        userName: "Silvanos",
        armyList: {
          armies: [
            {
              id: "a1",
              name: "A",
              rows: [
                { campaignGeneral: "Thalandor", unitName: "Guardia del Bosque", unitType: "Arquero", kills: "12" },
                { campaignGeneral: "Bosque", unitName: "Exploradores", unitType: "Explorador", kills: "abc" }
              ]
            }
          ]
        }
      },
      {
        userName: "Altos",
        armyList: {
          armies: [
            {
              id: "a2",
              name: "B",
              rows: [
                { campaignGeneral: "Aenarion", unitName: "Lanceros de Plata", unitType: "Lanza", kills: "14" },
                { campaignGeneral: "Otro", unitName: "Guardia del Mar", unitType: "Guardia", kills: "" }
              ]
            }
          ]
        }
      }
    ]);

    assert.deepEqual(ranking, [
      { userName: "Altos", unitName: "Lanceros de Plata", unitType: "Lanza", kills: 14 },
      { userName: "Silvanos", unitName: "Guardia del Bosque", unitType: "Arquero", kills: 12 }
    ]);
  });

  test("builds top experience ranking from units safely", () => {
    const ranking = getTopExperienceRanking([
      {
        userName: "Oscuros",
        armyList: {
          armies: [
            {
              id: "a1",
              name: "A",
              rows: [
                { unitName: "Sombras", xp: "18", rank: "Veteranos", battles: "4" },
                { unitName: "Corsarios", xp: "abc", rank: "Reclutas", battles: "1" }
              ]
            }
          ]
        }
      },
      {
        userName: "Altos",
        armyList: {
          armies: [
            {
              id: "a2",
              name: "B",
              rows: [{ unitName: "Lanceros", xp: "22", rank: "Elite", battles: "5" }]
            }
          ]
        }
      }
    ]);

    assert.deepEqual(ranking, [
      { userName: "Altos", unitName: "Lanceros", experience: "22", rank: "Elite", battles: "5" },
      { userName: "Oscuros", unitName: "Sombras", experience: "18", rank: "Veteranos", battles: "4" }
    ]);
  });
});
