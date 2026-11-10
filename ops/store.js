import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { createSeed } from "../client/src/domain/seed.js";
import { applyDecision, receiveTransfer } from "../client/src/domain/engine.js";
import { importInventory } from "../client/src/domain/ingestion.js";

export function createStore(
  path = process.env.OPS_DB_PATH || "./data/reflow.sqlite",
) {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS workspace (id INTEGER PRIMARY KEY CHECK(id=1), version INTEGER NOT NULL, data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS events (sequence INTEGER PRIMARY KEY, request_id TEXT NOT NULL UNIQUE, payload TEXT NOT NULL, previous_hash TEXT NOT NULL, hash TEXT NOT NULL);`);
  const initial = createSeed();
  db.prepare(
    "INSERT OR IGNORE INTO workspace(id,version,data) VALUES(1,?,?)",
  ).run(initial.version, JSON.stringify(initial));
  const read = () =>
    JSON.parse(db.prepare("SELECT data FROM workspace WHERE id=1").get().data);
  const commit = (payload, receipt = false) => {
    db.exec("BEGIN IMMEDIATE");
    try {
      const state = read();
      const next = (
        receipt === "import"
          ? importInventory
          : receipt
            ? receiveTransfer
            : applyDecision
      )(state, payload);
      if (next !== state) {
        const event = next.audit[0];
        const previous =
          db
            .prepare("SELECT hash FROM events ORDER BY sequence DESC LIMIT 1")
            .get()?.hash || "GENESIS";
        const serialized = JSON.stringify(event);
        const hash = createHash("sha256")
          .update(previous + serialized)
          .digest("hex");
        db.prepare(
          "INSERT INTO events(sequence,request_id,payload,previous_hash,hash) VALUES(?,?,?,?,?)",
        ).run(event.sequence, event.requestId, serialized, previous, hash);
        db.prepare("UPDATE workspace SET version=?,data=? WHERE id=1").run(
          next.version,
          JSON.stringify(next),
        );
      }
      db.exec("COMMIT");
      return next;
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  };
  const verify = () => {
    const events = db.prepare("SELECT * FROM events ORDER BY sequence").all();
    let previous = "GENESIS",
      expectedSequence = 1;
    for (const event of events) {
      if (
        event.sequence !== expectedSequence++ ||
        event.previous_hash !== previous ||
        createHash("sha256")
          .update(previous + event.payload)
          .digest("hex") !== event.hash
      )
        return { valid: false, events: events.length };
      previous = event.hash;
    }
    const state = read();
    const snapshotMatches =
      state.audit.length === events.length &&
      state.version === events.length + 1 &&
      events.every(
        (e, i) =>
          JSON.stringify(state.audit[state.audit.length - 1 - i]) === e.payload,
      );
    return {
      valid: snapshotMatches,
      events: events.length,
      head: previous,
      note: "Local integrity check; hashes are not externally anchored and cannot prove resistance to a privileged database rewrite.",
    };
  };
  return { read, commit, verify, close: () => db.close() };
}
