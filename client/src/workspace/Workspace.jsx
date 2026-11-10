import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowDownLeft,
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  Bell,
  BookOpen,
  Box,
  Boxes,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  Clock3,
  FlaskConical,
  Globe2,
  Headphones,
  LayoutDashboard,
  Leaf,
  Loader2,
  Menu,
  MoreHorizontal,
  Package,
  Search,
  Settings2,
  ShieldCheck,
  Shirt,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
  Truck,
  X,
  Backpack,
  Coffee,
  LampDesk,
  Footprints,
  ShoppingBag,
  Milk,
  Database,
  Terminal,
  Send,
} from "lucide-react";
import { createSeed, locations } from "../domain/seed.js";
import { analyze, city, evaluate } from "../domain/engine.js";
import {
  connect,
  csv,
  download,
  mutate,
  refreshWorkspace,
  resetLocal,
  KEY,
} from "./store.js";
import DemandChart from "./DemandChart.jsx";
import { retrieve } from "../domain/copilot.js";
import { inventoryTemplate, parseInventory } from "../domain/ingestion.js";

const money = (n) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: n >= 100000 ? 1 : 0,
    notation: n >= 100000 ? "compact" : "standard",
  }).format(n);
const number = (n) => new Intl.NumberFormat("en-IN").format(n);
const icons = {
  shirt: Shirt,
  headphones: Headphones,
  cup: Coffee,
  backpack: Backpack,
  shoe: Footprints,
  lamp: LampDesk,
  bag: ShoppingBag,
  bottle: Milk,
};
const navigation = [
  ["Overview", LayoutDashboard],
  ["Decision inbox", Sparkles],
  ["Inventory network", Boxes],
  ["Scenario lab", FlaskConical],
  ["Transfer orders", Truck],
  ["Operations copilot", Terminal],
  ["Model evaluation", Activity],
  ["Decision ledger", BookOpen],
  ["Data intake", Database],
];
function ProductIcon({ product, small = false }) {
  const Icon = icons[product.icon] || Package;
  return (
    <span
      className={`product-icon ${small ? "small" : ""}`}
      style={{ background: product.color }}
    >
      <Icon size={small ? 18 : 25} strokeWidth={1.4} />
    </span>
  );
}
function Badge({ children, tone }) {
  return (
    <span
      className={`badge ${tone || (children === "Critical" ? "red" : children === "At risk" ? "amber" : "green")}`}
    >
      <span />
      {children}
    </span>
  );
}
function Empty({ title, detail, icon: Icon = CheckCheck }) {
  return (
    <div className="empty">
      <Icon size={32} />
      <h3>{title}</h3>
      <p>{detail}</p>
    </div>
  );
}

function NetworkMap({ analysis, onSelect, selected = "all" }) {
  const active = analysis.recommendations.slice(0, 7);
  return (
    <div className="network-map">
      <svg
        viewBox="0 0 680 355"
        role="img"
        aria-label="Schematic of six Indian retail locations and recommended inventory transfers"
      >
        <defs>
          <pattern
            id="dots"
            width="19"
            height="19"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="2" cy="2" r="1" fill="#d7ded5" />
          </pattern>
          <marker
            id="arrow"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="4"
            markerHeight="4"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#759c68" />
          </marker>
        </defs>
        <rect width="680" height="355" fill="url(#dots)" />
        <path
          d="M319 20 350 26 377 19 402 48 426 61 416 85 441 94 434 120 463 133 490 121 520 135 553 116 581 128 557 148 523 152 499 176 475 179 463 214 469 244 480 273 464 302 442 311 422 338 403 321 389 302 374 270 354 255 342 236 312 229 296 213 266 209 239 191 228 170 247 151 270 153 282 134 283 102 311 86 306 62 319 44Z"
          fill="#eaf0e4"
          stroke="#d4dfce"
          strokeWidth="1.2"
        />
        <text x="116" y="270" className="map-ocean">
          ARABIAN SEA
        </text>
        <text x="520" y="270" className="map-ocean">
          BAY OF BENGAL
        </text>
        {active.map((r, i) => {
          const a = locations.find((l) => l.id === r.from),
            b = locations.find((l) => l.id === r.to);
          return (
            <path
              key={r.id}
              d={`M${a.x} ${a.y} Q${(a.x + b.x) / 2 - 45} ${(a.y + b.y) / 2 - 30 - i * 3} ${b.x} ${b.y}`}
              fill="none"
              stroke={i === 0 ? "#39734b" : "#9ab48a"}
              strokeWidth={i === 0 ? 2 : 1.3}
              strokeDasharray={i === 0 ? "0" : "4 4"}
              markerEnd="url(#arrow)"
            />
          );
        })}
        {locations.map((l) => {
          const risk = analysis.nodes.filter(
            (n) => n.location === l.id && n.shortage > 0,
          ).length;
          return (
            <g
              key={l.id}
              role="button"
              tabIndex="0"
              aria-label={`Filter ${l.name}`}
              onClick={() => onSelect(l.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(l.id);
                }
              }}
              className="map-node"
            >
              <circle
                cx={l.x}
                cy={l.y}
                r={selected === l.id ? 15 : 12}
                fill={risk ? "#fbefdc" : "#dcebd5"}
                opacity=".8"
              />
              <circle
                cx={l.x}
                cy={l.y}
                r="5"
                fill={risk ? "#bc8541" : "#4f7c50"}
                stroke="white"
                strokeWidth="2"
              />
              <rect
                x={l.x + 10}
                y={l.y - 15}
                width={l.name.length * 6.6 + 13}
                height="25"
                rx="5"
                fill="white"
                stroke="#e6e9df"
              />
              <text x={l.x + 17} y={l.y + 1} className="map-label">
                {l.name}
              </text>
            </g>
          );
        })}
        <g transform="translate(34, 31)">
          <rect width="131" height="52" rx="7" fill="white" stroke="#e2e7dc" />
          <circle cx="15" cy="18" r="3" fill="#45764a" />
          <text x="26" y="22" className="map-label">
            6 connected locations
          </text>
          <text x="14" y="39" className="map-small">
            Schematic · not to scale
          </text>
        </g>
      </svg>
      <div className="map-legend">
        <span>
          <i className="dot green" />
          Balanced location
        </span>
        <span>
          <i className="dot amber" />
          Needs attention
        </span>
        <span>
          <i className="line" />
          Suggested transfer
        </span>
      </div>
    </div>
  );
}
function RecommendationTable({ items, onOpen, limit }) {
  return items.length ? (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Product</th>
            <th>Suggested movement</th>
            <th>Priority</th>
            <th>Net opportunity</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {items.slice(0, limit).map((r) => (
            <tr key={r.id} onClick={() => onOpen(r)}>
              <td>
                <div className="product-cell">
                  <ProductIcon product={r} small />
                  <div>
                    <strong>{r.name}</strong>
                    <span>
                      {r.productId} · {r.units} units
                    </span>
                  </div>
                </div>
              </td>
              <td>
                <div className="route-cell">
                  {city(r.from)} <ArrowRight size={13} /> {city(r.to)}
                </div>
                <span className="subtle">
                  {r.transitDays}-day estimated transit
                </span>
              </td>
              <td>
                <Badge>{r.priority}</Badge>
              </td>
              <td>
                <strong className="positive">{money(r.net)}</strong>
                <span className="subtle">after {money(r.cost)} freight</span>
              </td>
              <td>
                <button
                  className="icon-button"
                  aria-label={`Review ${r.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpen(r);
                  }}
                >
                  <ArrowUpRight size={17} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <Empty
      title="No transfers fit these constraints"
      detail="Try a larger budget, another location, or a lower demand scenario."
    />
  );
}

const slug = (name) => name.toLowerCase().replaceAll(" ", "-");
const readPage = () =>
  navigation.find(
    ([name]) => slug(name) === window.location.hash.replace(/^#\/?/, ""),
  )?.[0] || "Overview";
export default function Workspace() {
  const [state, setState] = useState(createSeed),
    [mode, setMode] = useState("loading"),
    [page, setPage] = useState(readPage);
  const [location, setLocation] = useState("all"),
    [search, setSearch] = useState(""),
    [horizon, setHorizon] = useState(14);
  const [detail, setDetail] = useState(null),
    [toast, setToast] = useState(""),
    [busy, setBusy] = useState(false),
    [mobile, setMobile] = useState(false);
  const [multiplier, setMultiplier] = useState(1),
    [delay, setDelay] = useState(0),
    [budget, setBudget] = useState(50000),
    [scenario, setScenario] = useState(null);
  const [settings, setSettings] = useState(false),
    [token, setToken] = useState(""),
    [question, setQuestion] = useState(""),
    [answer, setAnswer] = useState("");
  const [storageWarning, setStorageWarning] = useState(""),
    [refreshing, setRefreshing] = useState(false);
  const [upload, setUpload] = useState(null),
    [uploadError, setUploadError] = useState("");
  const toastTimer = useRef();
  const modalRef = useRef();
  const drawerRef = useRef();
  useEffect(() => {
    let active = true;
    connect().then((result) => {
      if (active) {
        setState(result.state);
        setMode(result.mode);
        setStorageWarning(result.warning || "");
      }
    });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!detail && !settings) return;
    const previous = document.activeElement;
    const target = settings ? modalRef.current : drawerRef.current;
    target?.focus();
    const handler = (e) => {
      if (e.key === "Escape") {
        setDetail(null);
        setSettings(false);
      }
      if (e.key === "Tab") {
        const list = target?.querySelectorAll(
          'button,input,a,select,textarea,[tabindex="0"]',
        );
        if (!list?.length) return;
        const first = list[0],
          last = list[list.length - 1];
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === target)
        ) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
      previous?.focus();
    };
  }, [detail, settings]);
  useEffect(() => () => clearTimeout(toastTimer.current), []);
  const notify = (message) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 4500);
  };
  const analysis = useMemo(() => analyze(state, { horizon }), [state, horizon]);
  const evaluation = useMemo(() => evaluate(state), [state]);
  const filtered = analysis.recommendations.filter(
    (r) =>
      (location === "all" || r.from === location || r.to === location) &&
      `${r.name} ${r.productId} ${city(r.from)} ${city(r.to)}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const nodes = analysis.nodes.filter(
    (n) =>
      (location === "all" || n.location === location) &&
      `${n.name} ${n.productId} ${city(n.location)}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const go = (next) => {
    window.location.hash = "/" + slug(next);
    setPage(next);
    setMobile(false);
    setSearch("");
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  useEffect(() => {
    const navigate = () => {
      setPage(readPage());
      setMobile(false);
      setSearch("");
    };
    window.addEventListener("hashchange", navigate);
    return () => window.removeEventListener("hashchange", navigate);
  }, []);
  useEffect(() => {
    setScenario(null);
  }, [state.version, horizon]);
  useEffect(() => {
    if (mode !== "demo") return;
    let active = true;
    const sync = (event) => {
      if (event.key === KEY)
        refreshWorkspace("demo")
          .then((next) => {
            if (active) {
              setState(next);
              setStorageWarning("");
            }
          })
          .catch(() => {
            if (active)
              setStorageWarning(
                "Another tab saved invalid data. Open settings to recover your workspace.",
              );
          });
    };
    window.addEventListener("storage", sync);
    return () => {
      active = false;
      window.removeEventListener("storage", sync);
    };
  }, [mode]);
  async function refresh() {
    setRefreshing(true);
    try {
      setState(await refreshWorkspace(mode));
      setStorageWarning("");
      notify("Workspace is up to date.");
    } catch (e) {
      notify(e.message);
    } finally {
      setRefreshing(false);
    }
  }
  async function recover(error) {
    notify(error.message);
    if (error.status === 401) {
      setSettings(true);
      return;
    }
    if (error.status === 409 || /Workspace changed/.test(error.message)) {
      try {
        setState(await refreshWorkspace(mode));
        setDetail(null);
        notify(
          "Workspace updated after another decision. Review the refreshed opportunity before trying again.",
        );
      } catch (e) {
        notify(e.message);
      }
    }
  }
  async function decide(action) {
    setBusy(true);
    try {
      const next = await mutate(
        state,
        {
          id: detail.id,
          action,
          expectedVersion: state.version,
          requestId: crypto.randomUUID(),
          options: { horizon },
        },
        mode,
        token,
      );
      setState(next);
      setDetail(null);
      notify(
        action === "approved"
          ? "Transfer reserved. Track it in Transfer orders."
          : "Recommendation dismissed and recorded.",
      );
    } catch (e) {
      await recover(e);
    } finally {
      setBusy(false);
    }
  }
  async function receive(d) {
    setBusy(true);
    try {
      setState(
        await mutate(
          state,
          {
            decisionId: d.decisionId,
            expectedVersion: state.version,
            requestId: crypto.randomUUID(),
          },
          mode,
          token,
          true,
        ),
      );
      notify("Receipt recorded. Destination inventory updated.");
    } catch (e) {
      await recover(e);
    } finally {
      setBusy(false);
    }
  }
  async function ask(e) {
    e?.preventDefault();
    if (!question.trim()) return;
    setBusy(true);
    try {
      if (mode === "server") {
        const r = await fetch("/api/ops/copilot", {
          method: "POST",
          signal: AbortSignal.timeout(35000),
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ question, horizon }),
        });
        const data = await r.json();
        if (!r.ok) {
          const error = new Error(data.error);
          error.status = r.status;
          throw error;
        }
        setAnswer({ ...data, horizon });
      } else setAnswer({ ...retrieve(state, question, horizon), horizon });
    } catch (e) {
      await recover(e);
    } finally {
      setBusy(false);
    }
  }
  async function readUpload(e) {
    setUpload(null);
    setUploadError("");
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > 262144)
        throw new Error("Choose a CSV smaller than 256 KB.");
      const text = await file.text();
      const rows = parseInventory(text, state);
      setUpload({ text, name: file.name, rows: rows.length });
    } catch (error) {
      setUploadError(error.message);
    }
    e.target.value = "";
  }
  async function commitUpload() {
    if (!upload) return;
    setBusy(true);
    try {
      setState(
        await mutate(
          state,
          {
            text: upload.text,
            expectedVersion: state.version,
            requestId: crypto.randomUUID(),
          },
          mode,
          token,
          "import",
        ),
      );
      setUpload(null);
      notify("Inventory snapshot imported. Forecasts and plans recomputed.");
    } catch (e) {
      await recover(e);
    } finally {
      setBusy(false);
    }
  }
  function exportPlan() {
    if (page === "Scenario lab") {
      if (!scenario) {
        notify("Run a simulation before exporting a scenario.");
        return;
      }
      download(
        "reflow-scenario.json",
        JSON.stringify({ kind: "simulation", ...scenario }, null, 2),
        "application/json",
      );
    } else if (page === "Inventory network")
      download(
        "reflow-inventory.csv",
        csv([
          [
            "Product",
            "SKU",
            "Location",
            "Available",
            "Inbound",
            "Daily demand",
            "Days of cover",
            "Status",
          ],
          ...nodes.map((n) => [
            n.name,
            n.productId,
            city(n.location),
            n.stock,
            n.inbound,
            n.velocity.toFixed(2),
            n.cover,
            n.risk,
          ]),
        ]),
      );
    else if (page === "Transfer orders")
      download(
        "reflow-transfer-orders.csv",
        csv([
          ["Order", "Product", "From", "To", "Units", "Status", "Created"],
          ...state.decisions
            .filter((d) => d.status === "approved")
            .map((d) => [
              d.decisionId,
              d.name,
              city(d.from),
              city(d.to),
              d.units,
              d.fulfillment,
              d.createdAt,
            ]),
        ]),
      );
    else if (page === "Model evaluation")
      download(
        "reflow-evaluation.json",
        JSON.stringify(evaluation, null, 2),
        "application/json",
      );
    else if (page === "Decision ledger")
      download(
        "reflow-audit.json",
        JSON.stringify(state.audit, null, 2),
        "application/json",
      );
    else if (page === "Data intake")
      download("reflow-inventory-template.csv", inventoryTemplate(state));
    else if (page === "Operations copilot") {
      if (!answer) {
        notify("Ask a question before exporting an explanation.");
        return;
      }
      download(
        "reflow-evidence.json",
        JSON.stringify(answer, null, 2),
        "application/json",
      );
    } else
      download(
        "reflow-transfer-plan.csv",
        csv([
          [
            "Product",
            "From",
            "To",
            "Units",
            "Freight INR",
            "Protected contribution INR",
            "Net INR",
            "Transit days",
          ],
          ...filtered.map((r) => [
            r.name,
            city(r.from),
            city(r.to),
            r.units,
            r.cost,
            r.recovery,
            r.net,
            r.transitDays,
          ]),
        ]),
      );
    notify("Export downloaded.");
  }
  const metrics = analysis.metrics;
  const pending = state.decisions.filter((d) => d.fulfillment === "reserved");
  const titles = {
    "Data intake": [
      "Bring your operations into focus.",
      "Validate and import a complete inventory snapshot, with an audit trail.",
    ],
    Overview: [
      "Inventory command center",
      "See what needs attention. Put your inventory where it matters.",
    ],
    "Decision inbox": [
      "Your next best moves.",
      "Evidence-backed transfers, ready for a human decision.",
    ],
    "Inventory network": [
      "Every unit. Every location.",
      "One view of stock positions, demand, and emerging risks.",
    ],
    "Scenario lab": [
      "What if things change?",
      "Stress-test the network before committing a single unit.",
    ],
    "Transfer orders": [
      "From decision to delivery.",
      "Inventory is reserved on approval and credited on confirmed receipt.",
    ],
    "Operations copilot": [
      "Ask a better inventory question.",
      "An explanation is only as useful as the evidence behind it.",
    ],
    "Model evaluation": [
      "Trust is something you measure.",
      "Rolling-origin backtests. Visible uncertainty. Reproducible results.",
    ],
    "Decision ledger": [
      "Every decision leaves a trail.",
      "An inspectable history of approvals, dismissals, and receipts.",
    ],
  };
  return (
    <div className="app-shell">
      <a
        className="skip-link"
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
      >
        Skip to workspace
      </a>
      <aside className={`sidebar ${mobile ? "open" : ""}`}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            go("Overview");
          }}
        >
          <span className="brand-mark">
            <ArrowLeftRight size={24} />
          </span>
          <span>
            reflow<span className="brand-by">BY SWIFTCART</span>
          </span>
        </a>
        <button className="workspace-picker" onClick={() => setSettings(true)}>
          <span className="workspace-avatar">S</span>
          <span>
            <strong>SwiftCart workspace</strong>
            <small>Retail operations</small>
          </span>
          <ChevronDown size={14} />
        </button>
        <div className="nav-label">WORKSPACE</div>
        <nav>
          {navigation.map(([name, Icon], i) => (
            <button
              key={name}
              aria-current={page === name ? "page" : undefined}
              className={page === name ? "nav-item active" : "nav-item"}
              onClick={() => go(name)}
            >
              <Icon size={18} />
              <span>{name}</span>
              {i === 1 && (
                <span className="nav-count">
                  {analysis.recommendations.length}
                </span>
              )}
              {i === 4 && pending.length > 0 && <i className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span className="note-icon">
              <Leaf size={18} />
            </span>
            <strong>Better flow. Less waste.</strong>
            <p>Good inventory decisions are good business decisions.</p>
            <button onClick={() => go("Model evaluation")}>
              Explore the methodology <ArrowUpRight size={13} />
            </button>
          </div>
          <button className="nav-item" onClick={() => setSettings(true)}>
            <Settings2 size={18} /> Workspace settings
          </button>
          <button className="profile" onClick={() => setSettings(true)}>
            <span className="avatar">R</span>
            <span>
              <strong>Ritesh</strong>
              <small>Workspace operator</small>
            </span>
            <MoreHorizontal size={18} />
          </button>
        </div>
      </aside>
      {mobile && (
        <button
          className="mobile-scrim"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              onClick={() => setMobile(true)}
              aria-label="Open navigation"
            >
              <Menu size={20} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={13} />
            <strong>{page}</strong>
          </div>
          <div className="topbar-right">
            <span className="connection">
              <i className={`dot ${mode === "server" ? "green" : "amber"}`} />
              {mode === "server"
                ? "Local API connected"
                : mode === "loading"
                  ? "Connecting…"
                  : "Browser sandbox"}
            </span>
            <button
              className="icon-button notification"
              aria-label="View inventory alerts"
              onClick={() => go("Decision inbox")}
            >
              <Bell size={19} />
              <i />
            </button>
            <span className="avatar small-avatar">R</span>
          </div>
        </header>
        <main id="main-content" tabIndex={-1}>
          <div className="workspace-status">
            <span>
              <i className={`dot ${mode === "server" ? "green" : "amber"}`} />
              {mode === "server"
                ? "Connected workspace · changes saved to SQLite"
                : mode === "loading"
                  ? "Loading your workspace…"
                  : "Interactive demo · changes saved on this device"}
            </span>
            <div>
              <button
                className="text-button"
                disabled={refreshing || mode === "loading"}
                onClick={refresh}
              >
                {refreshing ? (
                  <Loader2 size={13} className="spin" />
                ) : (
                  <ArrowLeftRight size={13} />
                )}{" "}
                Refresh
              </button>
              <button className="text-button" onClick={() => setSettings(true)}>
                {mode === "server" && !token
                  ? "Connect operator token"
                  : "Settings"}{" "}
                <ArrowUpRight size={13} />
              </button>
            </div>
          </div>
          {storageWarning && (
            <div className="recovery-notice" role="alert">
              <p>{storageWarning}</p>
              <button className="button" onClick={() => setSettings(true)}>
                Recover workspace
              </button>
            </div>
          )}
          <div className="page-eyebrow">
            <span className="eyebrow-dot" />
            {page === "Overview"
              ? "YOUR OPERATIONS, IN FOCUS"
              : page.toUpperCase()}
            <span className="dataset-label">
              {state.dataset === "imported"
                ? "IMPORTED INVENTORY DATA"
                : "SYNTHETIC DEMO DATA"}
            </span>
          </div>
          <div className="page-heading">
            <div>
              <h1>{titles[page][0]}</h1>
              <p>{titles[page][1]}</p>
            </div>
            <div className="heading-actions">
              <select
                aria-label="Planning horizon"
                value={horizon}
                onChange={(e) => setHorizon(Number(e.target.value))}
              >
                <option value="7">Next 7 days</option>
                <option value="14">Next 14 days</option>
                <option value="30">Next 30 days</option>
              </select>
              <button
                className="button primary"
                onClick={exportPlan}
                disabled={
                  mode === "loading" ||
                  (page === "Scenario lab" && !scenario) ||
                  (page === "Operations copilot" && !answer)
                }
              >
                <ArrowDownToLine size={15} />{" "}
                {page === "Scenario lab"
                  ? "Export simulation"
                  : page === "Overview" || page === "Decision inbox"
                    ? "Export plan"
                    : "Export data"}
              </button>
            </div>
          </div>
          {page === "Overview" && (
            <>
              <section className="briefing">
                <div className="briefing-symbol">
                  <Sparkles size={23} />
                </div>
                <div className="briefing-content">
                  <span className="briefing-eyebrow">THE REFLOW BRIEF</span>
                  <h2>Your inventory has room to work harder.</h2>
                  <p>
                    <strong>{metrics.atRisk} stock positions</strong> could run
                    short in the next {horizon} days. Rebalancing{" "}
                    {number(metrics.units)} units could protect{" "}
                    <strong>{money(metrics.recovery)}</strong> in contribution.
                  </p>
                  <div className="briefing-foot">
                    <span>
                      <ShieldCheck size={13} /> Grounded in your inventory data
                    </span>
                    <span>Estimates, before operator review</span>
                  </div>
                </div>
                <button
                  className="briefing-button"
                  onClick={() => go("Decision inbox")}
                >
                  Review {analysis.recommendations.length} opportunities{" "}
                  <ArrowRight size={16} />
                </button>
                <div className="briefing-decoration">
                  <ArrowLeftRight />
                </div>
              </section>
              <div className="metrics-grid">
                <Metric
                  title="Contribution at risk"
                  value={money(metrics.exposure)}
                  icon={TrendingUp}
                  label={`${horizon}-day unmet-demand estimate`}
                  tone="amber"
                />
                <Metric
                  title="Recovery opportunity"
                  value={money(metrics.net)}
                  icon={ArrowDownLeft}
                  label="Projected benefit, after freight"
                  tone="green"
                />
                <Metric
                  title="Stock positions at risk"
                  value={
                    <>
                      {metrics.atRisk}
                      <span className="metric-denominator">
                        {" "}
                        / {metrics.total}
                      </span>
                    </>
                  }
                  icon={Box}
                  label={`${metrics.critical} need immediate attention`}
                  tone="red"
                />
                <Metric
                  title="Capital in excess stock"
                  value={money(metrics.excessValue)}
                  icon={Boxes}
                  label="Above demand + safety reserve"
                  tone="neutral"
                />
              </div>
              <div className="overview-middle">
                <section className="panel network-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>One network. More possibilities.</h2>
                      <p>Move inventory to where demand is.</p>
                    </div>
                    <select
                      aria-label="Filter location"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                    >
                      <option value="all">All locations</option>
                      {locations.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <NetworkMap
                    analysis={analysis}
                    selected={location}
                    onSelect={setLocation}
                  />
                  <div className="panel-foot">
                    <span>
                      <Globe2 size={14} /> 6 locations{" "}
                      <span className="divider">/</span> 8 products{" "}
                      <span className="divider">/</span>{" "}
                      {analysis.recommendations.length} suggested routes
                    </span>
                    <button
                      className="text-button"
                      onClick={() => go("Inventory network")}
                    >
                      Explore network <ArrowUpRight size={14} />
                    </button>
                  </div>
                </section>
                <section className="panel health-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Network health</h2>
                      <p>A pulse on your inventory.</p>
                    </div>
                    <Activity size={17} className="muted" />
                  </div>
                  <div
                    className="health-ring"
                    style={{
                      "--health": `${(metrics.healthy / metrics.total) * 100}%`,
                    }}
                  >
                    <div>
                      <strong>
                        {Math.round((metrics.healthy / metrics.total) * 100)}
                        <span>%</span>
                      </strong>
                      <small>positions covered</small>
                    </div>
                  </div>
                  <div className="health-caption">
                    <span className="status-pill">Room to rebalance</span>
                    <p>
                      Spot imbalances across locations.
                      <br />
                      Rebalance where the constraints allow.
                    </p>
                  </div>
                  <div className="health-breakdown">
                    <div>
                      <span>
                        <i className="dot green" />
                        Covered
                      </span>
                      <strong>{metrics.healthy}</strong>
                    </div>
                    <div>
                      <span>
                        <i className="dot amber" />
                        At risk
                      </span>
                      <strong>{metrics.atRisk - metrics.critical}</strong>
                    </div>
                    <div>
                      <span>
                        <i className="dot red" />
                        Critical
                      </span>
                      <strong>{metrics.critical}</strong>
                    </div>
                  </div>
                </section>
              </div>
              <section className="panel opportunities">
                <div className="panel-heading">
                  <div>
                    <h2>
                      Small moves. Meaningful impact.{" "}
                      <span className="count-chip">{filtered.length}</span>
                    </h2>
                    <p>
                      Your highest-value recovery opportunities, ranked by
                      benefit per rupee of freight.
                    </p>
                  </div>
                  <button
                    className="text-button"
                    onClick={() => go("Decision inbox")}
                  >
                    View all opportunities <ArrowRight size={14} />
                  </button>
                </div>
                <RecommendationTable
                  items={filtered}
                  limit={4}
                  onOpen={setDetail}
                />
              </section>
              <div className="overview-bottom">
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Demand, with perspective.</h2>
                      <p>Observed demand and the next {horizon} days.</p>
                    </div>
                    <span className="chart-key">
                      <i className="dot green" />
                      Daily units
                    </span>
                  </div>
                  <DemandChart state={state} horizon={horizon} />
                  <div className="chart-disclaimer">
                    Shaded area: aggregate residual bands · illustrative, not a
                    joint coverage guarantee
                  </div>
                </section>
                <section className="panel activity-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Decisions in motion</h2>
                      <p>A little accountability goes a long way.</p>
                    </div>
                    <Clock3 size={17} className="muted" />
                  </div>
                  {state.audit.length ? (
                    state.audit.slice(0, 3).map((a) => (
                      <div className="activity-item" key={a.requestId}>
                        <span>
                          <Check size={15} />
                        </span>
                        <div>
                          <strong>
                            {a.action === "imported"
                              ? "Inventory snapshot"
                              : a.productId}{" "}
                            · {a.action}
                          </strong>
                          <p>
                            {a.action === "imported"
                              ? a.rows + " stock positions"
                              : city(a.from) +
                                " → " +
                                city(a.to) +
                                " · " +
                                a.units +
                                " units"}
                          </p>
                          <small>
                            {new Date(a.at).toLocaleString("en-IN")}
                          </small>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="activity-intro">
                      <span>
                        <ShieldCheck size={28} />
                      </span>
                      <h3>Your decisions belong here.</h3>
                      <p>
                        Review an opportunity to start an auditable chain from
                        recommendation to receipt.
                      </p>
                      <button
                        className="text-button"
                        onClick={() => go("Decision inbox")}
                      >
                        Make your first move <ArrowRight size={14} />
                      </button>
                    </div>
                  )}
                </section>
              </div>
            </>
          )}
          {page === "Decision inbox" && (
            <>
              <div className="inbox-summary">
                <Sparkles size={20} />
                <span>
                  <strong>
                    {analysis.recommendations.length} opportunities
                  </strong>{" "}
                  · {money(metrics.net)} potential net benefit ·{" "}
                  {money(metrics.cost)} estimated freight
                </span>
                <span className="badge neutral">Human approval required</span>
              </div>
              <FilterBar
                search={search}
                setSearch={setSearch}
                location={location}
                setLocation={setLocation}
              />
              <section className="panel">
                <RecommendationTable items={filtered} onOpen={setDetail} />
              </section>
              <div className="method-note">
                <ShieldCheck size={16} />
                <p>
                  Quantities come from a deterministic planner. Recommendations
                  respect donor reserves, arrival time, and the planning budget.
                  Benefits are estimates of protected contribution, not realized
                  revenue.
                </p>
              </div>
            </>
          )}
          {page === "Inventory network" && (
            <>
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>The connected inventory network</h2>
                    <p>Select a location to inspect its stock positions.</p>
                  </div>
                  <button
                    className="text-button"
                    onClick={() => setLocation("all")}
                  >
                    Show all locations
                  </button>
                </div>
                <NetworkMap
                  analysis={analysis}
                  selected={location}
                  onSelect={setLocation}
                />
              </section>
              <FilterBar
                search={search}
                setSearch={setSearch}
                location={location}
                setLocation={setLocation}
              />
              <section className="panel">
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Location</th>
                        <th>Available</th>
                        <th>In transit</th>
                        <th>Daily demand</th>
                        <th>Days of cover</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {nodes.map((n) => (
                        <tr key={`${n.productId}-${n.location}`}>
                          <td>
                            <strong>{n.name}</strong>
                            <span className="subtle">{n.productId}</span>
                          </td>
                          <td>{city(n.location)}</td>
                          <td>{n.stock}</td>
                          <td>{n.inbound || 0}</td>
                          <td>{n.velocity.toFixed(1)}</td>
                          <td>
                            <div className="cover-cell">
                              <span className="cover-bar">
                                <i
                                  style={{
                                    width: `${Math.min((n.cover / 30) * 100, 100)}%`,
                                    background: n.shortage
                                      ? "#ca9a60"
                                      : "#75936b",
                                  }}
                                />
                              </span>
                              {n.cover.toFixed(1)}d
                            </div>
                          </td>
                          <td>
                            <Badge>{n.risk}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!nodes.length && (
                    <Empty
                      title="No matching stock positions"
                      detail="Try another search or location."
                    />
                  )}
                </div>
              </section>
            </>
          )}
          {page === "Scenario lab" && (
            <div className="scenario-layout">
              <section className="panel scenario-controls">
                <div className="panel-heading">
                  <div>
                    <span className="mini-label">SIMULATION INPUTS</span>
                    <h2>Change the conditions.</h2>
                    <p>Your live inventory stays untouched.</p>
                  </div>
                  <SlidersHorizontal size={20} />
                </div>
                <div className="scenario-form">
                  <label>
                    Demand change{" "}
                    <strong>
                      {Math.round((multiplier - 1) * 100) > 0 ? "+" : ""}
                      {Math.round((multiplier - 1) * 100)}%
                    </strong>
                    <input
                      aria-label="Demand change"
                      type="range"
                      min="50"
                      max="200"
                      step="5"
                      value={multiplier * 100}
                      onChange={(e) => {
                        setMultiplier(Number(e.target.value) / 100);
                        setScenario(null);
                      }}
                    />
                    <small>
                      50% of baseline <span>2× baseline</span>
                    </small>
                  </label>
                  <label>
                    Additional transit delay <strong>{delay} days</strong>
                    <input
                      aria-label="Transit delay"
                      type="range"
                      min="0"
                      max="10"
                      value={delay}
                      onChange={(e) => {
                        setDelay(Number(e.target.value));
                        setScenario(null);
                      }}
                    />
                    <small>
                      No disruption <span>10-day delay</span>
                    </small>
                  </label>
                  <label>
                    Freight budget (INR)
                    <input
                      aria-label="Freight budget"
                      type="number"
                      min="0"
                      max="1000000"
                      value={budget}
                      onChange={(e) => {
                        setBudget(
                          Math.max(
                            0,
                            Math.min(1000000, Number(e.target.value)),
                          ),
                        );
                        setScenario(null);
                      }}
                    />
                  </label>
                  <div className="preset-buttons">
                    <button
                      onClick={() => {
                        setMultiplier(1.5);
                        setDelay(0);
                        setScenario(null);
                      }}
                    >
                      Festival spike
                    </button>
                    <button
                      onClick={() => {
                        setMultiplier(1);
                        setDelay(5);
                        setScenario(null);
                      }}
                    >
                      Logistics disruption
                    </button>
                    <button
                      onClick={() => {
                        setMultiplier(1);
                        setDelay(0);
                        setBudget(50000);
                        setScenario(null);
                      }}
                    >
                      Reset
                    </button>
                  </div>
                  <button
                    className="button primary full"
                    onClick={() =>
                      setScenario(
                        analyze(state, { multiplier, delay, budget, horizon }),
                      )
                    }
                  >
                    <FlaskConical size={16} /> Run simulation{" "}
                    <ArrowRight size={16} />
                  </button>
                  <p className="fine-print">
                    Deterministic what-if analysis. Freight and transit use
                    illustrative assumptions; no carrier integration.
                  </p>
                </div>
              </section>
              <div>
                {scenario ? (
                  <>
                    <section className="scenario-result">
                      <span className="mini-label">SIMULATION COMPLETE</span>
                      <h2>
                        {money(scenario.metrics.net)}
                        <span>potential net recovery</span>
                      </h2>
                      <p>
                        {scenario.recommendations.length} feasible transfers ·{" "}
                        {number(scenario.metrics.units)} units ·{" "}
                        {money(scenario.metrics.cost)} freight
                      </p>
                      <div className="scenario-comparison">
                        <div>
                          <small>At-risk contribution</small>
                          <strong>{money(scenario.metrics.exposure)}</strong>
                          <span>Baseline {money(metrics.exposure)}</span>
                        </div>
                        <div>
                          <small>Stock positions at risk</small>
                          <strong>{scenario.metrics.atRisk}</strong>
                          <span>Baseline {metrics.atRisk}</span>
                        </div>
                      </div>
                    </section>
                    <section className="panel">
                      <div className="panel-heading">
                        <div>
                          <h2>Feasible routes under this scenario</h2>
                          <p>
                            Simulation only. Review baseline opportunities in
                            the inbox.
                          </p>
                        </div>
                      </div>
                      <div className="scenario-routes">
                        {scenario.recommendations.slice(0, 6).map((r) => (
                          <div key={r.id}>
                            <ProductIcon product={r} small />
                            <span>
                              <strong>{r.name}</strong>
                              <small>
                                {city(r.from)} → {city(r.to)} · {r.units} units
                              </small>
                            </span>
                            <strong className="positive">{money(r.net)}</strong>
                          </div>
                        ))}
                        {!scenario.recommendations.length && (
                          <Empty
                            title="No feasible transfers"
                            detail="The budget or transit constraints prevent recovery. Adjust the inputs and rerun."
                          />
                        )}
                      </div>
                    </section>
                  </>
                ) : (
                  <section className="panel simulation-empty">
                    <FlaskConical size={46} strokeWidth={1} />
                    <span className="mini-label">PLAN FOR THE UNEXPECTED</span>
                    <h2>A safe space for what-ifs.</h2>
                    <p>
                      What happens if demand spikes by 50%?
                      <br />
                      Or a shipment takes five extra days?
                      <br />
                      Find out before it happens.
                    </p>
                    <div className="simulation-tags">
                      <span>Demand shocks</span>
                      <span>Transit delays</span>
                      <span>Budget constraints</span>
                    </div>
                  </section>
                )}
              </div>
            </div>
          )}
          {page === "Transfer orders" && (
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>
                    Transfer register{" "}
                    <span className="count-chip">
                      {
                        state.decisions.filter((d) => d.status === "approved")
                          .length
                      }
                    </span>
                  </h2>
                  <p>Reservation → physical movement → confirmed receipt</p>
                </div>
                <Badge tone="amber">{pending.length} awaiting receipt</Badge>
              </div>
              {state.decisions.some((d) => d.status === "approved") ? (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Product / order</th>
                        <th>Route</th>
                        <th>Units</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {state.decisions
                        .filter((d) => d.status === "approved")
                        .map((d) => (
                          <tr key={d.decisionId}>
                            <td>
                              <strong>{d.name}</strong>
                              <span className="subtle">
                                {d.decisionId.slice(0, 8)}
                              </span>
                            </td>
                            <td>
                              {city(d.from)} → {city(d.to)}
                            </td>
                            <td>{d.units}</td>
                            <td>
                              <Badge
                                tone={
                                  d.fulfillment === "received"
                                    ? "green"
                                    : "amber"
                                }
                              >
                                {d.fulfillment === "received"
                                  ? "Received"
                                  : "Reserved"}
                              </Badge>
                            </td>
                            <td>
                              {d.fulfillment === "reserved" ? (
                                <button
                                  className="button"
                                  disabled={busy}
                                  onClick={() => receive(d)}
                                >
                                  <CheckCheck size={14} /> Confirm receipt
                                </button>
                              ) : (
                                <span className="subtle">
                                  {new Date(d.receivedAt).toLocaleDateString(
                                    "en-IN",
                                  )}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Empty
                  title="Your first transfer starts with a decision."
                  detail="Approve an opportunity in the inbox to reserve stock and create a transfer order."
                  icon={Truck}
                />
              )}
            </section>
          )}
          {page === "Model evaluation" && (
            <>
              <div className="evaluation-banner">
                <ShieldCheck size={23} />
                <div>
                  <strong>Evidence over impressive claims.</strong>
                  <p>
                    These results are computed from{" "}
                    {state.dataset === "imported"
                      ? "your imported snapshot"
                      : "the bundled synthetic dataset"}
                    . They describe this dataset, not guaranteed production
                    performance.
                  </p>
                </div>
                <span className="badge neutral">Baseline model</span>
              </div>
              <div className="metrics-grid">
                <Metric
                  title="Seasonal model WAPE"
                  value={
                    evaluation.wape === null ? "N/A" : evaluation.wape + "%"
                  }
                  icon={Activity}
                  label="Lower is better"
                  tone="green"
                />
                <Metric
                  title="Moving-average WAPE"
                  value={
                    evaluation.baselineWape === null
                      ? "N/A"
                      : evaluation.baselineWape + "%"
                  }
                  icon={TrendingUp}
                  label="7-day mean comparison baseline"
                  tone="neutral"
                />
                <Metric
                  title="Empirical interval coverage"
                  value={`${evaluation.coverage}%`}
                  icon={ShieldCheck}
                  label="90% nominal target · held-out days"
                  tone="amber"
                />
                <Metric
                  title="Held-out predictions"
                  value={number(evaluation.observations)}
                  icon={Database}
                  label={`${evaluation.series} series × 4 origins × 7 days`}
                  tone="neutral"
                />
              </div>
              <div className="evaluation-grid">
                <section className="panel methodology">
                  <span className="mini-label">MODEL CARD · V1.0</span>
                  <h2>Small model. Inspectable behavior.</h2>
                  <dl>
                    <dt>Forecast</dt>
                    <dd>
                      Same weekday averaged over the preceding three weeks. No
                      external model API or hidden training step.
                    </dd>
                    <dt>Uncertainty</dt>
                    <dd>
                      90th-percentile absolute residual radius with
                      finite-sample quantile correction. Rolling historical
                      calibration; time dependence means no distribution-free
                      coverage claim.
                    </dd>
                    <dt>Validation</dt>
                    <dd>
                      Four rolling origins at days 56, 63, 70, and 77. Each
                      predicts seven unseen days. Calibration uses only data
                      available at that origin.
                    </dd>
                    <dt>Planning</dt>
                    <dd>
                      Conservative donor reserve, transfer-arrival bound, and
                      greedy benefit-to-freight ranking under a budget. A
                      heuristic, with no claim of global optimality.
                    </dd>
                    <dt>Known limitations</dt>
                    <dd>
                      Synthetic demand, no stockout censoring correction, no
                      live carrier costs, no learned promotions or cold-start
                      model. Evaluation on real retail data remains necessary.
                    </dd>
                  </dl>
                  <button
                    className="button"
                    onClick={() =>
                      download(
                        "reflow-evaluation.json",
                        JSON.stringify(
                          {
                            ...evaluation,
                            engine: analysis.engine,
                            runAt: new Date().toISOString(),
                          },
                          null,
                          2,
                        ),
                        "application/json",
                      )
                    }
                  >
                    <ArrowDownToLine size={15} /> Download evaluation
                  </button>
                </section>
                <section className="panel research-panel">
                  <span className="mini-label">
                    RESEARCH THAT SHAPED THE DESIGN
                  </span>
                  <h2>Built on ideas you can inspect.</h2>
                  <a
                    href="https://arxiv.org/abs/2601.00121"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <span>01 / AGENT + SOLVER SEPARATION</span>
                    <h3>Ask, Clarify, Optimize</h3>
                    <p>Duan, Hu & Jiang · 2026</p>
                    <p>
                      Motivates separating conversational interpretation from
                      numerical decision logic. This version uses deterministic
                      explanations.
                    </p>
                    <ArrowUpRight size={18} />
                  </a>
                  <a
                    href="https://arxiv.org/abs/2107.07511"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <span>02 / VISIBLE UNCERTAINTY</span>
                    <h3>A Gentle Introduction to Conformal Prediction</h3>
                    <p>Angelopoulos & Bates · 2021 / 2022</p>
                    <p>
                      Informs residual-based uncertainty reporting. Temporal
                      dependence and distribution shift require additional
                      validation.
                    </p>
                    <ArrowUpRight size={18} />
                  </a>
                </section>
              </div>
            </>
          )}
          {page === "Decision ledger" && (
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>The decision ledger</h2>
                  <p>
                    Workspace revision {state.version} · {state.audit.length}{" "}
                    recorded events
                  </p>
                </div>
                <button
                  className="button"
                  onClick={() =>
                    download(
                      "reflow-audit.json",
                      JSON.stringify(state.audit, null, 2),
                      "application/json",
                    )
                  }
                >
                  <ArrowDownToLine size={14} /> Export audit
                </button>
              </div>
              {state.audit.length ? (
                <div className="ledger">
                  {state.audit.map((a) => (
                    <div className="ledger-event" key={a.requestId}>
                      <span className="ledger-number">
                        {String(a.sequence).padStart(2, "0")}
                      </span>
                      <div>
                        <div className="ledger-title">
                          <strong>
                            {a.action === "imported"
                              ? "Inventory snapshot imported"
                              : a.productId +
                                " · " +
                                (a.action === "received"
                                  ? "Transfer received"
                                  : a.action === "approved"
                                    ? "Transfer approved"
                                    : "Recommendation dismissed")}
                          </strong>
                          <Badge
                            tone={
                              a.action === "dismissed" ? "neutral" : "green"
                            }
                          >
                            {a.action}
                          </Badge>
                        </div>
                        <p>
                          {a.action === "imported"
                            ? a.rows + " stock positions"
                            : city(a.from) +
                              " → " +
                              city(a.to) +
                              " · " +
                              a.units +
                              " units"}{" "}
                          · {a.actor}
                        </p>
                        <code>{a.requestId}</code>
                        <small>
                          {a.engine} · {new Date(a.at).toLocaleString("en-IN")}
                        </small>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty
                  title="A fresh ledger."
                  detail="Every approval, dismissal, and confirmed receipt will appear here with its request ID and model version."
                  icon={BookOpen}
                />
              )}
            </section>
          )}
          {page === "Operations copilot" && (
            <div className="copilot-layout">
              <section className="panel copilot-panel">
                <div className="panel-heading">
                  <div>
                    <h2>
                      <Sparkles size={17} /> Your evidence, explained.
                    </h2>
                    <p>
                      Read-only assistance. Every inventory action stays in your
                      hands.
                    </p>
                  </div>
                  <Badge tone="neutral">
                    {answer?.provider?.startsWith("ollama")
                      ? "Local language model"
                      : "Deterministic mode"}
                  </Badge>
                </div>
                <div className="copilot-body">
                  {answer ? (
                    <>
                      <div className="copilot-answer">
                        <span className="mini-label">
                          GROUNDED RESPONSE · REVISION {answer.workspaceVersion}
                        </span>
                        <p>{answer.summary}</p>
                        <small>{answer.notice}</small>
                        {(answer.workspaceVersion !== state.version ||
                          answer.horizon !== horizon) && (
                          <Badge tone="amber">
                            Planning context changed. Ask again for current
                            evidence.
                          </Badge>
                        )}
                      </div>
                      <h3 className="evidence-heading">Retrieved evidence</h3>
                      {answer.evidence.map((e) => (
                        <div className="copilot-evidence" key={e.id}>
                          <span>{e.id}</span>
                          <div>
                            <strong>{e.product}</strong>
                            <p>
                              {e.route} · {e.units} units · {money(e.net)}{" "}
                              estimated net
                            </p>
                            <ul>
                              {e.facts.map((f) => (
                                <li key={f}>{f}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      ))}
                    </>
                  ) : (
                    <div className="copilot-welcome">
                      <span className="copilot-spark">
                        <Sparkles size={30} strokeWidth={1.3} />
                      </span>
                      <h2>Start with what matters.</h2>
                      <p>
                        Explore stock risks, recovery routes, and the reasoning
                        behind a recommendation.
                      </p>
                      <div className="question-presets">
                        {[
                          "Which transfers should I prioritize?",
                          "What is happening in Bengaluru?",
                          "How does the forecast handle uncertainty?",
                        ].map((q) => (
                          <button key={q} onClick={() => setQuestion(q)}>
                            {q}
                            <ArrowUpRight size={13} />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <form className="copilot-form" onSubmit={ask}>
                    <label className="search-field">
                      <input
                        aria-label="Ask operations copilot"
                        placeholder="Ask about products, locations, or a decision…"
                        maxLength={1000}
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                      />
                    </label>
                    <button
                      className="button primary"
                      disabled={busy || !question.trim() || mode === "loading"}
                      type="submit"
                      aria-label="Send question"
                    >
                      {busy ? (
                        <Loader2 size={17} className="spin" />
                      ) : (
                        <Send size={17} />
                      )}
                    </button>
                  </form>
                  <p className="fine-print">
                    {mode === "server"
                      ? "Optional Ollama model runs on the server when configured. Otherwise, explanations use deterministic templates."
                      : "Browser sandbox uses lexical retrieval and deterministic explanations. Connect the API and configure Ollama for model-generated answers."}
                  </p>
                </div>
              </section>
              <section className="panel copilot-facts">
                <span className="mini-label">HOW IT WORKS</span>
                <h2>Grounded by design.</h2>
                <div>
                  <span>01</span>
                  <h3>Retrieve current facts</h3>
                  <p>
                    Lexical matching selects relevant, computed planning records
                    from this workspace.
                  </p>
                </div>
                <div>
                  <span>02</span>
                  <h3>Explain with sources</h3>
                  <p>
                    Optional schema-constrained local model output must cite
                    known evidence IDs. All quantities are computed by the
                    planner.
                  </p>
                </div>
                <div>
                  <span>03</span>
                  <h3>Keep humans in control</h3>
                  <p>
                    The assistant has no write tools. Review and approve
                    transfers in the decision inbox.
                  </p>
                </div>
                <div className="guardrail">
                  <ShieldCheck size={17} />
                  <p>
                    Valid citation IDs do not guarantee faithful prose. Check
                    the evidence before acting.
                  </p>
                </div>
              </section>
            </div>
          )}
          {page === "Data intake" && (
            <div className="evaluation-grid">
              <section className="panel intake-panel">
                <span className="mini-label">INVENTORY SNAPSHOT · CSV V1</span>
                <h2>Your data. The same accountable workflow.</h2>
                <p>
                  Import 48 stock positions with 84 consecutive days of sales
                  per position. The catalog and six location IDs are fixed in
                  this version. Download the current snapshot to get the exact
                  format.
                </p>
                <button
                  className="button"
                  onClick={() =>
                    download(
                      "reflow-inventory-template.csv",
                      inventoryTemplate(state),
                    )
                  }
                >
                  <ArrowDownToLine size={15} /> Download CSV template
                </button>
                <label className="upload-zone">
                  <Database size={29} strokeWidth={1.3} />
                  <strong>Select an inventory CSV</strong>
                  <span>87 columns · 48 rows · maximum 256 KB</span>
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    aria-label="Upload inventory CSV"
                    onChange={readUpload}
                  />
                </label>
                {uploadError && (
                  <p className="upload-error" role="alert">
                    {uploadError}
                  </p>
                )}
                {upload && (
                  <div className="upload-preview">
                    <Badge tone="green">Validation passed</Badge>
                    <h3>{upload.name}</h3>
                    <p>
                      {upload.rows} stock positions · 4,032 daily observations ·
                      all quantities validated
                    </p>
                    <p>
                      Import replaces available stock and sales history.
                      Previous decisions remain in the ledger. Existing
                      dismissals are archived so new stock positions can be
                      replanned.
                    </p>
                    <button
                      className="button primary full"
                      disabled={
                        busy || pending.length > 0 || mode === "loading"
                      }
                      onClick={commitUpload}
                    >
                      {busy ? (
                        <Loader2 size={15} className="spin" />
                      ) : (
                        <Check size={15} />
                      )}{" "}
                      Import validated snapshot
                    </button>
                  </div>
                )}
                {pending.length > 0 && (
                  <div className="guardrail">
                    <Truck size={18} />
                    <p>
                      Receive all {pending.length} reserved transfers before
                      importing, to keep physical and reserved stock consistent.
                    </p>
                  </div>
                )}
                <p className="fine-print">
                  Import is atomic and recorded in the ledger. Export a
                  workspace backup before replacing data. This is a
                  single-workspace prototype: server reads are public, so use
                  non-sensitive data only.
                </p>
              </section>
              <section className="panel methodology">
                <span className="mini-label">DATA CONTRACT</span>
                <h2>Good decisions start with good inputs.</h2>
                <dl>
                  <dt>Exact header</dt>
                  <dd>
                    <code>
                      product_id,location_id,stock,sales_day_1,…,sales_day_84
                    </code>
                  </dd>
                  <dt>Observation order</dt>
                  <dd>
                    Oldest to newest. Day 84 is the latest completed day. Supply
                    84 consecutive days with no missing dates.
                  </dd>
                  <dt>Complete snapshot</dt>
                  <dd>
                    Every catalog product × location pair must appear exactly
                    once. Unknown or duplicate positions fail validation.
                    Partial uploads are rejected.
                  </dd>
                  <dt>Quantity validation</dt>
                  <dd>
                    Non-negative whole units, up to 1,000,000. No blank values,
                    formulas, quoted fields, or thousands separators. Zero sales
                    are accepted; WAPE is unavailable for all-zero demand.
                  </dd>
                  <dt>Business assumptions</dt>
                  <dd>
                    Catalog contribution margins remain the demo values.
                    Stockout-censored sales are not true demand. Reconcile data
                    before interpreting financial estimates.
                  </dd>
                  <dt>Persistence</dt>
                  <dd>
                    {mode === "server"
                      ? "Server mode commits the new snapshot and event in one SQLite transaction."
                      : "Sandbox mode stores the imported snapshot on this browser only."}
                  </dd>
                </dl>
              </section>
            </div>
          )}
          <footer>
            <span>
              <ArrowLeftRight size={13} /> reflow{" "}
              <span className="footer-by">by SwiftCart</span>
            </span>
            <span>Thoughtful decisions. Better business.</span>
            <button onClick={() => go("Model evaluation")}>
              Methodology & limitations <ArrowUpRight size={12} />
            </button>
          </footer>
        </main>
      </div>
      {detail && (
        <div className="overlay" onClick={() => !busy && setDetail(null)}>
          <section
            className="drawer"
            ref={drawerRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label="Review transfer recommendation"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="drawer-top">
              <span className="mini-label">
                <Sparkles size={14} /> OPPORTUNITY REVIEW
              </span>
              <button
                className="icon-button"
                disabled={busy}
                aria-label="Close review"
                onClick={() => setDetail(null)}
              >
                <X size={20} />
              </button>
            </div>
            <ProductIcon product={detail} />
            <h2>{detail.name}</h2>
            <p className="subtle">
              {detail.productId} · {detail.category}
            </p>
            <div className="drawer-route">
              <div>
                <small>FROM</small>
                <strong>{city(detail.from)}</strong>
              </div>
              <ArrowRight size={24} />
              <div>
                <small>TO</small>
                <strong>{city(detail.to)}</strong>
              </div>
            </div>
            <div className="detail-metrics">
              <div>
                <small>Units to move</small>
                <strong>{detail.units}</strong>
              </div>
              <div>
                <small>Estimated net benefit</small>
                <strong>{money(detail.net)}</strong>
              </div>
              <div>
                <small>Freight estimate</small>
                <strong>{money(detail.cost)}</strong>
              </div>
              <div>
                <small>Expected transit</small>
                <strong>{detail.transitDays} days</strong>
              </div>
            </div>
            <h3>Why this move?</h3>
            <div className="evidence-list">
              {detail.evidence.map((e, i) => (
                <div key={i}>
                  <span>{i + 1}</span>
                  <p>{e}</p>
                </div>
              ))}
            </div>
            <div className="guardrail">
              <ShieldCheck size={18} />
              <p>
                Approval reserves donor stock and creates a transfer order.
                Destination inventory changes after you confirm receipt.
                Estimated benefits are not guaranteed.
              </p>
            </div>
            <div className="drawer-buttons">
              <button
                className="button primary"
                disabled={busy || mode === "loading"}
                onClick={() => decide("approved")}
              >
                {busy ? (
                  <Loader2 className="spin" size={16} />
                ) : (
                  <Check size={16} />
                )}{" "}
                Approve transfer
              </button>
              <button
                className="button"
                disabled={busy}
                onClick={() => decide("dismissed")}
              >
                Dismiss
              </button>
            </div>
            <p className="fine-print">
              {mode === "demo"
                ? "Browser sandbox · saved on this device"
                : "API workspace · authenticated write required"}{" "}
              · Revision {state.version}
            </p>
          </section>
        </div>
      )}
      {settings && (
        <div className="overlay centered" onClick={() => setSettings(false)}>
          <section
            className="settings-modal"
            ref={modalRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label="Workspace settings"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="drawer-top">
              <span className="mini-label">WORKSPACE SETTINGS</span>
              <button
                className="icon-button"
                onClick={() => setSettings(false)}
                aria-label="Close settings"
              >
                <X size={20} />
              </button>
            </div>
            <h2>A workspace you can inspect.</h2>
            <p>
              {mode === "server"
                ? "Connected to the local SQLite-backed API."
                : "Running a self-contained browser sandbox with synthetic data. Decisions are saved in local storage on this device."}
            </p>
            <label>
              Operator API token
              <input
                aria-label="Operator API token"
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Required for server-backed decisions"
                autoComplete="off"
              />
            </label>
            <p className="fine-print">
              Kept in memory for this tab. Configure OPS_API_TOKEN on the
              server. Never place credentials in the client build.
            </p>
            <button
              className="button full"
              onClick={() => {
                download(
                  "reflow-workspace.json",
                  JSON.stringify(state, null, 2),
                  "application/json",
                );
                notify("Workspace snapshot exported.");
              }}
            >
              <ArrowDownToLine size={15} /> Export workspace snapshot
            </button>
            <div className="settings-facts">
              <span>
                Dataset{" "}
                <strong>
                  48 {state.dataset === "imported" ? "imported" : "synthetic"}{" "}
                  stock positions
                </strong>
              </span>
              <span>
                Engine <strong>{analysis.engine}</strong>
              </span>
              <span>
                Mode <strong>{mode}</strong>
              </span>
            </div>
            <div className="workspace-recovery">
              <strong>Workspace recovery</strong>
              <p>Keep a backup before resetting the browser sandbox.</p>
              <button
                className="button full"
                onClick={() => {
                  try {
                    download(
                      "reflow-stored-backup.json",
                      localStorage.getItem(KEY) || JSON.stringify(state),
                      "application/json",
                    );
                  } catch (e) {
                    notify(e.message);
                  }
                }}
              >
                Download stored backup
              </button>
              {mode === "demo" && (
                <button
                  className="button full danger-button"
                  onClick={() => {
                    if (
                      !window.confirm(
                        "Reset this browser sandbox? Saved decisions and imported data on this device will be replaced with the sample dataset.",
                      )
                    )
                      return;
                    try {
                      setState(resetLocal());
                      setStorageWarning("");
                      setUpload(null);
                      setAnswer("");
                      setDetail(null);
                      notify("Fresh demo workspace created.");
                    } catch (e) {
                      notify(e.message);
                    }
                  }}
                >
                  Reset browser sandbox
                </button>
              )}
            </div>
            <button
              className="button primary full"
              onClick={() => {
                setSettings(false);
                go("Model evaluation");
              }}
            >
              View model card <ArrowRight size={15} />
            </button>
          </section>
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          <span>{toast}</span>
          <button
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
function Metric({ title, value, icon: Icon, label, tone }) {
  return (
    <section className="metric-card">
      <div>
        <span>{title}</span>
        <Icon size={16} />
      </div>
      <strong className="metric-value">{value}</strong>
      <p>
        <i className={`dot ${tone}`} />
        {label}
      </p>
    </section>
  );
}
function FilterBar({ search, setSearch, location, setLocation }) {
  return (
    <div className="filter-bar">
      <label className="search-field">
        <Search size={16} />
        <input
          aria-label="Search products or locations"
          placeholder="Search products, SKUs, locations…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <button
            className="icon-button"
            aria-label="Clear search"
            onClick={() => setSearch("")}
          >
            <X size={14} />
          </button>
        )}
      </label>
      <select
        aria-label="Location filter"
        value={location}
        onChange={(e) => setLocation(e.target.value)}
      >
        <option value="all">All locations</option>
        {locations.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </select>
      <span className="filter-hint">
        <SlidersHorizontal size={14} /> Live filters
      </span>
    </div>
  );
}
