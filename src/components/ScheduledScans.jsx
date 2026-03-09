import { useEffect, useState, useCallback } from "react";
import { Calendar, Clock, Tag, Crosshair, RefreshCw, Archive, Repeat, MapPin } from "lucide-react";

const POLL_INTERVAL_MS = 30_000; // refresh every 30 s

/**
 * ScheduledScans
 * ──────────────
 * Fetches scheduled-scan configs from /api/schedules and displays
 * a compact overview in the sidebar.
 */
export default function ScheduledScans() {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const fetchSchedules = useCallback(async () => {
    try {
      const res = await fetch("/api/schedules");
      if (!res.ok) return;
      const data = await res.json();
      setSchedules(data.schedules ?? []);
    } catch {
      // Silently ignore — supplementary widget
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSchedules();
    const id = setInterval(fetchSchedules, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchSchedules]);

  const hasSchedules = schedules.length > 0;

  // Show first 3 by default, all when expanded
  const visible = expanded ? schedules : schedules.slice(0, 3);

  return (
    <div className="mt-3 rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-2.5">
        <Calendar className="h-3 w-3 shrink-0 text-sky-400" />
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Scheduled Scans
        </span>
        {!loading && hasSchedules && (
          <span className="ml-auto rounded-full bg-sky-400/15 px-1.5 py-0.5 text-[10px] font-bold text-sky-400">
            {schedules.length}
          </span>
        )}
      </div>

      {/* Body */}
      {loading ? (
        <div className="flex items-center justify-center gap-2 px-4 py-5 text-xs text-slate-600">
          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          Loading…
        </div>
      ) : !hasSchedules ? (
        <div className="flex items-center gap-3 px-4 py-4">
          <Calendar className="h-4 w-4 shrink-0 text-slate-700" />
          <p className="text-xs text-slate-500">No scheduled scans configured.</p>
        </div>
      ) : (
        <>
          <ul className="divide-y divide-slate-800/60">
            {visible.map((s) => (
              <ScheduleRow key={s._file} schedule={s} />
            ))}
          </ul>

          {schedules.length > 3 && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="w-full border-t border-slate-800/60 px-4 py-2 text-center text-[11px] text-slate-500 transition hover:bg-slate-800/40 hover:text-slate-300"
            >
              {expanded ? "Show less" : `Show all ${schedules.length} schedules`}
            </button>
          )}
        </>
      )}
    </div>
  );
}

/* ── Sub-component ──────────────────────────────────────────── */

function ScheduleRow({ schedule: s }) {
  const siteCode      = s.SiteCode ?? "";
  const siteName      = s.SiteName ?? "";
  const cidr          = s.CIDR ?? "";
  const interval      = s.Interval ?? "";
  const retentionDays = s.RetentionDays;

  return (
    <li className="px-4 py-3 space-y-1.5">
      {/* Row 1: Site code as heading */}
      <div className="flex items-center gap-2">
        <Tag className="h-3 w-3 shrink-0 text-amber-400" />
        <span className="truncate text-sm font-medium text-slate-200">
          {siteName || s._file}
        </span>
      </div>

      {/* Row 2: Site name + CIDR */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
        {siteCode && (
          <span className="flex items-center gap-1 text-slate-500">
            <MapPin className="h-2.5 w-2.5 text-violet-400" />
            <span className="text-slate-400">{siteCode.replace(/_/g, " ")}</span>
          </span>
        )}
        {cidr && (
          <span className="flex items-center gap-1 text-slate-500">
            <Crosshair className="h-2.5 w-2.5 text-sky-400" />
            <span className="font-mono text-slate-400">{cidr}</span>
          </span>
        )}
      </div>

      {/* Row 3: Interval */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
        {interval && (
          <span className="flex items-center gap-1 text-slate-500">
            <Repeat className="h-2.5 w-2.5 text-violet-400" />
            <span className="text-slate-400">{formatInterval(interval)}</span>
          </span>
        )}
      </div>

      {/* Row 3: Retention */}
      {retentionDays != null && (
        <div className="flex items-center gap-1 text-[11px] text-slate-500">
          <Archive className="h-2.5 w-2.5 text-slate-500" />
          Retention: <span className="text-slate-400">{retentionDays} day{retentionDays !== 1 ? "s" : ""}</span>
        </div>
      )}
    </li>
  );
}

/* ── Helpers ────────────────────────────────────────────────── */

function formatInterval(val) {
  const mins = Number(val);
  if (isNaN(mins)) return String(val);
  if (mins < 60) return `${mins} min${mins !== 1 ? "s" : ""}`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (m === 0) return `${h} hr${h !== 1 ? "s" : ""}`;
  return `${h} hr${h !== 1 ? "s" : ""} ${m} min${m !== 1 ? "s" : ""}`;
}
