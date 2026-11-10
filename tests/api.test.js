import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createStore } from "../ops/store.js";
import { createApp } from "../ops/server.js";
import { analyze } from "../client/src/domain/engine.js";

test("SQLite persists atomic decisions across restart and verifies its event chain", () => {
  const dir = mkdtempSync(join(tmpdir(), "reflow-test-"));
  const path = join(dir, "test.sqlite");
  try {
    let store = createStore(path);
    const state = store.read(),
      r = analyze(state).recommendations[0];
    const payload = {
      id: r.id,
      action: "approved",
      expectedVersion: 1,
      requestId: "persistent-approval",
    };
    store.commit(payload);
    store.close();
    store = createStore(path);
    assert.equal(store.read().version, 2);
    assert.equal(store.verify().valid, true);
    assert.equal(store.verify().events, 1);
    store.commit(payload);
    assert.equal(store.verify().events, 1);
    assert.throws(
      () => store.commit({ ...payload, requestId: "bad-stale" }),
      /Workspace changed/,
    );
    assert.equal(store.read().version, 2);
    store.close();
    const db = new DatabaseSync(path);
    db.prepare("UPDATE events SET hash=?").run("tampered");
    db.close();
    store = createStore(path);
    assert.equal(store.verify().valid, false);
    store.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test("API enforces auth, validates writes, and rejects stale decisions", async () => {
  const store = createStore(":memory:");
  const server = createApp({ store, token: "test-operator-secret" });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (path, data, auth = true, extra = {}) =>
    fetch(base + path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(auth ? { Authorization: "Bearer test-operator-secret" } : {}),
        ...extra,
      },
      body: JSON.stringify(data),
    });
  try {
    assert.equal((await fetch(base + "/api/health")).status, 200);
    const state = await (await fetch(base + "/api/ops/workspace")).json();
    const r = analyze(state).recommendations[0];
    const body = {
      id: r.id,
      action: "approved",
      expectedVersion: 1,
      requestId: "api-test",
    };
    assert.equal((await post("/api/ops/decisions", body, false)).status, 401);
    assert.equal(
      (
        await post("/api/ops/decisions", body, true, {
          Origin: "https://untrusted.example",
        })
      ).status,
      403,
    );
    assert.equal((await post("/api/ops/decisions", body)).status, 200);
    assert.equal((await post("/api/ops/decisions", body)).status, 200);
    assert.equal(
      (await post("/api/ops/decisions", { ...body, requestId: "stale" }))
        .status,
      409,
    );
    const result = await (
      await post("/api/ops/copilot", { question: "What is the best transfer?" })
    ).json();
    assert.ok(result.evidence);
    assert.equal((await post("/api/ops/simulate", { budget: -1 })).status, 400);
    assert.equal(
      (
        await post("/api/ops/receipts", {
          decisionId: "api-test",
          requestId: "receipt",
          expectedVersion: 2,
        })
      ).status,
      200,
    );
    const verify = await (await fetch(base + "/api/ops/audit/verify")).json();
    assert.equal(verify.valid, true);
    assert.equal(verify.events, 2);
    assert.equal((await fetch(base + "/api/unknown")).status, 404);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    store.close();
  }
});
