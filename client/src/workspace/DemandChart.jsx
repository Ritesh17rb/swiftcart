import React from "react";
import { forecast } from "../domain/engine.js";

export default function DemandChart({ state, horizon = 14 }) {
  const histories = state.products.flatMap((p) =>
    p.nodes.map((n) => n.history),
  );
  const history = Array.from({ length: 21 }, (_, i) =>
    histories.reduce((s, h) => s + h[h.length - 21 + i], 0),
  );
  const forecasts = histories.map((h) => forecast(h, horizon));
  const sum = (key) =>
    Array.from({ length: horizon }, (_, i) =>
      forecasts.reduce((s, f) => s + f.daily[i][key], 0),
    );
  const projected = sum("value"),
    low = sum("lower"),
    high = sum("upper");
  const max = Math.max(1, ...high, ...history) * 1.12;
  const last = history.length + horizon - 1;
  const x = (i) => 44 + (i / last) * 586,
    y = (value) => 171 - (value / max) * 130;
  const path = (values, offset = 0) =>
    values.map((v, i) => `${i ? "L" : "M"}${x(i + offset)},${y(v)}`).join(" ");
  const ticks = [
    [0, "−21d"],
    [10, "−11d"],
    [20, "Today"],
    [20 + Math.ceil(horizon / 2), `+${Math.ceil(horizon / 2)}d`],
    [last, `+${horizon}d`],
  ];
  return (
    <div className="demand-chart">
      <svg
        viewBox="0 0 680 211"
        role="img"
        aria-label={`Daily demand: 21 historical days and ${horizon} forecast days`}
      >
        {[0, 1, 2, 3].map((i) => (
          <g key={i}>
            <line
              x1="44"
              x2="630"
              y1={41 + i * 43}
              y2={41 + i * 43}
              stroke="#e7ece8"
            />
            <text x="2" y={45 + i * 43} className="axis-label">
              {Math.round(max * (1 - i / 3))}
            </text>
          </g>
        ))}
        <path
          d={`${path(high, 21)} ${[...low]
            .reverse()
            .map((v, i) => `L${x(last - i)},${y(v)}`)
            .join(" ")} Z`}
          fill="#e1efdf"
        />
        <line
          x1={x(20)}
          x2={x(20)}
          y1="24"
          y2="174"
          stroke="#aabcae"
          strokeDasharray="4 4"
        />
        <path
          d={path(history)}
          fill="none"
          stroke="#285e42"
          strokeWidth="2.5"
        />
        <path
          d={`M${x(20)},${y(history[20])} ${path(projected, 21).replace("M", "L")}`}
          fill="none"
          stroke="#739b56"
          strokeWidth="2.5"
          strokeDasharray="5 4"
        />
        <circle
          cx={x(20)}
          cy={y(history[20])}
          r="4"
          fill="#285e42"
          stroke="white"
          strokeWidth="2"
        />
        {ticks.map(([position, label]) => (
          <text
            key={label}
            x={x(position)}
            y="200"
            textAnchor="middle"
            className="axis-label"
          >
            {label}
          </text>
        ))}
      </svg>
    </div>
  );
}
