import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  calculateCellSums,
  detectEncounters,
  detectPrincipalPresence,
  detectSecondaryPresence,
  generateBoardCells,
  getActiveCells,
  getEncounterSymbolForPlayer,
  getParticipantsFromSum
} from "../src/lib/gameEngine.ts";

describe("board generation", () => {
  test("generates 314 active cells", () => {
    const cells = generateBoardCells();
    assert.equal(getActiveCells(cells).length, 314);
  });

  test("generates expected active cells by row shape", () => {
    const cells = generateBoardCells();

    assert.equal(cells.filter((cell) => cell.row === 4 && cell.isActive).length, 19);
    assert.equal(cells.filter((cell) => cell.row === 5 && cell.isActive).length, 10);
    assert.equal(cells.filter((cell) => cell.row === 6 && cell.isActive).length, 9);
  });
});

describe("code combinations", () => {
  const players = [
    { id: "altos", code: 1 },
    { id: "oscuros", code: 2 },
    { id: "silvanos", code: 4 }
  ];

  test("calculates sums from player codes", () => {
    const sums = calculateCellSums(
      [
        { playerId: "altos", cellId: "A4" },
        { playerId: "oscuros", cellId: "A4" },
        { playerId: "altos", cellId: "C5" },
        { playerId: "silvanos", cellId: "C5" },
        { playerId: "oscuros", cellId: "B6" },
        { playerId: "silvanos", cellId: "B6" },
        { playerId: "altos", cellId: "S4" },
        { playerId: "oscuros", cellId: "S4" },
        { playerId: "silvanos", cellId: "S4" }
      ],
      players
    );

    assert.equal(sums.get("A4"), 3);
    assert.equal(sums.get("C5"), 5);
    assert.equal(sums.get("B6"), 6);
    assert.equal(sums.get("S4"), 7);
  });

  test("returns participants from sum codes", () => {
    assert.deepEqual(getParticipantsFromSum(3), [1, 2]);
    assert.deepEqual(getParticipantsFromSum(5), [1, 4]);
    assert.deepEqual(getParticipantsFromSum(6), [2, 4]);
    assert.deepEqual(getParticipantsFromSum(7), [1, 2, 4]);
  });
});

describe("encounter symbols", () => {
  test("shows Excel-compatible symbols for Altos Elfos", () => {
    assert.equal(getEncounterSymbolForPlayer(1, 3), "A");
    assert.equal(getEncounterSymbolForPlayer(1, 5), "X");
    assert.equal(getEncounterSymbolForPlayer(1, 7), "XA");
  });

  test("shows Excel-compatible symbols for Elfos Oscuros", () => {
    assert.equal(getEncounterSymbolForPlayer(2, 3), "K");
    assert.equal(getEncounterSymbolForPlayer(2, 6), "X");
    assert.equal(getEncounterSymbolForPlayer(2, 7), "XK");
  });

  test("shows Excel-compatible symbols for Elfos Silvanos", () => {
    assert.equal(getEncounterSymbolForPlayer(4, 5), "K");
    assert.equal(getEncounterSymbolForPlayer(4, 6), "A");
    assert.equal(getEncounterSymbolForPlayer(4, 7), "AK");
  });
});

describe("special zone detection", () => {
  test("detects principal presence by exact coordinate", () => {
    const sums = new Map([
      ["I17", 1],
      ["A4", 7]
    ]);

    assert.deepEqual(detectPrincipalPresence(sums), [{ cellId: "I17", sumCode: 1 }]);
  });

  test("detects secondary WAR when several factions occupy the same cell", () => {
    const sums = new Map([
      ["E11", 1],
      ["P18", 5]
    ]);

    assert.deepEqual(detectSecondaryPresence(sums), [
      { cellId: "E11", sumCode: 1, participantCodes: [1], isWar: false },
      { cellId: "P18", sumCode: 5, participantCodes: [1, 4], isWar: true }
    ]);
  });

  test("detects encounters for shared occupied cells", () => {
    const sums = new Map([
      ["A4", 1],
      ["B6", 3],
      ["C5", 7]
    ]);

    assert.deepEqual(detectEncounters(sums), [
      { cellId: "B6", sumCode: 3, participantCodes: [1, 2] },
      { cellId: "C5", sumCode: 7, participantCodes: [1, 2, 4] }
    ]);
  });
});
