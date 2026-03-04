/**
 * server/index.js
 * ───────────────
 * Lightweight Express server that:
 *  1. Serves the built React app from ./dist
 *  2. Exposes /api/scans        – list all .xml files in SCANS_DIR
 *  3. Exposes /api/scans/:file  – return raw XML content of a specific file
 *  4. Exposes /api/login        – exchange credentials for a session cookie
 *  5. Exposes /api/logout       – invalidate the session cookie
 *  6. Exposes /api/auth/check   – returns 200 if session is valid, 401 if not
 *  7. Exposes /api/health       – unauthenticated liveness probe (for Docker healthcheck)
 *
 * Environment variables:
 *  PORT      – HTTP port to listen on           (default: 3001)
 *  SCANS_DIR – Absolute path to XML files       (default: /scans)
 *  AUTH_USER – Login username                   (default: admin)
 *  AUTH_PASS – Login password                   (default: changeme)
 *
 * Authentication flow:
 *  - POST /api/login with JSON { username, password }
 *  - Server validates credentials against AUTH_USER / AUTH_PASS env vars
 *  - On success: generates a random 64-char hex session token, stores it in
 *    memory with an expiry timestamp, and sets it as an HttpOnly cookie named
 *    "session". HttpOnly means JavaScript cannot read this cookie — it is sent
 *    automatically by the browser on every request.
 *  - All /api/scans* routes are protected by requireAuth middleware which reads
 *    the session cookie and rejects requests with a missing or expired token.
 *  - Sessions expire after SESSION_TTL_MS of inactivity (default 8 hours).
 *    Each valid request resets the expiry timer.
 */

import express from "express";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT      = parseInt(process.env.PORT      ?? "3001",      10);
const SCANS_DIR = process.env.SCANS_DIR ?? "/scans";
const DIST_DIR  = path.join(__dirname, "..", "dist");
const AUTH_USER = process.env.AUTH_USER ?? "admin";
const AUTH_PASS = process.env.AUTH_PASS ?? "admin";
const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours
const COOKIE_NAME = "session";

if (!process.env.AUTH_USER || !process.env.AUTH_PASS) {
  console.warn(
    "[WARN] AUTH_USER / AUTH_PASS env vars not set. " +
    `Using defaults (${AUTH_USER} / ${AUTH_PASS}). Set these in docker-compose.yml!`
  );
}

/* ── Session store (in-memory) ────────────────────────────── */
// Map<token, expiresAt (ms timestamp)>
const sessions = new Map();

function createSession() {
  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, Date.now() + SESSION_TTL_MS);
  return token;
}

function isValidSession(token) {
  if (!token) return false;
  const expiresAt = sessions.get(token);
  if (!expiresAt) return false;
  if (Date.now() > expiresAt) {
    sessions.delete(token);
    return false;
  }
  // Sliding expiry — reset the timer on each valid request
  sessions.set(token, Date.now() + SESSION_TTL_MS);
  return true;
}

function deleteSession(token) {
  sessions.delete(token);
}

/* ── Cookie helpers (no external dependencies) ────────────── */
function parseCookies(req) {
  const cookies = {};
  const header = req.headers.cookie;
  if (!header) return cookies;
  header.split(";").forEach((part) => {
    const [name, ...rest] = part.split("=");
    if (name?.trim()) cookies[name.trim()] = decodeURIComponent(rest.join("=").trim());
  });
  return cookies;
}

function setSessionCookie(res, token) {
  // HttpOnly: JS cannot read it. SameSite=Strict: not sent on cross-site requests.
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL_MS / 1000}`
  );
}

function clearSessionCookie(res) {
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`
  );
}

/* ── Auth middleware ──────────────────────────────────────── */
function requireAuth(req, res, next) {
  const token = parseCookies(req)[COOKIE_NAME];
  if (!isValidSession(token)) {
    return res.status(401).json({ error: "Unauthorised" });
  }
  next();
}

const app = express();
app.use(express.json());

/* ── Public: health probe (used by Docker healthcheck) ───── */
app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

/* ── Public: login ────────────────────────────────────────── */
app.post("/api/login", (req, res) => {
  const { username, password } = req.body ?? {};

  // Constant-time comparison to prevent timing attacks
  const userMatch =
    username?.length === AUTH_USER.length &&
    crypto.timingSafeEqual(Buffer.from(username), Buffer.from(AUTH_USER));
  const passMatch =
    password?.length === AUTH_PASS.length &&
    crypto.timingSafeEqual(Buffer.from(password), Buffer.from(AUTH_PASS));

  if (!userMatch || !passMatch) {
    return res.status(401).json({ error: "Invalid username or password" });
  }

  const token = createSession();
  setSessionCookie(res, token);
  res.json({ ok: true });
});

/* ── Public: auth check ───────────────────────────────────── */
app.get("/api/auth/check", (req, res) => {
  const token = parseCookies(req)[COOKIE_NAME];
  if (!isValidSession(token)) {
    return res.status(401).json({ authenticated: false });
  }
  res.json({ authenticated: true });
});

/* ── Protected: logout ────────────────────────────────────── */
app.post("/api/logout", requireAuth, (req, res) => {
  const token = parseCookies(req)[COOKIE_NAME];
  deleteSession(token);
  clearSessionCookie(res);
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
app.get("/api/scans", requireAuth, (_req, res) => {
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
app.get("/api/scans/:filename", requireAuth, (req, res) => {
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
