import { createServer } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createStore } from "./store.js";
import { analyze, evaluate } from "../client/src/domain/engine.js";
import { askCopilot } from "./copilot.js";

const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".json": "application/json",
  ".woff2": "font/woff2",
};
export function createApp({
  store = createStore(),
  token = process.env.OPS_API_TOKEN,
  staticDir = resolve("client/dist"),
} = {}) {
  const limits = new Map();
  const server = createServer(async (req, res) => {
    const json = (status, data) => {
      res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      });
      res.end(JSON.stringify(data));
    };
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "same-origin");
    res.setHeader("X-Frame-Options", "DENY");
    let path;
    try {
      path = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    } catch {
      json(400, { error: "Invalid request path." });
      return;
    }
    try {
      if (path.startsWith("/api/")) {
        if (req.method === "GET" && path === "/api/health")
          return json(200, {
            status: "ok",
            service: "reflow",
            storage: "sqlite",
            dataset: "synthetic",
          });
        if (req.method === "GET" && path === "/api/ops/workspace")
          return json(200, store.read());
        if (req.method === "GET" && path === "/api/ops/evaluation")
          return json(200, evaluate(store.read()));
        if (req.method === "GET" && path === "/api/ops/audit/verify")
          return json(200, store.verify());
        if (
          req.method !== "POST" ||
          ![
            "/api/ops/decisions",
            "/api/ops/receipts",
            "/api/ops/copilot",
            "/api/ops/simulate",
            "/api/ops/import",
          ].includes(path)
        )
          return json(404, { error: "Unknown API route." });
        const incoming = req.headers.authorization || "";
        const expected = `Bearer ${token || ""}`;
        if (
          !token ||
          Buffer.byteLength(incoming) !== Buffer.byteLength(expected) ||
          !timingSafeEqual(Buffer.from(incoming), Buffer.from(expected))
        )
          return json(401, {
            error:
              "An operator token is required. Enter OPS_API_TOKEN in Workspace settings.",
          });
        const origin = req.headers.origin;
        const allowedOrigin = process.env.OPS_ALLOWED_ORIGIN;
        if (
          origin &&
          origin !== `http://${req.headers.host}` &&
          origin !== `https://${req.headers.host}` &&
          origin !== allowedOrigin
        )
          return json(403, { error: "Origin is not allowed." });
        const key = req.socket.remoteAddress || "local";
        const now = Date.now();
        if (limits.size > 1000)
          for (const [k, v] of limits) if (v.until < now) limits.delete(k);
        const limit = limits.get(key);
        if (limit && limit.until > now && limit.count >= 60)
          return json(429, {
            error: "Too many requests. Try again in a minute.",
          });
        limits.set(
          key,
          limit && limit.until > now
            ? { ...limit, count: limit.count + 1 }
            : { count: 1, until: now + 60000 },
        );
        const bodyLimit = path === "/api/ops/import" ? 524288 : 16384;
        let text = "";
        for await (const chunk of req) {
          text += chunk;
          if (Buffer.byteLength(text) > bodyLimit)
            return json(413, {
              error: "Request body exceeds the allowed size.",
            });
        }
        let body;
        try {
          body = JSON.parse(text);
        } catch {
          return json(400, { error: "Invalid JSON." });
        }
        if (!body || typeof body !== "object" || Array.isArray(body))
          return json(400, { error: "A JSON object is required." });
        if (path === "/api/ops/simulate")
          return json(200, analyze(store.read(), body));
        if (path === "/api/ops/copilot")
          return json(
            200,
            await askCopilot(store.read(), body.question, body.horizon),
          );
        if (path === "/api/ops/import")
          return json(
            200,
            store.commit(
              { ...body, actor: "Authenticated operator" },
              "import",
            ),
          );
        return json(
          200,
          store.commit(
            { ...body, actor: "Authenticated operator" },
            path === "/api/ops/receipts",
          ),
        );
      }
      if (req.method !== "GET" && req.method !== "HEAD") {
        res.writeHead(405);
        return res.end();
      }
      const target = resolve(staticDir, `.${path}`);
      if (target !== staticDir && !target.startsWith(staticDir + sep))
        return json(403, { error: "Forbidden path." });
      let file = target;
      try {
        if (!(await stat(file)).isFile())
          file = resolve(staticDir, "index.html");
      } catch {
        if (extname(path)) return json(404, { error: "Asset not found." });
        file = resolve(staticDir, "index.html");
      }
      let content;
      try {
        content = await readFile(file);
      } catch {
        return json(503, {
          error: "Client build is missing. Run npm run build.",
        });
      }
      res.writeHead(200, {
        "Content-Type": mime[extname(file)] || "application/octet-stream",
        "Cache-Control": file.endsWith("index.html")
          ? "no-cache"
          : "public, max-age=3600",
      });
      res.end(req.method === "HEAD" ? undefined : content);
    } catch (error) {
      const message = error.message || "Request failed.";
      const conflict =
        /Workspace changed|no longer actionable|already used|reserved transfer/i.test(
          message,
        );
      json(
        conflict
          ? 409
          : /model|fetch|timeout|structured|evidence validation/i.test(message)
            ? 502
            : 400,
        { error: message },
      );
    }
  });
  server.requestTimeout = 35000;
  server.headersTimeout = 10000;
  return server;
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const store = createStore();
  const server = createApp({ store });
  server.listen(
    Number(process.env.PORT) || 8080,
    process.env.HOST || "127.0.0.1",
    () =>
      console.log(
        `Reflow API + workspace: http://${process.env.HOST || "127.0.0.1"}:${Number(process.env.PORT) || 8080}`,
      ),
  );
  const close = () =>
    server.close(() => {
      store.close();
      process.exit(0);
    });
  process.on("SIGINT", close);
  process.on("SIGTERM", close);
}
