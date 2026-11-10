import test from "node:test";
import assert from "node:assert/strict";
import { createSeed } from "../client/src/domain/seed.js";
import {
  analyze,
  applyDecision,
  evaluate,
  forecast,
  receiveTransfer,
} from "../client/src/domain/engine.js";
import { retrieve } from "../client/src/domain/copilot.js";

test("fixed seed produces deterministic forecasts and seasonal structure", () => {
  const history = Array.from({ length: 84 }, (_, d) => (d % 7) + 10);
  const f = forecast(history);
  assert.deepEqual(
    f.daily.slice(0, 7).map((d) => d.value),
    [10, 11, 12, 13, 14, 15, 16],
  );
  assert.equal(f.radius, 0);
  assert.equal(f.calibrationSize, 42);
  assert.throws(() => forecast([1, 2, 3]), /28/);
  assert.throws(() => forecast(Array(28).fill(-1)), /non-negative/);
});
test("planner respects freight budgets and never draws past donor reserves across scenarios", () => {
  const state = createSeed();
  for (const multiplier of [0.5, 1, 1.5, 2])
    for (const budget of [0, 1000, 10000, 50000])
      for (const delay of [0, 5, 10]) {
        const plan = analyze(state, { multiplier, budget, delay });
        assert.ok(plan.metrics.cost <= budget);
        const donors = new Map(),
          destinations = new Map();
        for (const r of plan.recommendations) {
          assert.ok(r.units > 0 && r.net > 0 && r.transitDays < 14);
          assert.ok(Number.isInteger(r.units));
          const key = `${r.productId}:${r.from}`,
            dest = `${r.productId}:${r.to}`;
          donors.set(key, (donors.get(key) || 0) + r.units);
          destinations.set(dest, (destinations.get(dest) || 0) + r.units);
        }
        for (const n of plan.nodes) {
          assert.ok(
            (donors.get(`${n.productId}:${n.location}`) || 0) <= n.excess,
          );
          assert.ok(
            (destinations.get(`${n.productId}:${n.location}`) || 0) <=
              n.shortage,
          );
        }
      }
});
test("approvals reserve stock, receipts credit once, total units are conserved", () => {
  const state = createSeed();
  const original = JSON.stringify(state);
  const rec = analyze(state).recommendations[0];
  const payload = {
    id: rec.id,
    action: "approved",
    expectedVersion: 1,
    requestId: "approve-1",
  };
  const next = applyDecision(state, payload);
  assert.equal(JSON.stringify(state), original);
  assert.equal(next.version, 2);
  const product = next.products.find((p) => p.id === rec.productId);
  const initial = state.products.find((p) => p.id === rec.productId);
  assert.equal(
    product.nodes.find((n) => n.location === rec.from).stock,
    initial.nodes.find((n) => n.location === rec.from).stock - rec.units,
  );
  assert.equal(
    product.nodes.find((n) => n.location === rec.to).stock,
    initial.nodes.find((n) => n.location === rec.to).stock,
  );
  const sum = (s) =>
    s.products.flatMap((p) => p.nodes).reduce((s, n) => s + n.stock, 0) +
    s.decisions
      .filter((d) => d.fulfillment === "reserved")
      .reduce((s, d) => s + d.units, 0);
  assert.equal(sum(next), sum(state));
  assert.strictEqual(applyDecision(next, payload), next);
  assert.throws(
    () => applyDecision(next, { ...payload, requestId: "stale" }),
    /Workspace changed/,
  );
  assert.throws(
    () => applyDecision(next, { ...payload, action: "dismissed" }),
    /already used/,
  );
  const receipt = {
    decisionId: "approve-1",
    requestId: "receive-1",
    expectedVersion: 2,
  };
  const received = receiveTransfer(next, receipt);
  assert.equal(sum(received), sum(state));
  assert.equal(received.decisions[0].fulfillment, "received");
  assert.strictEqual(receiveTransfer(received, receipt), received);
  assert.throws(
    () =>
      receiveTransfer(received, {
        ...receipt,
        expectedVersion: 3,
        requestId: "double",
      }),
    /reserved transfer/,
  );
});
test("inbound reservations reduce unmet demand without crediting available stock", () => {
  const initial = createSeed();
  const plan = analyze(initial);
  const r = plan.recommendations[0];
  const next = applyDecision(initial, {
    id: r.id,
    action: "approved",
    expectedVersion: 1,
    requestId: "reserve",
  });
  const before = plan.nodes.find(
    (n) => n.productId === r.productId && n.location === r.to,
  );
  const after = analyze(next).nodes.find(
    (n) => n.productId === r.productId && n.location === r.to,
  );
  assert.equal(after.stock, before.stock);
  assert.equal(after.inbound, r.units);
  assert.equal(after.shortage, Math.max(0, before.shortage - r.units));
});
test("dismissal removes its route without changing physical inventory", () => {
  const state = createSeed();
  const rec = analyze(state).recommendations[0];
  const next = applyDecision(state, {
    id: rec.id,
    action: "dismissed",
    expectedVersion: 1,
    requestId: "dismiss",
  });
  assert.deepEqual(next.products, state.products);
  assert.ok(!analyze(next).recommendations.some((r) => r.id === rec.id));
});
test("evaluation has the expected held-out sample size and reproducible metrics", () => {
  const result = evaluate(createSeed());
  assert.equal(result.observations, 48 * 4 * 7);
  assert.ok(result.coverage >= 0 && result.coverage <= 100);
  assert.deepEqual(result, evaluate(createSeed()));
});
test("copilot uses existing evidence and has no mutation capability", () => {
  const state = createSeed(),
    before = JSON.stringify(state);
  const answer = retrieve(state, "What about Bengaluru?");
  assert.equal(answer.provider, "deterministic");
  assert.ok(answer.evidence.length > 0);
  assert.ok(answer.evidence.every((e) => e.route.includes("Bengaluru")));
  assert.deepEqual(
    answer.citations,
    answer.evidence.map((e) => e.id),
  );
  assert.equal(JSON.stringify(state), before);
  assert.throws(() => retrieve(state, ""), /Ask a question/);
});
