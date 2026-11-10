import { locations } from "./seed.js";
export const INVENTORY_COLUMNS = [
  "product_id",
  "location_id",
  "stock",
  ...Array.from({ length: 84 }, (_, i) => `sales_day_${i + 1}`),
];
export function inventoryTemplate(state) {
  return [
    INVENTORY_COLUMNS.join(","),
    ...state.products.flatMap((p) =>
      p.nodes.map((n) => [p.id, n.location, n.stock, ...n.history].join(",")),
    ),
  ].join("\r\n");
}
export function parseInventory(text, state) {
  if (typeof text !== "string" || text.length > 262144)
    throw new Error("Upload a CSV smaller than 256 KB.");
  const lines = text
    .replace(/^\uFEFF/, "")
    .trim()
    .split(/\r?\n/);
  if (lines[0] !== INVENTORY_COLUMNS.join(","))
    throw new Error("CSV columns must match the exported inventory template.");
  const expected = new Set(
    state.products.flatMap((p) => locations.map((l) => `${p.id}:${l.id}`)),
  );
  const rows = [];
  const seen = new Set();
  for (let i = 1; i < lines.length; i++) {
    const fields = lines[i].split(",").map((s) => s.trim());
    if (fields.length !== 87)
      throw new Error(`Row ${i + 1}: expected 87 columns.`);
    const [productId, location, ...values] = fields,
      key = `${productId}:${location}`;
    if (!expected.has(key))
      throw new Error(`Row ${i + 1}: unknown product or location.`);
    if (seen.has(key))
      throw new Error(`Row ${i + 1}: duplicate stock position.`);
    if (values.some((v) => !/^\d+$/.test(v) || Number(v) > 1000000))
      throw new Error(
        `Row ${i + 1}: stock and sales must be whole numbers between 0 and 1,000,000.`,
      );
    const [stock, ...history] = values.map(Number);
    rows.push({ productId, location, stock, history });
    seen.add(key);
  }
  if (seen.size !== expected.size)
    throw new Error(
      `Expected all ${expected.size} stock positions; found ${seen.size}.`,
    );
  return rows;
}
export function importInventory(
  state,
  { text, expectedVersion, requestId, actor = "Demo operator" },
  now = new Date().toISOString(),
) {
  if (!requestId || typeof requestId !== "string" || requestId.length > 128)
    throw new Error("A request ID is required.");
  const existing = state.audit.find((a) => a.requestId === requestId);
  if (existing) {
    if (existing.action !== "imported")
      throw new Error("Request ID already used.");
    return state;
  }
  if (expectedVersion !== state.version)
    throw new Error("Workspace changed. Refresh before importing.");
  if (state.decisions.some((d) => d.fulfillment === "reserved"))
    throw new Error(
      "Receive all reserved transfers before importing a new inventory snapshot.",
    );
  const rows = parseInventory(text, state);
  const next = structuredClone(state);
  for (const row of rows) {
    const node = next.products
      .find((p) => p.id === row.productId)
      .nodes.find((n) => n.location === row.location);
    node.stock = row.stock;
    node.history = row.history;
  }
  // Dismissals apply to a snapshot; old decisions remain visible but do not suppress new routes.
  next.decisions = next.decisions.map((d) =>
    d.status === "dismissed" ? { ...d, status: "archived" } : d,
  );
  next.version++;
  next.dataset = "imported";
  next.importedAt = now;
  next.audit.unshift({
    sequence: next.version - 1,
    action: "imported",
    actor,
    requestId,
    at: now,
    rows: rows.length,
    engine: "inventory-csv/1.0",
  });
  return next;
}
