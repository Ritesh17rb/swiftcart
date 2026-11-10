import { analyze, city } from "./engine.js";
// Inspectable lexical retrieval over computed facts, not embeddings or a model call.
export function retrieve(state, question, horizon = 14) {
  if (
    typeof question !== "string" ||
    !question.trim() ||
    question.length > 1000
  )
    throw new Error("Ask a question between 1 and 1,000 characters.");
  const a = analyze(state, { horizon });
  const terms = question
    .toLowerCase()
    .split(/\W+/)
    .filter((t) => t.length > 2);
  const ranked = a.recommendations
    .map((r) => ({
      r,
      score: terms.reduce(
        (s, t) =>
          s +
          (`${r.name} ${r.productId} ${city(r.from)} ${city(r.to)} ${r.priority}`
            .toLowerCase()
            .includes(t)
            ? 1
            : 0),
        0,
      ),
    }))
    .sort((a, b) => b.score - a.score || b.r.net - a.r.net);
  const relevant = ranked.filter((x) => x.score > 0);
  const records = (relevant.length ? relevant : ranked)
    .slice(0, 3)
    .map(({ r }, i) => ({
      id: `E${i + 1}`,
      product: r.name,
      route: `${city(r.from)} → ${city(r.to)}`,
      units: r.units,
      net: r.net,
      freight: r.cost,
      transitDays: r.transitDays,
      facts: r.evidence,
    }));
  const topic = /waste|excess|overstock/.test(question.toLowerCase())
    ? "Excess inventory is stock above the planning horizon plus a three-day reserve. Transfers only draw from this surplus."
    : /model|forecast|uncertainty/.test(question.toLowerCase())
      ? "The current model averages the last three matching weekdays. Historical residuals give an uncertainty band; this is a baseline, with no guarantee under distribution shift."
      : "Prioritize transfers with positive contribution after freight. The planner retains donor reserves and ranks feasible routes by benefit per rupee of freight.";
  const summary = records.length
    ? `${topic}\n\nThe strongest retrieved opportunity is ${records[0].product}: ${records[0].units} units, ${records[0].route}, with an estimated ₹${records[0].net.toLocaleString("en-IN")} net benefit [${records[0].id}]. This is a planning estimate, not realized savings.`
    : `${topic}\n\nNo feasible transfer was found under the current constraints.`;
  return {
    summary,
    evidence: records,
    citations: records.map((r) => r.id),
    provider: "deterministic",
    workspaceVersion: state.version,
    notice: relevant.length
      ? "Retrieved matching planning records."
      : "No specific record matched; showing the highest-value network opportunities.",
  };
}
