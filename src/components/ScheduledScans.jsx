import { useEffect, useState, useCallback } from "react";
import { Calendar, Clock, MapPin, Tag, Crosshair, Play, Pause, RefreshCw } from "lucide-react";

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

  const enabledCount = schedules.filter((s) => s.enabled).length;
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
            {enabledCount} active
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
  const isOverdue = s.enabled && s.nextRun && new Date(s.nextRun) < new Date();

  return (
    <li className="px-4 py-3 space-y-1.5">
      {/* Row 1: Name + enabled/disabled badge */}
      <div className="flex items-center gap-2">
        {s.enabled ? (
          <Play className="h-3 w-3 shrink-0 text-emerald-400" />
        ) : (
          <Pause className="h-3 w-3 shrink-0 text-slate-600" />
        )}
        <span className={`truncate text-sm font-medium ${s.enabled ? "text-slate-200" : "text-slate-500"}`}>
          {s.name}
        </span>
        {!s.enabled && (
          <span className="ml-auto shrink-0 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-500">
            Disabled
          </span>
        )}
      </div>

      {/* Row 2: Metadata chips */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
        {s.siteCode && (
          <span className="flex items-center gap-1 text-slate-500">
            <Tag className="h-2.5 w-2.5 text-amber-400" />
            <span className="text-slate-400">{s.siteCode}</span>
          </span>
        )}
        {s.target && (
          <span className="flex items-center gap-1 text-slate-500">
            <Crosshair className="h-2.5 w-2.5 text-sky-400" />
            <span className="font-mono text-slate-400">{s.target}</span>
          </span>
        )}
      </div>

      {/* Row 3: Frequency + next run */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
        {s.schedule && (
          <span className="flex items-center gap-1 text-slate-500">
            <Clock className="h-2.5 w-2.5" />
            {formatFrequency(s.schedule)}
          </span>
        )}
        {s.nextRun && s.enabled && (
          <span className={`flex items-center gap-1 ${isOverdue ? "text-amber-400" : "text-slate-500"}`}>
            <Calendar className="h-2.5 w-2.5" />
            Next: <span className={isOverdue ? "font-semibold" : "text-slate-400"}>{formatRelative(s.nextRun)}</span>
          </span>
        )}
      </div>
    </li>
  );
}

/* ── Helpers ────────────────────────────────────────────────── */

function formatFrequency(sched) {
  const time = sched.time ?? "";
  switch (sched.frequency) {
    case "daily":
      return `Daily at ${time}`;
    case "weekly":
      return `${capitalize(sched.day || "?")}s at ${time}`;
    case "monthly":
      return `Monthly (day ${sched.dayOfMonth ?? "?"}) at ${time}`;
    default:
      return sched.frequency ?? "Unknown";
  }
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatRelative(iso) {
  const target = new Date(iso);
  const now = new Date();
  const diffMs = target - now;

  if (diffMs < 0) return "overdue";

  const hours = Math.floor(diffMs / 3_600_000);
  const days = Math.floor(hours / 24);
  const remainHours = hours % 24;

  if (days > 0) return `${days}d ${remainHours}h`;
  if (hours > 0) return `${hours}h`;

  const mins = Math.max(1, Math.floor(diffMs / 60_000));
  return `${mins}m`;
}
