import { createSeed, locations } from "./seed.js";

export function validateWorkspace(state) {
  const catalog = createSeed().products;
  if (
    !state ||
    !Number.isSafeInteger(state.version) ||
    state.version < 1 ||
    !Array.isArray(state.products) ||
    state.products.length !== catalog.length ||
    !Array.isArray(state.decisions) ||
    !Array.isArray(state.audit)
  )
    throw new Error(
      "Saved workspace is invalid. Export a backup or reset the browser sandbox in settings.",
    );
  const products = new Set();
  for (const product of state.products) {
    if (
      !catalog.some((p) => p.id === product.id) ||
      products.has(product.id) ||
      typeof product.name !== "string" ||
      !Number.isFinite(product.price) ||
      !Number.isFinite(product.margin) ||
      product.margin < 0 ||
      product.margin > product.price ||
      !Array.isArray(product.nodes) ||
      product.nodes.length !== locations.length
    )
      throw new Error(
        "Saved product catalog is invalid. Reset the browser sandbox in settings.",
      );
    products.add(product.id);
    const nodes = new Set();
    for (const node of product.nodes) {
      if (
        !locations.some((l) => l.id === node.location) ||
        nodes.has(node.location) ||
        !Number.isSafeInteger(node.stock) ||
        node.stock < 0 ||
        !Array.isArray(node.history) ||
        node.history.length !== 84 ||
        node.history.some(
          (x) => !Number.isSafeInteger(x) || x < 0 || x > 1000000,
        )
      )
        throw new Error(
          "Saved inventory is invalid. Reset the browser sandbox in settings.",
        );
      nodes.add(node.location);
    }
  }
  if (
    state.audit.length !== state.version - 1 ||
    state.audit.some(
      (a, i) =>
        !a ||
        typeof a.requestId !== "string" ||
        a.sequence !== state.version - 1 - i,
    )
  )
    throw new Error(
      "Saved audit history is invalid. Reset the browser sandbox in settings.",
    );
  if (
    state.decisions.some(
      (d) =>
        !d ||
        !products.has(d.productId) ||
        !locations.some((l) => l.id === d.from) ||
        !locations.some((l) => l.id === d.to) ||
        !Number.isSafeInteger(d.units) ||
        d.units <= 0 ||
        typeof d.decisionId !== "string",
    )
  )
    throw new Error(
      "Saved transfers are invalid. Reset the browser sandbox in settings.",
    );
  return state;
}
