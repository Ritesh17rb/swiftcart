import { createSeed } from "../domain/seed.js";
import { applyDecision, receiveTransfer } from "../domain/engine.js";
import { importInventory } from "../domain/ingestion.js";
import { validateWorkspace } from "../domain/validation.js";
export const KEY = "reflow.workspace.v2";
export function loadLocal() {
  const saved = localStorage.getItem(KEY);
  return saved ? validateWorkspace(JSON.parse(saved)) : createSeed();
}
export async function connect() {
  try {
    const r = await fetch("/api/ops/workspace", {
      signal: AbortSignal.timeout(1800),
    });
    if (r.ok && r.headers.get("content-type")?.includes("application/json")) {
      const state = validateWorkspace(await r.json());
      return { state, mode: "server" };
    }
  } catch {
    /* Static deployment uses an explicitly labeled browser sandbox. */
  }
  try {
    return { state: loadLocal(), mode: "demo" };
  } catch {
    return {
      state: createSeed(),
      mode: "demo",
      warning:
        "Saved browser data could not be loaded. Open settings to download the stored backup or start a fresh sandbox.",
    };
  }
}
export async function refreshWorkspace(mode) {
  if (mode !== "server") return loadLocal();
  const response = await fetch("/api/ops/workspace", {
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok)
    throw new Error(
      "The API is unavailable. Your last loaded workspace is still displayed.",
    );
  return validateWorkspace(await response.json());
}
export function resetLocal() {
  const seed = createSeed();
  localStorage.setItem(KEY, JSON.stringify(seed));
  return seed;
}
export async function mutate(state, payload, mode, token, receipt = false) {
  if (mode === "loading")
    throw new Error("Wait for the workspace to finish connecting.");
  if (mode === "server") {
    const r = await fetch(
      `/api/ops/${receipt === "import" ? "import" : receipt ? "receipts" : "decisions"}`,
      {
        method: "POST",
        signal: AbortSignal.timeout(15000),
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      },
    );
    let data;
    try {
      data = await r.json();
    } catch {
      throw new Error(
        "The API returned an unexpected response. Refresh and try again.",
      );
    }
    if (!r.ok) {
      const error = new Error(data.error || "Unable to save decision.");
      error.status = r.status;
      throw error;
    }
    return validateWorkspace(data);
  }
  const commit = () => {
    // Storage remains authoritative even when another tab reset to revision 1.
    const current = loadLocal();
    const next = (
      receipt === "import"
        ? importInventory
        : receipt
          ? receiveTransfer
          : applyDecision
    )(current, payload);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      throw new Error(
        "Browser storage is full or disabled. Decision was not saved.",
      );
    }
    return next;
  };
  return navigator.locks ? navigator.locks.request(KEY, commit) : commit();
}
export function download(name, content, type = "text/csv") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function csv(rows) {
  return rows
    .map((row) =>
      row.map((v) => `"${String(v ?? "").replaceAll('"', '""')}"`).join(","),
    )
    .join("\r\n");
}
