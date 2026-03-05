import { useEffect, useState, useCallback } from "react";
import { RefreshCw, Server, CheckCircle } from "lucide-react";

const POLL_INTERVAL_MS = 10_000; // refresh every 10 seconds

/**
 * Parse metadata from an in-progress filename.
 * Expected format: SITECODE#SiteName#IP#IN_PROGRESS.xml
 */
function parseInProgressMeta(name) {
  const base = name.replace(/#IN_PROGRESS\.xml$/i, "");
  const parts = base.split("#");
  return {
    siteCode: parts[0] || null,
    siteName: parts[1] || null,
    ip:       parts[2] || null,
  };
}

/**
 * ActiveScans
 * ───────────
 * Polls /api/scans and displays any file ending with #IN_PROGRESS.xml.
 * Always visible — shows an idle state when no scans are running.
 */
export default function ActiveScans() {
  const [activeScans, setActiveScans] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchScans = useCallback(async () => {
    try {
      const res = await fetch("/api/scans");
      if (!res.ok) return;
      const data = await res.json();
      const inProgress = (data.files ?? []).filter((f) =>
        f.name.endsWith("#IN_PROGRESS.xml")
      );
      setActiveScans(inProgress);
    } catch {
      // Silently ignore — this is a supplementary widget
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchScans();
    const id = setInterval(fetchScans, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchScans]);

  const hasActive = activeScans.length > 0;

  return (
    <div className={`mt-3 rounded-xl border bg-slate-900 overflow-hidden ${hasActive ? "border-amber-800/50" : "border-slate-800"}`}>
      {/* Header */}
      <div className={`flex items-center gap-2 border-b px-4 py-2.5 ${hasActive ? "border-amber-800/40 bg-amber-950/20" : "border-slate-800"}`}>
        {loading ? (
          <RefreshCw className="h-2.5 w-2.5 shrink-0 animate-spin text-slate-500" />
        ) : hasActive ? (
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-400" />
          </span>
        ) : (
          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-slate-700" />
        )}
        <span className={`text-xs font-semibold uppercase tracking-wider ${hasActive ? "text-amber-400" : "text-slate-500"}`}>
          Active Scans
        </span>
        {!loading && hasActive && (
          <span className="ml-auto rounded-full bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-400">
            {activeScans.length}
          </span>
        )}
      </div>

      {/* Body */}
      {loading ? (
        <div className="flex items-center justify-center gap-2 px-4 py-5 text-xs text-slate-600">
          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          Checking…
        </div>
      ) : !hasActive ? (
        <div className="flex items-center gap-3 px-4 py-4">
          <CheckCircle className="h-4 w-4 shrink-0 text-slate-700" />
          <p className="text-xs text-slate-500">No scans currently in progress.</p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-800/60">
          {activeScans.map((file) => {
            const { siteCode, siteName, ip } = parseInProgressMeta(file.name);
            const displayName = siteName ? siteName.replaceAll("_", " ") : (siteCode ?? file.name);
            const displayIp = ip ? ip.replace(/_(\d+)$/, "/$1").replaceAll("_", ".") : null;
            return (
              <li key={file.name} className="flex items-center gap-3 px-4 py-3">
                <Server className="h-4 w-4 shrink-0 text-amber-500" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-200">
                    {displayName}
                  </p>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                    {siteCode && (
                      <span className="text-[11px] text-slate-500">
                        Code: <span className="text-slate-400">{siteCode}</span>
                      </span>
                    )}
                    {displayIp && (
                      <span className="text-[11px] text-slate-500">
                        IP: <span className="font-mono text-slate-400">{displayIp}</span>
                      </span>
                    )}
                  </div>
                </div>
                <RefreshCw className="h-3.5 w-3.5 shrink-0 animate-spin text-amber-500/60" />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
