import test from "node:test";
import assert from "node:assert/strict";
import { askCopilot } from "../ops/copilot.js";
import { createSeed } from "../client/src/domain/seed.js";

test("optional model adapter validates schema and rejects invented evidence IDs", async () => {
  const previous = process.env.OLLAMA_MODEL,
    previousFetch = globalThis.fetch;
  process.env.OLLAMA_MODEL = "mock-local-model";
  try {
    globalThis.fetch = async (_url, options) => {
      const body = JSON.parse(options.body);
      assert.equal(body.stream, false);
      assert.equal(body.options.temperature, 0);
      assert.ok(body.format.required.includes("citations"));
      return {
        ok: true,
        json: async () => ({
          message: {
            content: JSON.stringify({
              summary: "Review this computed route [E1].",
              citations: ["E1"],
            }),
          },
        }),
      };
    };
    const result = await askCopilot(createSeed(), "Prioritize transfers", 14);
    assert.equal(result.provider, "ollama:mock-local-model");
    assert.equal(result.citations[0], "E1");
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({
        message: {
          content: JSON.stringify({
            summary: "Invented evidence.",
            citations: ["E999"],
          }),
        },
      }),
    });
    await assert.rejects(
      () => askCopilot(createSeed(), "Prioritize transfers", 14),
      /evidence validation/,
    );
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({
        message: {
          content: JSON.stringify({
            summary: "Fabricated inline reference [E999].",
            citations: ["E1"],
          }),
        },
      }),
    });
    await assert.rejects(
      () => askCopilot(createSeed(), "Prioritize transfers", 14),
      /evidence validation/,
    );
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({ message: { content: "not JSON" } }),
    });
    await assert.rejects(
      () => askCopilot(createSeed(), "Prioritize transfers", 14),
      /invalid structured/,
    );
    globalThis.fetch = async () => ({ ok: false });
    await assert.rejects(
      () => askCopilot(createSeed(), "Prioritize transfers", 14),
      /unavailable/,
    );
  } finally {
    globalThis.fetch = previousFetch;
    if (previous === undefined) delete process.env.OLLAMA_MODEL;
    else process.env.OLLAMA_MODEL = previous;
  }
});
