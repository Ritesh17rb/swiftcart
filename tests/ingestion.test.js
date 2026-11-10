import test from "node:test";
import assert from "node:assert/strict";
import { createSeed } from "../client/src/domain/seed.js";
import {
  inventoryTemplate,
  parseInventory,
  importInventory,
} from "../client/src/domain/ingestion.js";
import {
  analyze,
  applyDecision,
  evaluate,
} from "../client/src/domain/engine.js";
import { createStore } from "../ops/store.js";

test("complete CSV roundtrips and imports with provenance and an audit event", () => {
  const state = createSeed(),
    text = inventoryTemplate(state),
    rows = parseInventory(text, state);
  assert.equal(rows.length, 48);
  assert.equal(rows[0].history.length, 84);
  const next = importInventory(state, {
    text,
    expectedVersion: 1,
    requestId: "import-1",
  });
  assert.deepEqual(next.products, state.products);
  assert.equal(next.dataset, "imported");
  assert.equal(next.audit[0].action, "imported");
  assert.equal(next.version, 2);
  assert.strictEqual(
    importInventory(next, { text, expectedVersion: 1, requestId: "import-1" }),
    next,
  );
  assert.equal(evaluate(next).dataset, "Imported · 84 daily observations");
});
test("CSV rejects missing, duplicate, unknown, fractional, negative, and empty quantities", () => {
  const state = createSeed(),
    text = inventoryTemplate(state),
    lines = text.split("\r\n");
  assert.throws(
    () => parseInventory(lines.slice(0, -1).join("\n"), state),
    /Expected all/,
  );
  assert.throws(
    () => parseInventory([...lines, lines[1]].join("\n"), state),
    /duplicate/,
  );
  assert.throws(
    () => parseInventory(text.replace("SC-101", "UNKNOWN"), state),
    /unknown/,
  );
  for (const value of ["-1", "1.5", "", "1000001", "=1+1"]) {
    const modified = [...lines],
      fields = modified[1].split(",");
    fields[2] = value;
    modified[1] = fields.join(",");
    assert.throws(
      () => parseInventory(modified.join("\n"), state),
      /whole numbers/,
    );
  }
});
test("snapshot import blocks reserved transfers and stale revisions", () => {
  const state = createSeed(),
    r = analyze(state).recommendations[0];
  const reserved = applyDecision(state, {
    id: r.id,
    action: "approved",
    expectedVersion: 1,
    requestId: "reserve-before-import",
  });
  assert.throws(
    () =>
      importInventory(reserved, {
        text: inventoryTemplate(state),
        expectedVersion: 2,
        requestId: "import-blocked",
      }),
    /reserved transfers/,
  );
  assert.throws(
    () =>
      importInventory(state, {
        text: inventoryTemplate(state),
        expectedVersion: 2,
        requestId: "import-stale",
      }),
    /Workspace changed/,
  );
});
test("all-zero history gives an honest unavailable WAPE and SQLite imports remain integrity checked", () => {
  const state = createSeed();
  for (const p of state.products) for (const n of p.nodes) n.history.fill(0);
  assert.equal(evaluate(state).wape, null);
  assert.equal(evaluate(state).baselineWape, null);
  const store = createStore(":memory:");
  try {
    const next = store.commit(
      {
        text: inventoryTemplate(state),
        expectedVersion: 1,
        requestId: "sqlite-import",
      },
      "import",
    );
    assert.equal(next.dataset, "imported");
    assert.equal(store.verify().valid, true);
    assert.equal(store.verify().events, 1);
  } finally {
    store.close();
  }
});
