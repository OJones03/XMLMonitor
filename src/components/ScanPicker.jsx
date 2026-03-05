import { useEffect, useState, useCallback, useMemo } from "react";
import { Clock, Archive, RefreshCw, FileText, AlertCircle, ChevronRight, SlidersHorizontal, X } from "lucide-react";

/**
 * Parse structured metadata encoded in the filename.
 * Expected format: SITECODE#SiteName#IP#LATEST.xml (latest) or SITECODE#SiteName#IP#Timestamp.xml (archived)
 */
function parseFileMeta(name) {
  const base = name.replace(/\.xml$/i, "");
  const parts = base.split("#");
  if (parts.length >= 3) {
    return { siteCode: parts[0] || null, siteName: parts[1] || null, ip: parts[2] || null };
  }
  return { siteCode: null, siteName: null, ip: null };
}

/**
 * ScanPicker
 * ──────────
 * Fetches available XML scan files from the Express API (/api/scans).
 * Files modified within the last hour appear under "Latest Files".
 * Older files appear under "Archived Files".
 * A toggle button in the header switches between the two views.
 * Filters (site code, site name, date range) apply to both views.
 *
 * Props:
 *  onLoadXml(xmlString, filename) – called when a file is selected and fetched
 *  currentFile – filename currently loaded (for highlight)
 */
export default function ScanPicker({ onLoadXml, currentFile }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fetchingFile, setFetchingFile] = useState(null);
  const [activeTab, setActiveTab] = useState("latest"); // "latest" | "archived"

  // File-level filters
  const [filterSiteCode, setFilterSiteCode] = useState("");
  const [filterSiteName, setFilterSiteName] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo,   setFilterDateTo]   = useState("");

  const loadFileList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/scans");
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setFiles(data.files ?? []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFileList();
  }, [loadFileList]);

  const selectFile = useCallback(
    async (filename) => {
      setFetchingFile(filename);
      try {
        const res = await fetch(`/api/scans/${encodeURIComponent(filename)}`);
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        const xml = await res.text();
        onLoadXml(xml, filename);
      } catch (err) {
        setError(`Failed to load ${filename}: ${err.message}`);
      } finally {
        setFetchingFile(null);
      }
    },
    [onLoadXml]
  );

  // Derive unique filter options from all files
  const filterOptions = useMemo(() => {
    const codes = new Set();
    const names = new Set();
    for (const f of files) {
      const meta = parseFileMeta(f.name);
      if (meta.siteCode) codes.add(meta.siteCode);
      if (meta.siteName) names.add(meta.siteName);
    }
    return { siteCodes: [...codes].sort(), siteNames: [...names].sort() };
  }, [files]);

  // Apply file-level filters to the full list
  const filteredFiles = useMemo(() => {
    let list = files;
    if (filterSiteCode || filterSiteName) {
      list = list.filter((f) => {
        const meta = parseFileMeta(f.name);
        if (filterSiteCode && meta.siteCode !== filterSiteCode) return false;
        if (filterSiteName && meta.siteName !== filterSiteName) return false;
        return true;
      });
    }
    if (filterDateFrom) {
      const from = new Date(filterDateFrom).getTime();
      list = list.filter((f) => new Date(f.modified).getTime() >= from);
    }
    if (filterDateTo) {
      const to = new Date(filterDateTo).getTime() + 86_400_000 - 1;
      list = list.filter((f) => new Date(f.modified).getTime() <= to);
    }
    return list;
  }, [files, filterSiteCode, filterSiteName, filterDateFrom, filterDateTo]);

  const activeFilterCount = [filterSiteCode, filterSiteName, filterDateFrom, filterDateTo].filter(Boolean).length;

  function clearFilters() {
    setFilterSiteCode("");
    setFilterSiteName("");
    setFilterDateFrom("");
    setFilterDateTo("");
  }

  // Split filtered files: names ending with #LATEST.xml are latest; everything else is archived
  const latestFiles   = filteredFiles.filter((f) => f.name.endsWith("#LATEST.xml"));
  const archivedFiles = filteredFiles.filter((f) => !f.name.endsWith("#LATEST.xml"));

  // If the active file is in the archive, auto-switch to the archived tab
  const activeIsArchived = archivedFiles.some((f) => f.name === currentFile);
  const resolvedTab = activeIsArchived ? "archived" : activeTab;

  const visibleFiles = resolvedTab === "latest" ? latestFiles : archivedFiles;

  const showFilterOptions =
    filterOptions.siteCodes.length > 0 || filterOptions.siteNames.length > 0 || files.length > 0;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
      {/* ── Header ───────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3 gap-2">
        {/* Toggle buttons */}
        <div className="flex items-center gap-1 rounded-lg bg-slate-800/60 p-1">
          <button
            onClick={() => setActiveTab("latest")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition ${
              resolvedTab === "latest"
                ? "bg-slate-700 text-slate-100 shadow"
                : "text-slate-400 hover:text-slate-300"
            }`}
          >
            <Clock className={`h-3.5 w-3.5 ${resolvedTab === "latest" ? "text-emerald-400" : "text-slate-500"}`} />
            Latest
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                resolvedTab === "latest"
                  ? "bg-emerald-400/15 text-emerald-400"
                  : "bg-slate-700 text-slate-500"
              }`}
            >
              {latestFiles.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("archived")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition ${
              resolvedTab === "archived"
                ? "bg-slate-700 text-slate-100 shadow"
                : "text-slate-400 hover:text-slate-300"
            }`}
          >
            <Archive className={`h-3.5 w-3.5 ${resolvedTab === "archived" ? "text-amber-400" : "text-slate-500"}`} />
            Archived
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                resolvedTab === "archived"
                  ? "bg-amber-400/15 text-amber-400"
                  : "bg-slate-700 text-slate-500"
              }`}
            >
              {archivedFiles.length}
            </span>
          </button>
        </div>

        {/* Refresh button */}
        <button
          onClick={loadFileList}
          disabled={loading}
          className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-800 hover:text-slate-300 disabled:opacity-40"
          title="Refresh file list"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* ── Filters ──────────────────────────────────────────── */}
      {showFilterOptions && (
        <div className="border-b border-slate-800 px-4 py-3 space-y-2">
          <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-slate-500">
            <SlidersHorizontal className="h-3 w-3" />
            Filter files
            {activeFilterCount > 0 && (
              <span className="rounded-full bg-sky-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                {activeFilterCount}
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {/* Site Code */}
            {filterOptions.siteCodes.length > 0 && (
              <div className="flex flex-col gap-0.5">
                <label className="text-[10px] font-medium uppercase tracking-wider text-slate-500">Site Code</label>
                <select
                  value={filterSiteCode}
                  onChange={(e) => setFilterSiteCode(e.target.value)}
                  className={`rounded-lg border px-2 py-1.5 text-xs outline-none transition focus:ring-1 focus:ring-sky-500/40 ${
                    filterSiteCode
                      ? "border-blue-500 bg-blue-900 text-white"
                      : "border-slate-700 bg-slate-900/80 text-slate-300"
                  }`}
                >
                  <option value="">All codes</option>
                  {filterOptions.siteCodes.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            )}

            {/* Site Name */}
            {filterOptions.siteNames.length > 0 && (
              <div className="flex flex-col gap-0.5">
                <label className="text-[10px] font-medium uppercase tracking-wider text-slate-500">Site Name</label>
                <select
                  value={filterSiteName}
                  onChange={(e) => setFilterSiteName(e.target.value)}
                  className={`rounded-lg border px-2 py-1.5 text-xs outline-none transition focus:ring-1 focus:ring-sky-500/40 ${
                    filterSiteName
                      ? "border-blue-500 bg-blue-900 text-white"
                      : "border-slate-700 bg-slate-900/80 text-slate-300"
                  }`}
                >
                  <option value="">All sites</option>
                  {filterOptions.siteNames.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            )}

            {/* Date From */}
            <div className="flex flex-col gap-0.5">
              <label className="text-[10px] font-medium uppercase tracking-wider text-slate-500">From</label>
              <input
                type="date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
                className={`rounded-lg border px-2 py-1.5 text-xs outline-none transition focus:ring-1 focus:ring-sky-500/40 [color-scheme:dark] ${
                  filterDateFrom
                    ? "border-blue-500 bg-blue-900 text-white"
                    : "border-slate-700 bg-slate-900/80 text-slate-300"
                }`}
              />
            </div>

            {/* Date To */}
            <div className="flex flex-col gap-0.5">
              <label className="text-[10px] font-medium uppercase tracking-wider text-slate-500">To</label>
              <input
                type="date"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
                className={`rounded-lg border px-2 py-1.5 text-xs outline-none transition focus:ring-1 focus:ring-sky-500/40 [color-scheme:dark] ${
                  filterDateTo
                    ? "border-blue-500 bg-blue-900 text-white"
                    : "border-slate-700 bg-slate-900/80 text-slate-300"
                }`}
              />
            </div>

            {/* Clear */}
            {activeFilterCount > 0 && (
              <div className="flex flex-col justify-end gap-0.5">
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1 rounded-lg border border-slate-700 px-2 py-1.5 text-xs text-slate-400 transition hover:border-red-700 hover:text-red-400"
                >
                  <X className="h-3 w-3" />
                  Clear
                </button>
              </div>
            )}
          </div>

          {/* Active filter chips */}
          {activeFilterCount > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {filterSiteCode && <FilterChip label="Site Code" value={filterSiteCode} onRemove={() => setFilterSiteCode("")} />}
              {filterSiteName && <FilterChip label="Site Name" value={filterSiteName} onRemove={() => setFilterSiteName("")} />}
              {filterDateFrom && <FilterChip label="From"      value={filterDateFrom} onRemove={() => setFilterDateFrom("")} />}
              {filterDateTo   && <FilterChip label="To"        value={filterDateTo}   onRemove={() => setFilterDateTo("")} />}
            </div>
          )}
        </div>
      )}

      {/* ── Body ─────────────────────────────────────────────── */}
      <div className="max-h-72 overflow-y-auto">
        {loading && files.length === 0 && (
          <div className="flex items-center justify-center gap-2 p-8 text-sm text-slate-500">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Scanning directory…
          </div>
        )}

        {!loading && error && (
          <div className="flex items-start gap-3 p-5">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            <div>
              <p className="text-sm font-medium text-red-400">Could not read scan directory</p>
              <p className="mt-0.5 text-xs text-slate-500">{error}</p>
            </div>
          </div>
        )}

        {!loading && !error && files.length === 0 && (
          <div className="flex flex-col items-center gap-2 p-10 text-center">
            <FileText className="h-8 w-8 text-slate-700" />
            <p className="text-sm text-slate-500">No .xml files found.</p>
            <p className="text-xs text-slate-600">
              Place Nmap XML files in the bind-mounted{" "}
              <code className="text-slate-400">/scans</code> directory.
            </p>
          </div>
        )}

        {!loading && !error && files.length > 0 && visibleFiles.length === 0 && (
          <div className="flex flex-col items-center gap-1.5 p-6 text-center">
            {activeFilterCount > 0 ? (
              <>
                <SlidersHorizontal className="h-6 w-6 text-slate-700" />
                <p className="text-sm text-slate-500">No files match the current filters.</p>
                <button onClick={clearFilters} className="text-xs text-sky-400 hover:underline">Clear filters</button>
              </>
            ) : resolvedTab === "latest" ? (
              <>
                <Clock className="h-6 w-6 text-slate-700" />
                <p className="text-sm text-slate-500">No latest scans.</p>
                <p className="text-xs text-slate-600">Files named with <code className="text-slate-400">#LATEST.xml</code> will appear here.</p>
              </>
            ) : (
              <>
                <Archive className="h-6 w-6 text-slate-700" />
                <p className="text-sm text-slate-500">No archived scans.</p>
                <p className="text-xs text-slate-600">Files not ending in <code className="text-slate-400">#LATEST.xml</code> will appear here.</p>
              </>
            )}
          </div>
        )}

        {!loading && !error && visibleFiles.map((file) => (
          <FileRow
            key={file.name}
            file={file}
            isActive={file.name === currentFile}
            isFetching={file.name === fetchingFile}
            onSelect={selectFile}
            muted={resolvedTab === "archived"}
          />
        ))}
      </div>
    </div>
  );
}

/* ── FilterChip sub-component ───────────────────────────── */

function FilterChip({ label, value, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-sky-800 bg-sky-900/40 px-2 py-0.5 text-xs text-sky-300">
      <span className="text-sky-500">{label}:</span>
      {value}
      <button onClick={onRemove} className="ml-0.5 rounded-full hover:text-white">
        <X className="h-2.5 w-2.5" />
      </button>
    </span>
  );
}

/* ── FileRow sub-component ───────────────────────────────── */

function FileRow({ file, isActive, isFetching, onSelect, muted = false }) {
  return (
    <button
      onClick={() => !isFetching && onSelect(file.name)}
      title={file.name}
      className={`group flex w-full items-center gap-3 border-b border-slate-800/50 px-5 py-3 text-left transition last:border-0 overflow-hidden
        ${isActive
          ? "bg-sky-400/10 text-sky-400"
          : muted
            ? "hover:bg-slate-800/40 text-slate-500"
            : "hover:bg-slate-800/60 text-slate-300"
        }`}
    >
      {isFetching ? (
        <RefreshCw className="h-4 w-4 shrink-0 animate-spin text-sky-400" />
      ) : (
        <FileText
          className={`h-4 w-4 shrink-0 ${
            isActive ? "text-sky-400" : muted ? "text-slate-600 group-hover:text-slate-500" : "text-slate-500 group-hover:text-slate-400"
          }`}
        />
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{file.name}</p>
        <p className="text-xs text-slate-500">
          {formatBytes(file.size)} · {formatDate(file.modified)}
        </p>
      </div>

      <ChevronRight
        className={`h-3.5 w-3.5 shrink-0 transition-transform ${
          isActive ? "text-sky-400" : "text-slate-700 group-hover:text-slate-500 group-hover:translate-x-0.5"
        }`}
      />
    </button>
  );
}

/* ── Helpers ─────────────────────────────────────────────── */

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
