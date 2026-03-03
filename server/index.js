/**
 * server/index.js
 * ───────────────
 * Lightweight Express server that:
 *  1. Serves the built React app from ./dist
 *  2. Exposes /api/scans  – list all .xml files in SCANS_DIR
 *  3. Exposes /api/scans/:file – return raw XML content of a specific file
 *
 * Environment variables:
 *  PORT      – HTTP port to listen on     (default: 3001)
 *  SCANS_DIR – Absolute path to XML files (default: /scans)
 */

import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = parseInt(process.env.PORT ?? "3001", 10);
const SCANS_DIR = process.env.SCANS_DIR ?? "/scans";
const DIST_DIR = path.join(__dirname, "..", "dist");

const app = express();

/* ── Security: restrict file access to SCANS_DIR only ─────── */
function safePath(filename) {
  // Strip directory traversal attempts
  const base = path.basename(filename);
  if (!base.endsWith(".xml")) return null;
  const resolved = path.resolve(SCANS_DIR, base);
  if (!resolved.startsWith(path.resolve(SCANS_DIR))) return null;
  return resolved;
}

/* ── API: list available XML scan files ───────────────────── */
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
        return {
          name,
          size: stat.size,
          modified: stat.mtime.toISOString(),
        };
      })
      .sort((a, b) => new Date(b.modified) - new Date(a.modified));

    res.json({ files });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── API: fetch raw XML for a specific file ───────────────── */
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

/* ── SPA static file serving ──────────────────────────────── */
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  // Catch-all: return index.html so React Router (if added later) works
  // Express v5 requires named wildcards: /*splat instead of *
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
