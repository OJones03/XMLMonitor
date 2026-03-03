import { useEffect, useState, useCallback } from "react";
import { Clock, Archive, RefreshCw, FileText, AlertCircle, ChevronRight, ChevronDown } from "lucide-react";

const ONE_HOUR_MS = 60 * 60 * 1000;

/**
 * ScanPicker
 * ──────────
 * Fetches available XML scan files from the Express API (/api/scans).
 * Files modified within the last hour appear under "Latest Files".
 * Older files collapse into an "Archived Files" section below.
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
  const [archiveOpen, setArchiveOpen] = useState(false);

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

  // Split files into latest (≤1 hour old) and archived (>1 hour old)
  const now = Date.now();
  const latestFiles   = files.filter((f) => now - new Date(f.modified).getTime() <= ONE_HOUR_MS);
  const archivedFiles = files.filter((f) => now - new Date(f.modified).getTime() >  ONE_HOUR_MS);

  // If the active file is in the archive, auto-expand it
  const activeIsArchived = archivedFiles.some((f) => f.name === currentFile);

  return (
    <div className="space-y-3">
      {/* ── Latest Files ───────────────────────────────────── */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-300">
            <Clock className="h-4 w-4 text-emerald-400" />
            Latest Files
            {latestFiles.length > 0 && (
              <span className="ml-1 rounded-full bg-emerald-400/10 px-2 py-0.5 text-xs text-emerald-400">
                {latestFiles.length}
              </span>
            )}
          </div>
          <button
            onClick={loadFileList}
            disabled={loading}
            className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-800 hover:text-slate-300 disabled:opacity-40"
            title="Refresh file list"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

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

          {!loading && !error && files.length > 0 && latestFiles.length === 0 && (
            <div className="flex flex-col items-center gap-1.5 p-6 text-center">
              <Clock className="h-6 w-6 text-slate-700" />
              <p className="text-sm text-slate-500">No recent files.</p>
              <p className="text-xs text-slate-600">All scans are over an hour old — see Archived Files below.</p>
            </div>
          )}

          {latestFiles.map((file) => (
            <FileRow
              key={file.name}
              file={file}
              isActive={file.name === currentFile}
              isFetching={file.name === fetchingFile}
              onSelect={selectFile}
            />
          ))}
        </div>
      </div>

      {/* ── Archived Files ─────────────────────────────────── */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur overflow-hidden">
        {/* Collapsible header */}
        <button
          onClick={() => setArchiveOpen((v) => !v)}
          className="flex w-full items-center justify-between px-5 py-3 transition hover:bg-slate-800/40"
        >
          <div className="flex items-center gap-2 text-sm font-medium text-slate-400">
            <Archive className="h-4 w-4 text-slate-500" />
            Archived Files
            <span className="ml-1 rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-500">
              {archivedFiles.length}
            </span>
            {activeIsArchived && (
              <span className="rounded-full bg-sky-400/10 px-2 py-0.5 text-xs text-sky-400">
                active
              </span>
            )}
          </div>
          <ChevronDown
            className={`h-4 w-4 text-slate-500 transition-transform duration-200 ${
              archiveOpen || activeIsArchived ? "rotate-180" : ""
            }`}
          />
        </button>

        {/* Collapsible body */}
        {(archiveOpen || activeIsArchived) && (
          <div className="max-h-72 overflow-y-auto border-t border-slate-800">
            {archivedFiles.length === 0 ? (
              <div className="flex flex-col items-center gap-1.5 p-6 text-center">
                <Archive className="h-6 w-6 text-slate-700" />
                <p className="text-sm text-slate-500">No archived files yet.</p>
                <p className="text-xs text-slate-600">Files older than 1 hour will appear here.</p>
              </div>
            ) : (
              archivedFiles.map((file) => (
                <FileRow
                  key={file.name}
                  file={file}
                  isActive={file.name === currentFile}
                  isFetching={file.name === fetchingFile}
                  onSelect={selectFile}
                  muted
                />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── FileRow sub-component ───────────────────────────────── */

function FileRow({ file, isActive, isFetching, onSelect, muted = false }) {
  return (
    <button
      onClick={() => !isFetching && onSelect(file.name)}
      className={`group flex w-full items-center gap-3 border-b border-slate-800/50 px-5 py-3 text-left transition last:border-0
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
