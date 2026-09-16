import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  assertNoManualIdentityOverride,
  canModifyMoves,
  canViewEncounter,
  canViewPlayerMoves,
  extractMoveToggleInput
} from "../src/lib/authorization.ts";

describe("privacy authorization", () => {
  const altos = { playerId: "altos-id", role: "player" };
  const admin = { playerId: "admin-id", role: "superadmin" };

  test("a player cannot consult another player's moves", () => {
    assert.equal(canViewPlayerMoves(altos, "oscuros-id"), false);
    assert.equal(canViewPlayerMoves(altos, "altos-id"), true);
    assert.equal(canViewPlayerMoves(admin, "oscuros-id"), true);
  });

  test("a player cannot see encounters where they do not participate", () => {
    assert.equal(canViewEncounter(altos, ["oscuros-id", "silvanos-id"]), false);
    assert.equal(canViewEncounter(altos, ["altos-id", "silvanos-id"]), true);
    assert.equal(canViewEncounter(admin, ["oscuros-id", "silvanos-id"]), true);
  });

  test("a player cannot send a manual code to simulate another faction", () => {
    assert.throws(() => assertNoManualIdentityOverride({ cellId: "A4", code: 4 }));
    assert.throws(() => assertNoManualIdentityOverride({ cellId: "A4", playerId: "oscuros-id" }));
    assert.deepEqual(extractMoveToggleInput({ cellId: "a4" }), { cellId: "A4" });
  });

  test("a player cannot modify moves after confirming", () => {
    assert.equal(canModifyMoves(altos, true), false);
    assert.equal(canModifyMoves(altos, false), true);
    assert.equal(canModifyMoves(admin, true), true);
  });
});
