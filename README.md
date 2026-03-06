# ElementMonitor

A self-hosted web application for viewing, browsing, and analysing Nmap XML scan files. Scan files are placed into a bind-mounted directory and are instantly accessible through the web UI without any manual import step.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [How to Run](#how-to-run)
3. [Authentication](#authentication)
4. [File Naming Convention](#file-naming-convention)
5. [File-by-File Reference](#file-by-file-reference)
   - [Dockerfile](#dockerfile)
   - [docker-compose.yml](#docker-composeyml)
   - [.dockerignore](#dockerignore)
   - [package.json](#packagejson)
   - [vite.config.js](#viteconfigjs)
   - [index.html](#indexhtml)
   - [server/index.js](#serverindexjs)
   - [src/main.jsx](#srcmainjsx)
   - [src/App.jsx](#srcappjsx)
   - [src/index.css](#srcindexcss)
   - [src/lib/nmapParser.js](#srclibnmapparserjs)
   - [src/hooks/useHostFilter.js](#srchooksusehostfilterjs)
   - [src/components/LoginPage.jsx](#srccomponentsloginpagejsx)
   - [src/components/ScanPicker.jsx](#srccomponentsscanpickerjsx)
   - [src/components/ActiveScans.jsx](#srccomponentsactivescansjsx)
   - [src/components/SummaryCards.jsx](#srccomponentssummarycardsjsx)
   - [src/components/PortOverview.jsx](#srccomponentsportoverviewjsx)
   - [src/components/SearchBar.jsx](#srccomponentssearchbarjsx)
   - [src/components/HostTable.jsx](#srccomponentshosttablejsx)
   - [src/components/HostDetail.jsx](#srccomponentshostdetailjsx)
6. [Data Flow — End to End](#data-flow--end-to-end)
7. [Key Data Structures](#key-data-structures)
8. [Common Bug Locations](#common-bug-locations)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│  Docker Container (port 3001)                               │
│                                                             │
│  ┌──────────────────────────┐  ┌────────────────────────┐  │
│  │  Express Server          │  │  React Frontend (dist/)│  │
│  │  server/index.js         │─▶│  Built by Vite         │  │
│  │                          │  │  Served as static files│  │
│  │  POST /api/login         │  └────────────────────────┘  │
│  │  POST /api/logout        │                               │
│  │  GET  /api/auth/check    │                               │
│  │  GET  /api/health        │                               │
│  │  GET  /api/scans     🔒  │                               │
│  │  GET  /api/scans/:fn 🔒  │                               │
│  └──────────┬───────────────┘                               │
│             │                                               │
│             ▼                                               │
│  ┌──────────────────────┐                                   │
│  │  /scans (bind mount) │  ← Host machine's scan directory  │
│  └──────────────────────┘                                   │
└─────────────────────────────────────────────────────────────┘
```

🔒 = requires a valid session cookie (see [Authentication](#authentication))

The Express server handles **three** responsibilities:
1. Serves the compiled React app as static files from `dist/`.
2. Manages user authentication via session cookies.
3. Exposes a protected API allowing the browser to list and fetch XML files from the `/scans` directory.

All filtering, searching, and sorting happens entirely **client-side** in the browser after the XML is fetched — no further server calls are made until the user selects a different file.

---

## How to Run

### Production (Docker)

```bash
docker-compose up --build
```

The app is then available at `http://localhost:3001`.

**Before deploying**, set your credentials in `docker-compose.yml`:
```yaml
environment:
  - AUTH_USER=yourUsername
  - AUTH_PASS=yourPassword
```
The defaults (`admin` / `admin`) are only suitable for local testing.

Place Nmap XML scan files into the `./scans` directory on the host machine. They appear in the sidebar immediately (the sidebar polls on mount and can be manually refreshed).

### Development

```bash
# Terminal 1 — Express API
node server/index.js

# Terminal 2 — Vite dev server (hot-reload)
npx vite
```

Vite runs on port 5173 (or the next available port) and proxies all `/api/*` requests to Express on port 3001.

Default development credentials (set as env var defaults in `server/index.js`):
- **Username:** `admin`
- **Password:** `admin`

---

## Authentication

The entire application is gated behind a login page. No scan data, API endpoints, or UI content is accessible without a valid session.

### How it works

1. On first load, React calls `GET /api/auth/check`. If no valid session cookie exists, the login page is rendered.
2. The user submits their username and password. The browser POSTs `{ username, password }` JSON to `POST /api/login`.
3. The server validates credentials using `crypto.timingSafeEqual` (constant-time comparison to prevent timing attacks), then generates a 64-character hex session token using `crypto.randomBytes`.
4. The token is stored in an in-memory `Map` on the server with an expiry timestamp, and sent to the browser as an `HttpOnly; SameSite=Strict` cookie named `session`.
   - **HttpOnly** means JavaScript cannot read the cookie — it is sent automatically by the browser on every request.
   - **SameSite=Strict** means the cookie is never sent on cross-site requests.
5. All subsequent requests to `/api/scans` and `/api/scans/:filename` pass through `requireAuth` middleware which validates the session token.
6. Sessions last **8 hours** with a sliding expiry — each valid request resets the 8-hour timer.
7. The "Sign out" button calls `POST /api/logout`, which deletes the server-side session and instructs the browser to clear the cookie.

### Credentials

Credentials are set via environment variables:

| Variable | Default | Description |
|---|---|---|
| `AUTH_USER` | `admin` | Login username |
| `AUTH_PASS` | `admin` | Login password |

If neither variable is set, the server logs a warning and accepts the defaults. **Always set these before exposing the app to a network.**

### Public endpoints (no auth required)

| Endpoint | Purpose |
|---|---|
| `POST /api/login` | Submit credentials, receive session cookie |
| `GET /api/auth/check` | Check whether the current session cookie is valid |
| `GET /api/health` | Docker healthcheck liveness probe |

### Limitations

- Sessions are stored in memory — they are lost if the server restarts. Users will need to log in again after a server restart or container redeploy.
- Only a single username/password pair is supported. For multi-user support, a database-backed auth system would be needed.
- There is no rate limiting on login attempts. For internet-facing deployments, consider placing the app behind a reverse proxy with rate limiting (e.g. nginx).

---

## File Naming Convention

The app parses metadata directly from the filename. The expected format is:

```
SITECODE#SiteName#IPAddress#YYYYMMDDHHmmss.xml
```

**Example:**
```
HELP#Hull#192.168.1.1#20260303120000.xml
```

| Segment | Example | Description |
|---|---|---|
| `SITECODE` | `HELP` | Short uppercase site identifier shown in the table banner |
| `SiteName` | `Hull` | Human-readable site name. Underscores `_` are replaced with spaces in the UI |
| `IPAddress` | `192.168.1.1` | The IP address the scan was run against |
| `Timestamp` | `20260303120000` | Scan date/time in `YYYYMMDDHHmmss` format |

Files that **do not** follow this convention will still load — they just won't have site code / site name metadata populated.

---

## File-by-File Reference

---

### `Dockerfile`

**Purpose:** Multi-stage Docker build recipe.

**Stage 1 — `builder`:**
- Starts from `node:20-alpine`.
- Copies `package*.json` and runs `npm ci` to install all dependencies (including dev dependencies needed for the build).
- Copies the entire source tree and runs `npm run build`, which uses Vite to compile the React app into the `dist/` folder.

**Stage 2 — Production image:**
- Starts from a fresh `node:20-alpine`.
- Runs `npm ci --omit=dev` — installs only the production dependencies (Express, fast-xml-parser, etc.). Dev tools like Vite and ESLint are excluded, keeping the image small.
- Copies `server/` (the Express server) and `dist/` (the built React app from stage 1) into the image.
- Creates the `/scans` directory as the expected bind-mount point.
- Runs as a non-root user (`appuser`) for security.
- Sets environment variables: `PORT=3001`, `SCANS_DIR=/scans`, `NODE_ENV=production`.
- Exposes port 3001.
- Starts with `node server/index.js`.

**Bugfixing notes:**
- If the app serves a blank page in production, the `dist/` folder was either not built or not copied correctly. Check that `npm run build` succeeds in stage 1 and the `COPY --from=builder` line references the correct path.
- If `/api/scans` returns a "directory not found" error, the `/scans` path inside the container is not bind-mounted. Check `docker-compose.yml`.

---

### `docker-compose.yml`

**Purpose:** Defines the single `xmlmonitor` service.

**Key settings:**
- `build: .` — builds the image from the local `Dockerfile`.
- `ports: "3001:3001"` — maps host port 3001 to container port 3001.
- `volumes: ./scans:/scans:ro` — bind-mounts the local `./scans` folder into the container as read-only. The `:ro` flag means the app can only read files, never write or delete them.
- `restart: unless-stopped` — automatically restarts the container if it crashes or the host reboots.
- `AUTH_USER` / `AUTH_PASS` — login credentials. Defaults to `admin` / `admin`. **Change these before deploying.**
- `healthcheck` — polls `GET /api/health` (the public liveness endpoint) every 30 seconds. If it fails 3 times the container is marked unhealthy. Note: `/api/scans` cannot be used for the healthcheck because it is now auth-protected.

**Bugfixing notes:**
- If files you place in `./scans` don't appear in the sidebar, check that the bind-mount path is correct and the files end in `.xml`.
- Change `./scans` to an absolute path if relative paths cause issues on Windows hosts.
- If you change `AUTH_USER` or `AUTH_PASS` while the container is running, you must restart the container for the new values to take effect.

---

### `.dockerignore`

**Purpose:** Prevents unnecessary files from being sent to the Docker build context, speeding up `docker build`.

**Currently excluded:**
- `node_modules/` — always excluded; Docker reinstalls them during build.
- `dist/` — always rebuilt inside the container.
- `.git/` — version control history is irrelevant inside the image.
- `*.md` — documentation files.
- `.env*` — prevents accidental inclusion of secret environment files.
- `eslint.config.js` — linting config not needed at runtime.
- `scans/` — scan data is bind-mounted at runtime, not baked into the image.

---

### `package.json`

**Purpose:** Node.js project manifest. Defines scripts, dependencies, and metadata.

**Key scripts:**
| Script | Command | Use |
|---|---|---|
| `dev` | `vite` | Starts the Vite hot-reload dev server |
| `build` | `vite build` | Compiles React source into `dist/` |
| `start` | `node server/index.js` | Starts the Express server (production) |
| `lint` | `eslint .` | Runs ESLint across the project |

**Runtime dependencies (included in the Docker image):**
- `express` — web server framework
- `fast-xml-parser` — parses Nmap XML into JavaScript objects
- `react` / `react-dom` — UI framework
- `lucide-react` — icon library
- `tailwindcss` — utility CSS framework
- `@headlessui/react` — accessible dialog/tab components (used in HostDetail)

**Dev dependencies (build only, not in the Docker image):**
- `vite` / `@vitejs/plugin-react` — build tool
- `@tailwindcss/vite` — Tailwind integration
- `eslint` and plugins — linting

---

### `vite.config.js`

**Purpose:** Configuration for the Vite build tool and development server.

**Key settings:**
- `plugins: [react(), tailwindcss()]` — enables React JSX compilation and Tailwind CSS processing.
- `server.proxy` — during development, any request to `/api/*` is forwarded to `http://localhost:3001` (the Express server). This means the dev server and the API server run separately but appear as one origin to the browser.

**Bugfixing notes:**
- If `/api/scans` returns a 404 during development, the Express server on port 3001 is not running. Start it with `node server/index.js`.
- If the proxy target needs to change (e.g. Express is on a different port), update `target` here.

---

### `index.html`

**Purpose:** The HTML entry point for the React application.

Contains a single `<div id="root">` element that React mounts into. The Vite build tool injects the compiled JS/CSS bundle references here automatically during `npm run build`.

**Bugfixing notes:**
- The favicon `<link>` references `/vite.svg`. If this file is deleted, the browser will log a 404 for the favicon — harmless but noisy.

---

### `server/index.js`

**Purpose:** The Express web server. This is the only file that runs in production (everything else is compiled into `dist/` by Vite).

**What it does:**

1. **`POST /api/login`** *(public)*
   - Accepts `{ username, password }` JSON body.
   - Validates against `AUTH_USER` / `AUTH_PASS` env vars using `crypto.timingSafeEqual` (constant-time comparison prevents timing attacks).
   - On success: creates a 64-char hex session token via `crypto.randomBytes`, stores it in the in-memory sessions `Map` with an expiry timestamp, and sets an `HttpOnly; SameSite=Strict` cookie named `session`.
   - Returns 401 on invalid credentials.

2. **`GET /api/auth/check`** *(public)*
   - Reads the `session` cookie and checks it against the sessions `Map`.
   - Returns `{ authenticated: true }` (200) if the session is valid, or `{ authenticated: false }` (401) if not.
   - Called by React on every page load to avoid showing the login page when a session already exists.

3. **`POST /api/logout`** *(requires auth)*
   - Deletes the session from the `Map` and sets the cookie `Max-Age` to 0, clearing it from the browser.

4. **`GET /api/health`** *(public)*
   - Returns `{ ok: true }`. Used as the Docker healthcheck target. Must remain unauthenticated since the healthcheck has no session cookie.

5. **`GET /api/scans`** 🔒
   - Reads the directory at `SCANS_DIR` (default `/scans`).
   - Filters to only `.xml` files.
   - Returns a JSON array of objects: `{ name, size, modified }`.
   - Files are sorted newest-first by modification time.
   - If the directory does not exist, returns `{ files: [], error: "..." }` rather than crashing.

6. **`GET /api/scans/:filename`** 🔒
   - Calls `safePath()` to validate the requested filename.
   - `safePath()` strips directory traversal attempts (`../`, etc.), enforces `.xml` extension, and resolves the path — rejecting any path that escapes `SCANS_DIR`.
   - Returns the raw XML file as `application/xml`.
   - Returns 400 if the filename is invalid, 404 if the file doesn't exist.

7. **Static file serving**
   - Serves everything in `DIST_DIR` (`../dist` relative to `server/`) as static files.
   - A catch-all route returns `index.html` for any unmatched path so that client-side routing (if added in future) works correctly.

**Session management:**
- Sessions are stored in a `Map<token, expiresAt>` in process memory.
- Expiry is **8 hours** with a sliding window — each valid authenticated request resets the timer.
- Sessions are lost on server restart. This is intentional — no persistence layer is required.

**Environment variables:**
| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | HTTP port to listen on |
| `SCANS_DIR` | `/scans` | Absolute path to the XML scan directory |
| `AUTH_USER` | `admin` | Login username |
| `AUTH_PASS` | `admin` | Login password |
| `NODE_ENV` | (unset) | Set to `production` in Docker |

**Bugfixing notes:**
- **Login always returns 401** → confirm `AUTH_USER` / `AUTH_PASS` env vars match what you are typing. The server logs the actual values at startup if they are using defaults.
- **"Cannot reach the server"** on the login page → Express on port 3001 is not running, or (in dev) Vite's proxy is not forwarding requests.
- **Logged out after server restart** → expected behaviour. In-memory sessions do not survive restarts.
- **"Scans directory not found"** in the UI → `SCANS_DIR` environment variable is wrong or the bind-mount is missing.
- **400 "Invalid filename"** → the filename contains `..`, doesn't end in `.xml`, or resolves outside `SCANS_DIR`.
- **Blank page served** → `DIST_DIR` (`../dist`) doesn't exist. Run `npm run build` first, or check the Dockerfile `COPY` step.
- Security: `safePath()` is the primary defence against path traversal. Never remove or weaken it.

---

### `src/main.jsx`

**Purpose:** React application entry point.

Mounts the `<App />` component into the `<div id="root">` in `index.html`. This is a standard React boilerplate file — it rarely needs to be changed.

---

### `src/App.jsx`

**Purpose:** Root layout component. Acts as the "glue" that connects all other components.

**State it owns:**
| State variable | Type | Description |
|---|---|---|
| `authenticated` | `null` \| `false` \| `true` | Auth state: `null` = checking session on mount, `false` = not logged in, `true` = logged in |
| `scanResult` | object \| null | The parsed scan data returned by `nmapParser.js`. Null until a file is loaded |
| `currentFile` | string \| null | Filename of the currently loaded scan. Passed to `ScanPicker` to highlight the active file |
| `parseError` | string \| null | Error message shown below the sidebar if XML parsing fails |
| `selectedHost` | object \| null | The host object currently open in the `HostDetail` slide-over panel |
| `selectedPort` | number \| null | Port number selected in `PortOverview` — filters the host table to show only hosts with that port open |

**Key logic:**
- **Auth check on mount** — `useEffect` calls `GET /api/auth/check` once. Sets `authenticated = true` on 200, `false` on 401. This restores existing sessions without forcing the user to log in after a page refresh.
- `handleLogout()` — POSTs to `/api/logout`, then resets `authenticated`, `scanResult`, `currentFile`, and `selectedHost` to their initial values.
- `handleLoadXml(xmlString, filename)` — called by `ScanPicker` when the user clicks a file. Passes the raw XML through `parseNmapXml()` and stores the result. If parsing throws, stores the error message instead.
- `useHostFilter(hosts, { portFilter })` — supplies `query`, `setQuery`, `sorted`, `sortKey`, `sortAsc`, `toggleSort` to the search bar and host table. The `portFilter` option filters hosts to those with the selected port open.

**Render logic (conditional):**
```
authenticated === null  →  Full-screen loading spinner
authenticated === false →  <LoginPage onLogin={() => setAuthenticated(true)} />
authenticated === true  →  Full application layout:
  <App>
    <header>          ← Sticky navbar (Element logo + app name + Sign out button)
    <main>
      <sidebar>       ← ScanPicker (file browser + file filters) + ActiveScans
      <content>
        <SummaryCards>   ← 4 stat cards (only shown when scan loaded)
        <PortOverview>   ← Unique open ports bar chart (clickable to filter hosts)
        <SearchBar>      ← Free-text host search
        <HostTable>      ← Sortable table of all hosts
    <HostDetail>      ← Slide-over panel (only rendered when selectedHost is set)
```

**Bugfixing notes:**
- If the login page flashes briefly on load even with a valid session, the `GET /api/auth/check` call is slower than expected. The `null` state shows a spinner to prevent this.
- If the table doesn't update after loading a file, check that `handleLoadXml` is being called and `setScanResult` is receiving valid data.
- `hosts` is derived from `scanResult?.hosts ?? []` — if `hosts` is empty when you expect data, the parser likely returned an empty array (check the XML structure).

---

### `src/index.css`

**Purpose:** Global CSS. Contains Tailwind import and custom class definitions.

**Custom classes:**
| Class | Description |
|---|---|
| `.animate-fade-in` | Fades elements in from slightly below on mount. Used by summary cards |
| `.animate-pulse-dot` | Infinite opacity pulse on the green status dot in the host table. `will-change: opacity` is set to offload this to the GPU and avoid CPU repaints |
| Custom scrollbar styles | `::-webkit-scrollbar` rules give the dark scrollbar appearance throughout the app |

**Bugfixing notes:**
- If the status dot animation causes high CPU usage on large scan files, the `will-change: opacity` declaration is what prevents this. Do not remove it.
- Tailwind classes themselves are generated at build time from scanning the JSX files — if you add a new dynamic Tailwind class using string concatenation, Vite/Tailwind may not include it in the production bundle. Use complete class names rather than constructing them from partial strings.

---

### `src/lib/nmapParser.js`

**Purpose:** Converts raw Nmap XML into clean, structured JavaScript objects. Completely isolated from the UI — no React imports.

**Exported function:**

#### `parseNmapXml(xmlString, filename)`

1. Uses `fast-xml-parser` to convert the XML string into a JavaScript object.
2. Validates the root `<nmaprun>` element exists — throws if not.
3. Calls `parseFilename(filename)` to extract site metadata from the filename.
4. Maps each `<host>` element through `normaliseHost()`.
5. Returns a `scanResult` object.

**Internal functions:**

| Function | Description |
|---|---|
| `normaliseHost(raw, fileMeta)` | Extracts IP, MAC, hostnames, ports, OS, subnet, scanTime, siteName, siteCode from a raw host object |
| `normalisePort(raw)` | Extracts protocol, portId, state, reason, service details, and NSE script results from a raw port object |
| `normaliseOs(raw)` | Extracts OS match names, accuracy percentages, and OS class details |
| `buildSummary(hosts)` | Calculates totals: total hosts, hosts up/down, count of open well-known ports, OS distribution |
| `normaliseArray(val)` | Ensures a value is always an array. Critical because `fast-xml-parser` collapses single-element XML arrays into plain objects |
| `parseFilename(filename)` | Parses the `SITECODE#SiteName#IP#Timestamp.xml` convention. Returns empty strings for any missing segment |
| `deriveSubnet(ip)` | Converts an IPv4 address to a `/24` subnet string (e.g. `192.168.1.55` → `192.168.1.0/24`) |
| `deriveSiteName(hostnames)` | Falls back to DNS domain extraction from hostnames when filename doesn't follow the convention |
| `deriveSiteCode(hostnames)` | Falls back to hostname prefix extraction when filename doesn't follow the convention |

**`buildSummary` — the `CRITICAL_PORTS` set:**
The "Open Ports" summary card counts ports from this hardcoded set:
```
21, 22, 23, 25, 53, 80, 110, 135, 139, 143, 443, 445, 993, 995,
1433, 1521, 3306, 3389, 5432, 5900, 6379, 8080, 8443, 27017
```
This is common well-known service ports. Add or remove entries here to change what counts toward the "Open Ports" summary card.

**Bugfixing notes:**
- **"Invalid Nmap XML – missing `<nmaprun>` root element"** → the file is not a valid Nmap XML output file, or is empty/truncated.
- **Empty host list** → `normaliseArray(nmaprun.host)` returned empty. The XML doesn't contain any `<host>` elements (scan found nothing), or the XML structure differs from the expected Nmap format.
- **Missing site name/code** → check that the filename follows `SITECODE#SiteName#IP#Timestamp.xml`. The `#` character is the delimiter.
- **`normaliseArray` is critical** — if removed or modified, any XML with a single host, single port, or single OS match will silently break because `fast-xml-parser` returns a plain object instead of an array for single-element nodes.

---

### `src/hooks/useHostFilter.js`

**Purpose:** Custom React hook that handles free-text search and column sorting for the host table. Runs entirely client-side with no API calls.

**What it returns:**
| Value | Type | Description |
|---|---|---|
| `query` | string | Current search box value |
| `setQuery` | function | Updates the search query |
| `sorted` | array | The filtered + sorted host array to pass to `HostTable` |
| `sortKey` | string | Column currently being sorted (`"ip"`, `"hostname"`, `"ports"`, etc.) |
| `sortAsc` | boolean | True = ascending, false = descending |
| `toggleSort(key)` | function | Click handler for table column headers |
| `filters`, `setFilter`, `clearFilters`, `activeFilterCount` | — | Legacy filter state, currently unused by the UI (filters were moved into `ScanPicker`) |

**Port filter:**
When a port is selected in the `PortOverview` chart, `App.jsx` passes `{ portFilter: selectedPort }` as the second argument to `useHostFilter`. The hook filters hosts to only those with that port in the `open` state.

**Search logic (`query`):**
The free-text query matches against:
- IP address
- All hostnames
- Port numbers (as strings)
- Service names
- Subnet
- Site name
- Site code

**Sort logic:**
- IP addresses are sorted numerically using `ipToNum()` (converts `192.168.1.5` to a number) rather than alphabetically.
- Port count sorts by number of open ports.
- All other columns sort alphabetically/chronologically.

**Bugfixing notes:**
- If searching for an IP returns no results, check that `h.ip` is being populated by the parser.
- The `filters` state object (subnet, siteName, siteCode, status, dateFrom, dateTo) is still defined but not exercised by the current UI. Removing it would require updating the hook's return value and ensuring nothing else accesses these fields.

---

### `src/components/LoginPage.jsx`

**Purpose:** Full-screen login form displayed before any application content is visible. Renders in place of the main app when `authenticated === false` in `App.jsx`.

**Props:**
| Prop | Type | Description |
|---|---|---|
| `onLogin` | `() => void` | Called after a successful login — sets `authenticated = true` in `App.jsx` |

**State it owns:**
| State | Type | Description |
|---|---|---|
| `username` | string | Controlled input value |
| `password` | string | Controlled input value |
| `showPassword` | boolean | Toggles the password field between `type="password"` and `type="text"` |
| `error` | string | Error message shown in the red banner (empty = no banner) |
| `loading` | boolean | True while the POST request is in flight — disables the button and shows a spinner |

**Login flow:**
1. User submits the form.
2. Component POSTs `{ username, password }` JSON to `/api/login`.
3. On `200 OK` → calls `onLogin()` prop.
4. On `401` → sets `error` to `"Invalid username or password"`.
5. On network failure or non-200/401 response → sets a descriptive error message.

**UI features:**
- ELEMENTMonitor branding (Radar icon + title) at the top of the card.
- Show/hide password toggle button (eye icon).
- Red error banner below the password field on failure.
- Loading spinner inside the submit button while the request is in flight.
- `autoComplete` attributes set correctly (`username`, `current-password`) for browser password managers.

**Bugfixing notes:**
- If the login page appears but submitting does nothing, check the browser's Network tab for the `POST /api/login` request. A 502/504 means the Express server is not running.
- If you see "Cannot reach the server" but the server is running, ensure the Vite dev proxy is configured (`/api` → `http://localhost:3001` in `vite.config.js`).

---

### `src/components/ScanPicker.jsx`

**Purpose:** The left sidebar panel. Responsible for listing available scan files, filtering them, and triggering file loads.

**State it owns:**
| State | Type | Description |
|---|---|---|
| `files` | array | Raw file list from `GET /api/scans` |
| `loading` | boolean | True while the file list is being fetched |
| `error` | string \| null | Error message from failed API requests |
| `fetchingFile` | string \| null | Filename currently being downloaded (shows spinner on that row) |
| `activeTab` | `"latest"` \| `"archived"` | Which tab the user has selected |
| `filterSiteCode` | string | Selected site code filter (from dropdown) |
| `filterSiteName` | string | Selected site name filter (from dropdown) |
| `filterDateFrom` | string | ISO date string for "modified after" filter |
| `filterDateTo` | string | ISO date string for "modified before" filter |

**File classification:**
- **Latest** — files whose name ends with `#LATEST.xml`.
- **Archived** — all other files (not ending with `#LATEST.xml` or `#IN_PROGRESS.xml`).
- **In Progress** — files ending with `#IN_PROGRESS.xml` are excluded from ScanPicker and shown in the `ActiveScans` panel instead.
- When a file is selected, the tab auto-switches to match the file's category. After that, clicking either tab works freely.

**`parseFileMeta(name)` (local, not the parser's version):**
Parses the filename convention locally to extract `siteCode` and `siteName` for populating the filter dropdowns. This is separate from the parser's `parseFilename()` — it's a lightweight version just for the UI.

**File filter logic:**
Filters are applied client-side against the `files` array before the latest/archived split. This means the tab counts update to reflect the filtered set.

**Two API calls per file selection:**
1. `GET /api/scans` — on mount and on refresh button click.
2. `GET /api/scans/:filename` — when a file row is clicked.

**Bugfixing notes:**
- If files don't appear in the correct tab, check whether the filename ends with `#LATEST.xml`. Files that don't follow the naming convention appear in the Archived tab.
- If site code/name filters don't appear, the filenames don't follow the `SITECODE#SiteName#...` convention.
- If clicking a file does nothing, check the browser network tab for the `GET /api/scans/:filename` request and its response.

---

### `src/components/ActiveScans.jsx`

**Purpose:** Displays in-progress scans below the ScanPicker sidebar. Polls `/api/scans` every 10 seconds and shows files whose names end with `#IN_PROGRESS.xml`.

**Behaviour:**
- Always visible — shows an idle state ("No active scans") when nothing is in progress.
- Parses `SITECODE#SiteName#IP` metadata from in-progress filenames.
- Uses a pulsing amber indicator when scans are active.

---

### `src/components/SummaryCards.jsx`

**Purpose:** Displays four stat cards above the host table after a scan is loaded.

**Cards shown:**
| Card | Data source | Colour |
|---|---|---|
| Total Hosts | `summary.totalHosts` | Blue |
| Hosts Up | `summary.hostsUp` | Green |
| Hosts Down | `summary.hostsDown` | Red |
| Open Ports | `summary.criticalPortCount` | Amber |
| OS Distribution | `summary.osDistribution` (up to 4 entries) | Violet |

The OS Distribution card is wider and only renders if OS data is present in the scan.

**Bugfixing notes:**
- The "Open Ports" count only includes ports in the hardcoded `CRITICAL_PORTS` set inside `nmapParser.js`. If you expect a higher number, add more ports to that set.
- Cards use `animate-fade-in` on every render — if you see a flicker when switching between scan files, this is the fade-in animation re-triggering.

---

### `src/components/PortOverview.jsx`

**Purpose:** Displays a horizontal bar chart of all unique open ports across every host in the loaded scan. Appears between the summary cards and the search/table section.

**Props:**
| Prop | Type | Description |
|---|---|---|
| `hosts` | array | Full (unfiltered) host array from the scan |
| `selectedPort` | number \| null | Currently selected port number (highlighted in chart) |
| `onSelectPort` | `(portId \| null) => void` | Called when a port bar is clicked or the filter is cleared |

**Behaviour:**
- Aggregates all open ports across all hosts, counting how many hosts have each port open.
- Sorts ports by frequency (most common first).
- Each bar is clickable — clicking a port filters the host table to only show hosts with that port open.
- Clicking the same port again (or the "Clear filter" button) removes the filter.
- The bar chart scrolls vertically if there are many unique ports (max height ~16rem).

**Bugfixing notes:**
- If the chart is empty, no hosts have any ports in the `open` state. Check the XML scan data.
- The port filter is passed from `App.jsx` through `useHostFilter` — if clicking a port doesn't filter the table, check that `selectedPort` state and `portFilter` are wired correctly.

---

### `src/components/SearchBar.jsx`

**Purpose:** A controlled text input that filters the host table in real time.

The `value` and `onChange` are passed in from `App.jsx` and connected to `useHostFilter`'s `query` / `setQuery`. The component itself has no state — it is purely presentational.

---

### `src/components/HostTable.jsx`

**Purpose:** The main sortable table listing all hosts in the loaded scan.

**Props:**
| Prop | Type | Description |
|---|---|---|
| `hosts` | array | Filtered + sorted host array from `useHostFilter` |
| `sortKey` | string | Currently sorted column key |
| `sortAsc` | boolean | Sort direction |
| `toggleSort(key)` | function | Called when a column header is clicked |
| `onSelect(host)` | function | Called when a host's port button is clicked — opens `HostDetail` |
| `siteName` | string | Passed from `scanResult.fileSiteName`, shown in the site banner |
| `siteCode` | string | Passed from `scanResult.fileSiteCode`, shown in the site banner |

**Site banner:**
Rendered above the column headers when `siteName` or `siteCode` is present. Underscores in `siteName` are replaced with spaces (`.replace(/_/g, " ")`).

**Columns:**
| Column | Sort key | Notes |
|---|---|---|
| Status | `status` | Green pulsing dot for up, red for down |
| IP Address | `ip` | Sorted numerically by `ipToNum()` |
| Subnet | `subnet` | `/24` derived from IP |
| Hostname | `hostname` | First hostname only |
| Timestamp | `scanTime` | Per-host scan start time from the XML |
| Open Ports | `ports` | Clickable button — shows count, opens detail panel |

**The Open Ports button:**
- Blue when `openPorts > 0`, grey when zero.
- Shows `N port` / `N ports` (singular/plural handled).
- Clicking it calls `onSelect(host)` which sets `selectedHost` in `App.jsx` and opens `HostDetail`.

**Bugfixing notes:**
- If sorting by IP is wrong, `ipToNum()` in `useHostFilter.js` is the function to check.
- If the site banner doesn't appear, check that `scanResult.fileSiteName` / `scanResult.fileSiteCode` are being passed correctly from `App.jsx` and populated by `nmapParser.js`.
- The `animate-pulse-dot` animation on status dots uses `will-change: opacity` in `index.css` to avoid CPU repaints — do not remove this.

---

### `src/components/HostDetail.jsx`

**Purpose:** A slide-over panel that shows all details for a single selected host.

Uses `@headlessui/react` components for accessible dialogs (`Dialog`, `Transition`) and tabs (`TabGroup`, `TabList`, `TabPanel`).

**Panels:**
The panel always has a **Ports** tab. Additional tabs are conditionally rendered:
- **Scripts** tab — only shown if at least one port has NSE script output.
- **OS** tab — only shown if OS detection data exists for the host.

**Header:**
Shows the host IP, first hostname, MAC address, and MAC vendor (from ARP data if present in the scan).

**Ports tab:**
- Open ports are shown first, each in a `PortRow` component.
- Filtered/closed/other ports are collapsed into a `<details>` element at the bottom.
- Host uptime (if recorded in the XML) is shown at the bottom of the tab.

**Transition animations:**
- The backdrop fades in/out (`opacity-0` ↔ `opacity-100`).
- The panel slides in/out from the right (`translate-x-full` ↔ `translate-x-0`).

**Bugfixing notes:**
- If the panel fails to close, check that `onClose` is being correctly passed from `App.jsx` and called in both the backdrop click and the X button.
- If the Scripts or OS tabs are missing, the data was not detected by Nmap during the scan — this is expected for basic scans without `-sV` / `-O` flags.
- The `@headlessui/react` Dialog requires `host` to be non-null before rendering (guarded by `if (!host) return null`). If the panel flashes briefly on open, this guard is the right place to investigate.

---

## Data Flow — End to End

```
1.  User opens browser → Express serves dist/index.html
2.  React mounts → App.jsx calls GET /api/auth/check
    a. 401 response → authenticated = false → LoginPage rendered
    b. 200 response → authenticated = true  → full app rendered

── If not authenticated ──────────────────────────────────────────
3.  User submits login form → LoginPage POSTs { username, password }
    to POST /api/login
4.  Server validates credentials via crypto.timingSafeEqual
    a. Invalid → 401 → LoginPage shows error banner
    b. Valid   → session token created → HttpOnly cookie set
5.  LoginPage calls onLogin() → App.jsx sets authenticated = true
    → full application renders

── Once authenticated ────────────────────────────────────────────
6.  ScanPicker calls GET /api/scans (session cookie sent automatically)
7.  Express validates session cookie → returns JSON file list
8.  ScanPicker splits files into Latest / Archived tabs
9.  User applies file filters → filtered client-side, no API call
10. User clicks a file → ScanPicker calls GET /api/scans/FILENAME.xml
11. Express validates session cookie → returns raw XML text
12. App.jsx receives XML → calls parseNmapXml(xml, filename)
13. nmapParser.js:
    a. fast-xml-parser converts XML → JS object tree
    b. parseFilename() extracts site metadata from filename
    c. Each <host> is normalised into a clean host object
    d. buildSummary() calculates totals
    e. Returns scanResult object
14. App.jsx stores scanResult in state → React re-renders
15. SummaryCards reads scanResult.summary → renders stat cards
16. PortOverview aggregates open ports across all hosts → renders bar chart
17. HostTable receives all hosts → renders rows
    - Site banner shows scanResult.fileSiteName / fileSiteCode
18. User clicks a port bar in PortOverview → selectedPort set in App.jsx
    - useHostFilter filters hosts to those with that port open → table updates
19. User types in SearchBar → useHostFilter runs client-side
    - Filters hosts array → HostTable re-renders
20. User clicks a column header → useHostFilter re-sorts
    - HostTable re-renders in new order
21. User clicks a port count button → selectedHost set in App.jsx
    - HostDetail panel slides in showing ports, scripts, OS
22. User closes panel → selectedHost set to null → panel unmounts
23. User clicks Sign out → App.jsx POSTs to /api/logout
    → session deleted server-side → cookie cleared
    → authenticated = false → LoginPage rendered
```

---

## Key Data Structures

### `scanResult` (returned by `parseNmapXml`)

```javascript
{
  scanner: "nmap",
  args: "-sV -O 192.168.1.0/24",
  startTime: "Mon Mar  3 12:00:00 2026",
  version: "7.94",
  fileSiteCode: "HELP",       // from filename
  fileSiteName: "Hull",       // from filename
  fileScanIp: "192.168.1.1",  // from filename
  fileTimestamp: "2026-03-03T12:00:00.000Z",
  hosts: [ ...host objects... ],
  summary: {
    totalHosts: 10,
    hostsUp: 8,
    hostsDown: 2,
    criticalPortCount: 15,    // count of open well-known ports across all hosts
    osDistribution: [
      { name: "Linux", count: 5 },
      { name: "Windows", count: 3 }
    ]
  }
}
```

### `host` object (one entry in `scanResult.hosts`)

```javascript
{
  status: "up",               // "up" | "down" | "unknown"
  isUp: true,                 // convenience boolean
  ip: "192.168.1.10",
  addrType: "ipv4",
  mac: "AA:BB:CC:DD:EE:FF",
  macVendor: "Cisco Systems",
  hostnames: ["router.corp.local"],
  subnet: "192.168.1.0/24",
  scanTime: "2026-03-03T12:00:00.000Z",
  siteName: "Hull",
  siteCode: "HELP",
  uptime: { seconds: 86400, lastBoot: "Mon Mar  2 12:00:00 2026" },
  ports: [ ...port objects... ],
  os: [ ...OS match objects... ]
}
```

### `port` object

```javascript
{
  protocol: "tcp",
  portId: 443,
  state: "open",              // "open" | "closed" | "filtered"
  reason: "syn-ack",
  service: {
    name: "https",
    product: "nginx",
    version: "1.24.0",
    extraInfo: "",
    tunnel: "ssl",
    method: "probed",
    conf: 10
  },
  scripts: [
    {
      id: "ssl-cert",
      output: "Subject: CN=router.corp.local",
      elements: [ { key: "subject", value: "router.corp.local" } ]
    }
  ]
}
```

---

## Common Bug Locations

| Symptom | Most likely cause | File to check |
|---|---|---|
| Login always says "Invalid username or password" | Server is rejecting credentials — check `AUTH_USER`/`AUTH_PASS` env vars match what you're typing | `server/index.js`, `docker-compose.yml` |
| "Cannot reach the server" on login page | Express on port 3001 is not running, or Vite proxy is misconfigured | `vite.config.js`, `server/index.js` |
| Logged out after page refresh | `GET /api/auth/check` returned 401 — session expired or server restarted | `server/index.js` — sessions `Map` |
| Logged out after server restart | Expected — in-memory sessions don't survive restarts | `server/index.js` — by design |
| Login page briefly flashes before app appears | Auth check resolved to `false` then `true` — race condition | `App.jsx` — `null` loading state should prevent this |
| `/api/scans` returns 401 in browser | Session cookie missing or expired — normal for unauthenticated requests | `server/index.js` — `requireAuth` |
| Blank page in production | `dist/` not built or not served | `Dockerfile`, `server/index.js` |
| "No .xml files found" in sidebar | `/scans` bind-mount missing or wrong path | `docker-compose.yml`, `server/index.js` |
| Files not updating in sidebar | Sidebar only fetches on mount or manual refresh | `ScanPicker.jsx` — `loadFileList` |
| File loads but table is empty | Parser returned empty hosts array | `nmapParser.js` — `normaliseArray`, XML structure |
| "Invalid Nmap XML" error | File is not Nmap XML, is empty, or is corrupted | `nmapParser.js` — `parseNmapXml` |
| Site name / code missing | Filename doesn't follow `CODE#Name#IP#Timestamp.xml` | `nmapParser.js` — `parseFilename` |
| Underscores in site name | Expected — replaced with spaces in UI only | `HostTable.jsx` — `.replace(/_/g, " ")` |
| Open Ports count seems low | Only counts ports in the `CRITICAL_PORTS` set | `nmapParser.js` — `buildSummary` |
| Sorting by IP is alphabetical | `ipToNum()` not being used | `useHostFilter.js` — sort switch case |
| High CPU in browser | CSS animations not GPU-accelerated | `index.css` — `will-change: opacity` |
| Detail panel won't open | `onSelect` not wired or `selectedHost` not set | `App.jsx`, `HostTable.jsx` |
| Scripts tab not showing | No NSE scripts in scan (`-sC` flag not used in Nmap) | `HostDetail.jsx` — `hasScripts` check |
| OS tab not showing | No OS detection in scan (`-O` flag not used in Nmap) | `HostDetail.jsx` — `host.os.length` check |
