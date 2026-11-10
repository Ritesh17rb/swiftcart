import { locations } from "./seed.js";
export const ENGINE_VERSION = "reflow-planner/1.0";
export const mean = (xs) =>
  xs.reduce((s, x) => s + x, 0) / Math.max(1, xs.length);
const round = (x) => Math.round(x * 100) / 100;
export const city = (id) => locations.find((l) => l.id === id)?.name || id;
export function forecast(history, horizon = 14, multiplier = 1) {
  if (
    !Number.isInteger(horizon) ||
    horizon < 1 ||
    horizon > 30 ||
    !Number.isFinite(multiplier) ||
    multiplier < 0.25 ||
    multiplier > 3
  )
    throw new Error("Invalid forecast horizon or demand multiplier.");
  if (
    !Array.isArray(history) ||
    history.length < 28 ||
    history.some((x) => !Number.isFinite(x) || x < 0)
  )
    throw new Error(
      "At least 28 non-negative daily observations are required.",
    );
  const predict = (past, offset) =>
    mean(
      [1, 2, 3]
        .map((w) => past[past.length - w * 7 + (offset % 7)])
        .filter(Number.isFinite),
    );
  const residuals = [];
  for (let i = Math.max(21, history.length - 42); i < history.length; i++)
    residuals.push(Math.abs(history[i] - predict(history.slice(0, i), 0)));
  const sorted = [...residuals].sort((a, b) => a - b);
  const radius =
    sorted[
      Math.min(sorted.length - 1, Math.ceil((sorted.length + 1) * 0.9) - 1)
    ];
  const daily = Array.from({ length: horizon }, (_, d) => {
    const value = predict(history, d) * multiplier;
    return {
      day: d + 1,
      value: round(value),
      lower: round(Math.max(0, value - radius * multiplier)),
      upper: round(value + radius * multiplier),
    };
  });
  return {
    daily,
    velocity: mean(daily.map((d) => d.value)),
    radius: round(radius),
    calibrationSize: residuals.length,
    calibrationCoverage: round(
      (residuals.filter((r) => r <= radius).length / residuals.length) * 100,
    ),
    method: "seasonal-naive + rolling residual intervals",
  };
}
export function analyze(state, options = {}) {
  const { multiplier = 1, delay = 0, budget = 50000, horizon = 14 } = options;
  if (
    ![multiplier, delay, budget, horizon].every(Number.isFinite) ||
    !Number.isInteger(horizon) ||
    !Number.isInteger(delay) ||
    multiplier < 0.25 ||
    multiplier > 3 ||
    delay < 0 ||
    delay > 14 ||
    budget < 0 ||
    horizon < 7 ||
    horizon > 30
  )
    throw new Error("Invalid scenario parameters.");
  let exposure = 0,
    excessValue = 0;
  const nodes = state.products.flatMap((p) =>
    p.nodes.map((n) => {
      const f = forecast(n.history, horizon, multiplier);
      const demand = f.daily.reduce((s, d) => s + d.value, 0);
      const inbound = state.decisions
        .filter(
          (d) =>
            d.productId === p.id &&
            d.to === n.location &&
            d.fulfillment === "reserved",
        )
        .reduce((s, d) => s + d.units, 0);
      const shortage = Math.max(0, Math.ceil(demand - n.stock - inbound));
      const reserve = Math.ceil(f.velocity * (horizon + 3) + f.radius);
      const excess = Math.max(0, n.stock - reserve);
      exposure += shortage * p.margin;
      excessValue += excess * (p.price - p.margin);
      return {
        ...n,
        inbound,
        productId: p.id,
        name: p.name,
        category: p.category,
        margin: p.margin,
        price: p.price,
        forecast: f,
        velocity: f.velocity,
        cover: round(n.stock / Math.max(0.01, f.velocity)),
        shortage,
        excess,
        reserve,
        risk:
          shortage > 0 && n.stock / Math.max(0.01, f.velocity) < 4
            ? "Critical"
            : shortage > 0
              ? "At risk"
              : excess > 0
                ? "Overstock"
                : "Healthy",
      };
    }),
  );
  const candidates = [];
  for (const p of state.products) {
    const pn = nodes.filter((n) => n.productId === p.id);
    const supply = new Map(pn.map((n) => [n.location, n.excess]));
    for (const dest of pn
      .filter((n) => n.shortage > 0)
      .sort((a, b) => a.cover - b.cover)) {
      let remaining = dest.shortage;
      const donors = pn
        .filter((n) => n.excess > 0 && n.location !== dest.location)
        .sort((a, b) => a.location.localeCompare(b.location));
      for (const source of donors) {
        const distance = Math.hypot(
          locations.find((l) => l.id === source.location).x -
            locations.find((l) => l.id === dest.location).x,
          locations.find((l) => l.id === source.location).y -
            locations.find((l) => l.id === dest.location).y,
        );
        const transitDays = Math.ceil(distance / 135) + delay;
        const units = Math.min(
          remaining,
          supply.get(source.location),
          Math.max(
            0,
            Math.floor(dest.forecast.velocity * (horizon - transitDays)),
          ),
        );
        if (units < 1 || transitDays >= horizon) continue;
        const cost = Math.ceil(180 + units * (8 + distance / 12));
        const recovery = Math.round(Math.min(units, dest.shortage) * p.margin);
        if (recovery <= cost) continue;
        const id = `${p.id}:${source.location}:${dest.location}`;
        if (
          state.decisions.some((d) => d.id === id && d.status === "dismissed")
        )
          continue;
        candidates.push({
          id,
          productId: p.id,
          name: p.name,
          category: p.category,
          icon: p.icon,
          color: p.color,
          from: source.location,
          to: dest.location,
          units,
          cost,
          recovery,
          net: recovery - cost,
          transitDays,
          cover: dest.cover,
          priority: dest.risk,
          evidence: [
            `${city(dest.location)} has ${dest.stock} units and ${dest.cover.toFixed(1)} days of cover.`,
            `${city(source.location)} has ${source.excess} transferable units after a ${horizon + 3}-day reserve.`,
            `Projected ${horizon}-day unmet demand: ${dest.shortage} units.`,
            `Estimated freight ₹${cost}; protected contribution ₹${recovery}.`,
          ],
          engine: ENGINE_VERSION,
        });
        supply.set(source.location, supply.get(source.location) - units);
        remaining -= units;
        if (!remaining) break;
      }
    }
  }
  const recommendations = [];
  let spent = 0;
  for (const c of candidates.sort((a, b) => b.net / b.cost - a.net / a.cost)) {
    if (spent + c.cost <= budget) {
      recommendations.push(c);
      spent += c.cost;
    }
  }
  const recovery = recommendations.reduce((s, r) => s + r.recovery, 0);
  return {
    nodes,
    recommendations,
    metrics: {
      exposure: Math.round(exposure),
      excessValue: Math.round(excessValue),
      recovery,
      cost: spent,
      net: recovery - spent,
      critical: nodes.filter((n) => n.risk === "Critical").length,
      atRisk: nodes.filter((n) => n.shortage > 0).length,
      units: recommendations.reduce((s, r) => s + r.units, 0),
      healthy: nodes.filter(
        (n) => n.risk === "Healthy" || n.risk === "Overstock",
      ).length,
      total: nodes.length,
    },
    options: { multiplier, delay, budget, horizon },
    engine: ENGINE_VERSION,
  };
}
export function applyDecision(
  state,
  {
    id,
    action,
    expectedVersion,
    requestId,
    actor = "Demo operator",
    options = {},
  },
  now = new Date().toISOString(),
) {
  if (!requestId || typeof requestId !== "string" || requestId.length > 128)
    throw new Error("A request ID is required.");
  const existing = state.audit.find((a) => a.requestId === requestId);
  if (existing) {
    if (existing.recommendationId !== id || existing.action !== action)
      throw new Error("Request ID already used for another decision.");
    return state;
  }
  if (state.version !== expectedVersion)
    throw new Error(
      "Workspace changed. Refresh before approving this decision.",
    );
  if (!["approved", "dismissed"].includes(action))
    throw new Error("Unsupported decision.");
  const rec = analyze(state, options).recommendations.find((r) => r.id === id);
  if (!rec) throw new Error("This recommendation is no longer actionable.");
  const next = structuredClone(state);
  if (action === "approved")
    next.products
      .find((p) => p.id === rec.productId)
      .nodes.find((n) => n.location === rec.from).stock -= rec.units;
  next.version++;
  next.decisions.unshift({
    ...rec,
    status: action,
    fulfillment: action === "approved" ? "reserved" : null,
    createdAt: now,
    actor,
    decisionId: requestId,
  });
  next.audit.unshift({
    sequence: next.version - 1,
    action,
    actor,
    requestId,
    recommendationId: id,
    productId: rec.productId,
    units: rec.units,
    from: rec.from,
    to: rec.to,
    at: now,
    engine: ENGINE_VERSION,
  });
  return next;
}
export function receiveTransfer(
  state,
  { decisionId, expectedVersion, requestId, actor = "Demo operator" },
  now = new Date().toISOString(),
) {
  const prior = state.audit.find((a) => a.requestId === requestId);
  if (prior) {
    if (prior.decisionId !== decisionId || prior.action !== "received")
      throw new Error("Request ID already used.");
    return state;
  }
  if (!requestId || typeof requestId !== "string" || requestId.length > 128)
    throw new Error("A request ID is required.");
  if (expectedVersion !== state.version)
    throw new Error("Workspace changed. Refresh before receiving.");
  const next = structuredClone(state);
  const d = next.decisions.find(
    (d) =>
      d.decisionId === decisionId &&
      d.status === "approved" &&
      d.fulfillment === "reserved",
  );
  if (!d) throw new Error("No reserved transfer found.");
  next.products
    .find((p) => p.id === d.productId)
    .nodes.find((n) => n.location === d.to).stock += d.units;
  d.fulfillment = "received";
  d.receivedAt = now;
  next.version++;
  next.audit.unshift({
    sequence: next.version - 1,
    action: "received",
    decisionId,
    actor,
    requestId,
    recommendationId: d.id,
    productId: d.productId,
    units: d.units,
    from: d.from,
    to: d.to,
    at: now,
    engine: ENGINE_VERSION,
  });
  return next;
}
export function evaluate(state) {
  let absoluteError = 0,
    baselineError = 0,
    total = 0,
    covered = 0,
    count = 0;
  for (const p of state.products)
    for (const n of p.nodes) {
      for (const origin of [56, 63, 70, 77]) {
        const f = forecast(n.history.slice(0, origin), 7);
        for (let d = 0; d < 7; d++) {
          const actual = n.history[origin + d];
          const predicted = f.daily[d];
          absoluteError += Math.abs(actual - predicted.value);
          baselineError += Math.abs(
            actual - mean(n.history.slice(origin - 7, origin)),
          );
          total += actual;
          count++;
          if (actual >= predicted.lower && actual <= predicted.upper) covered++;
        }
      }
    }
  return {
    wape: total ? round((absoluteError / total) * 100) : null,
    baselineWape: total ? round((baselineError / total) * 100) : null,
    coverage: round((covered / count) * 100),
    observations: count,
    origins: 4,
    series: state.products.length * locations.length,
    target: 90,
    dataset:
      state.dataset === "imported"
        ? "Imported · 84 daily observations"
        : "Synthetic · 84 days · fixed seed",
  };
}
