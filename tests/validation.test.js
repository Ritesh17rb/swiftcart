import test from "node:test";
import assert from "node:assert/strict";
import { createSeed } from "../client/src/domain/seed.js";
import { validateWorkspace } from "../client/src/domain/validation.js";
import {
  analyze,
  applyDecision,
  forecast,
} from "../client/src/domain/engine.js";

test("workspace validation accepts seed and real decision states", () => {
  const state = createSeed();
  assert.strictEqual(validateWorkspace(state), state);
  const rec = analyze(state).recommendations[0];
  const next = applyDecision(state, {
    id: rec.id,
    action: "approved",
    expectedVersion: 1,
    requestId: "valid-state",
  });
  assert.strictEqual(validateWorkspace(next), next);
});

test("corrupt or duplicate stock positions fail validation before they reach rendering", () => {
  for (const change of [
    (s) => {
      s.products[0].nodes[0].history = [];
    },
    (s) => {
      s.products[0].nodes[0].stock = -1;
    },
    (s) => {
      s.products[0].nodes[1].location = s.products[0].nodes[0].location;
    },
    (s) => {
      s.version = 2;
    },
  ]) {
    const state = createSeed();
    change(state);
    assert.throws(() => validateWorkspace(state), /invalid/);
  }
});

test("fractional horizons and transit days are rejected explicitly", () => {
  assert.throws(
    () => analyze(createSeed(), { horizon: 7.5 }),
    /Invalid scenario/,
  );
  assert.throws(
    () => analyze(createSeed(), { delay: 0.5 }),
    /Invalid scenario/,
  );
  assert.throws(() => forecast(Array(84).fill(0), 7.5), /Invalid forecast/);
});
