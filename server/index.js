/**
 * server/index.js
 * ───────────────
 * Lightweight Express server that:
 *  1. Serves the built React app from ./dist
 *  2. Exposes /api/scans        – list all .xml files in SCANS_DIR (protected)
 *  3. Exposes /api/scans/:file  – return raw XML content of a file (protected)
 *  4. Exposes /api/login        – validates credentials, returns a signed JWT
 *  5. Exposes /api/logout       – client-side only; server-side is a no-op
 *  6. Exposes /api/auth/check   – verifies a JWT, returns { authenticated: true }
 *  7. Exposes /api/health       – liveness probe (no auth required)
 *  8. Exposes /api/schedules    – list scheduled scan configs (protected)
 *
 * Environment variables:
 *  PORT       – HTTP port to listen on  (default: 3001)
 *  SCANS_DIR  – Absolute path to XML files (default: /scans)
 *  JWT_SECRET – Secret used to sign/verify JWTs (required — server exits on startup if missing)
 *  AUTH_USER  – Login username (default: admin)
 *  AUTH_PASS  – Login password (default: changeme)
 */

import "dotenv/config";
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import jwt from "jsonwebtoken";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT      = parseInt(process.env.PORT ?? "3001", 10);
const SCANS_DIR = process.env.SCANS_DIR ?? "/scans";
const DIST_DIR  = path.join(__dirname, "..", "dist");

// ── JWT configuration ─────────────────────────────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRY = "8h";

if (!JWT_SECRET) {
  console.error("ERROR: Missing JWT_SECRET environment variable. Set it in .env or the container environment.");
  process.exit(1);
}

// ── Credentials (read from environment; backward-compatible with docker-compose) ─
const AUTH_USER = process.env.AUTH_USER ?? "admin";
const AUTH_PASS = process.env.AUTH_PASS ?? "admin";

// ── Auth middleware ───────────────────────────────────────────────────────────
function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing token" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(403).json({ error: "Invalid or expired token" });
  }
}

const app = express();
app.use(express.json());

/* ── Public: health probe (used by Docker healthcheck) ───── */
app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

/* ── Public: login — validates credentials and returns a JWT ─ */
app.post("/api/login", (req, res) => {
  const { username, password } = req.body ?? {};
  // Constant-time-style comparison via string equality is sufficient for static creds.
  // Replace with a real DB + bcrypt comparison for production multi-user setups.
  if (username !== AUTH_USER || password !== AUTH_PASS) {
    return res.status(401).json({ error: "Invalid username or password" });
  }
  const token = jwt.sign({ sub: username, role: "user" }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
  res.json({ token });
});

/* ── Protected: verify a JWT (used for session restore on page load) ── */
app.get("/api/auth/check", authenticateToken, (_req, res) => {
  res.json({ authenticated: true });
});

/* ── Public: logout — token invalidation is client-side only ─ */
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
app.get("/api/scans", authenticateToken, (_req, res) => {
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
app.get("/api/scans/:filename", authenticateToken, (req, res) => {
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

app.get("/api/schedules", authenticateToken, (_req, res) => {
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
