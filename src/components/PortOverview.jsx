import { useMemo } from "react";
import { Network, X } from "lucide-react";

/**
 * PortOverview
 * ────────────
 * Displays unique open ports across all hosts in the current scan as a
 * horizontal bar chart.  Clicking a bar filters the host table to show
 * only hosts with that port open.
 *
 * Props:
 *  hosts         – full (unfiltered) host array from the scan
 *  selectedPort  – currently selected port number (or null)
 *  onSelectPort  – (portId | null) => void
 */
export default function PortOverview({ hosts, selectedPort, onSelectPort }) {
  const portStats = useMemo(() => {
    const map = new Map(); // portId → { port, service, count }
    for (const host of hosts) {
      for (const p of host.ports) {
        if (p.state !== "open") continue;
        const existing = map.get(p.portId);
        if (existing) {
          existing.count++;
        } else {
          map.set(p.portId, {
            port: p.portId,
            service: p.service.name || "unknown",
            count: 1,
          });
        }
      }
    }
    return [...map.values()].sort((a, b) => b.count - a.count);
  }, [hosts]);

  if (portStats.length === 0) return null;

  const maxCount = portStats[0].count;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-violet-400/10 p-2">
            <Network className="h-4 w-4 text-violet-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-100">Open Ports Overview</h3>
            <p className="text-[11px] text-slate-500">
              {portStats.length} unique port{portStats.length !== 1 && "s"} across {hosts.length} host{hosts.length !== 1 && "s"}
            </p>
          </div>
        </div>

        {selectedPort != null && (
          <button
            onClick={() => onSelectPort(null)}
            className="flex items-center gap-1 rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-400 transition hover:border-red-700 hover:text-red-400"
          >
            <X className="h-3 w-3" />
            Clear filter
          </button>
        )}
      </div>

      {/* Bar chart */}
      <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
        {portStats.map(({ port, service, count }) => {
          const pct = (count / maxCount) * 100;
          const isActive = selectedPort === port;

          return (
            <button
              key={port}
              onClick={() => onSelectPort(isActive ? null : port)}
              className={`group relative flex w-full items-center gap-3 rounded-lg px-3 py-1.5 text-left transition ${
                isActive
                  ? "bg-violet-500/15 ring-1 ring-violet-500/40"
                  : "hover:bg-slate-800/60"
              }`}
            >
              {/* Port + service label */}
              <span className="w-24 shrink-0 flex items-center gap-1.5">
                <span
                  className={`font-mono text-xs font-semibold ${
                    isActive ? "text-violet-400" : "text-slate-300 group-hover:text-slate-100"
                  }`}
                >
                  {port}
                </span>
                <span className="truncate text-[10px] text-slate-500">{service}</span>
              </span>

              {/* Bar */}
              <div className="relative flex-1 h-4 rounded bg-slate-800">
                <div
                  className={`absolute inset-y-0 left-0 rounded transition-all ${
                    isActive ? "bg-violet-500/50" : "bg-sky-500/30 group-hover:bg-sky-500/40"
                  }`}
                  style={{ width: `${Math.max(pct, 2)}%` }}
                />
              </div>

              {/* Count */}
              <span
                className={`w-10 text-right text-xs font-medium ${
                  isActive ? "text-violet-400" : "text-slate-400"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
