/**
 * server/index.js
 * ───────────────
 * Lightweight Express server that:
 *  1. Serves the built React app from ./dist
 *  2. Exposes /api/scans        – list all .xml files in SCANS_DIR
 *  3. Exposes /api/scans/:file  – return raw XML content of a specific file
 *  4. Exposes /api/login        – placeholder (no-op, always succeeds)
 *  5. Exposes /api/logout       – placeholder (no-op)
 *  6. Exposes /api/auth/check   – always returns authenticated: true
 *  7. Exposes /api/health       – liveness probe (for Docker healthcheck)
 *
 * Environment variables:
 *  PORT      – HTTP port to listen on  (default: 3001)
 *  SCANS_DIR – Absolute path to XML files (default: /scans)
 *
 * Authentication is disabled. The /api/login, /api/logout, and
 * /api/auth/check endpoints are kept as placeholders.
 */

import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT      = parseInt(process.env.PORT ?? "3001", 10);
const SCANS_DIR = process.env.SCANS_DIR ?? "/scans";
const DIST_DIR  = path.join(__dirname, "..", "dist");

const app = express();
app.use(express.json());

/* ── Public: health probe (used by Docker healthcheck) ───── */
app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

/* ── Placeholder: login (authentication disabled) ────────── */
app.post("/api/login", (_req, res) => {
  res.json({ ok: true });
});

/* ── Placeholder: auth check (authentication disabled) ───── */
app.get("/api/auth/check", (_req, res) => {
  res.json({ authenticated: true });
});

/* ── Placeholder: logout (authentication disabled) ───────── */
app.post("/api/logout", (_req, res) => {
  res.json({ ok: true });
});

/* ── Security: restrict file access to SCANS_DIR only ─────── */
function safePath(filename) {
  const base = path.basename(filename);
  if (!base.endsWith(".xml")) return null;
  const resolved = path.resolve(SCANS_DIR, base);
  if (!resolved.startsWith(path.resolve(SCANS_DIR))) return null;
  return resolved;
}

/* ── Protected: list available XML scan files ─────────────── */
app.get("/api/scans", (_req, res) => {
  if (!fs.existsSync(SCANS_DIR)) {
    return res.json({ files: [], error: `Scans directory not found: ${SCANS_DIR}` });
  }

  try {
    const files = fs
      .readdirSync(SCANS_DIR)
      .filter((f) => f.endsWith(".xml"))
      .map((name) => {
        const fullPath = path.join(SCANS_DIR, name);
        const stat = fs.statSync(fullPath);
        return { name, size: stat.size, modified: stat.mtime.toISOString() };
      })
      .sort((a, b) => new Date(b.modified) - new Date(a.modified));

    res.json({ files });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── Protected: fetch raw XML for a specific file ─────────── */
app.get("/api/scans/:filename", (req, res) => {
  const filePath = safePath(req.params.filename);

  if (!filePath) {
    return res.status(400).json({ error: "Invalid filename" });
  }
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "File not found" });
  }

  try {
    const content = fs.readFileSync(filePath, "utf-8");
    res.type("application/xml").send(content);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── Protected: list scheduled scan configs ───────────────── */
const CONFIG_DIR = path.join(SCANS_DIR, "config");

app.get("/api/schedules", (_req, res) => {
  if (!fs.existsSync(CONFIG_DIR)) {
    return res.json({ schedules: [] });
  }

  try {
    const files = fs.readdirSync(CONFIG_DIR).filter((f) => f.endsWith(".json"));
    const schedules = files
      .map((name) => {
        try {
          const raw = fs.readFileSync(path.join(CONFIG_DIR, name), "utf-8");
          return { ...JSON.parse(raw), _file: name };
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .sort((a, b) => new Date(a.nextRun || 0) - new Date(b.nextRun || 0));

    res.json({ schedules });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── SPA static file serving ──────────────────────────────── */
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.get("/*splat", (_req, res) => {
    res.sendFile(path.join(DIST_DIR, "index.html"));
  });
} else {
  app.get("/", (_req, res) =>
    res.send("React build not found. Run `npm run build` first.")
  );
}

/* ── Start ────────────────────────────────────────────────── */
app.listen(PORT, () => {
  console.log(`XMLMonitor server listening on http://0.0.0.0:${PORT}`);
  console.log(`Serving XML scans from: ${SCANS_DIR}`);
});
