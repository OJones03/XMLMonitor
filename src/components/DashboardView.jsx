import { useMemo } from "react";
import {
  Server,
  ArrowUpCircle,
  ArrowDownCircle,
  ShieldAlert,
  MonitorSmartphone,
  Network,
  Globe,
  AlertTriangle,
} from "lucide-react";

/**
 * DashboardView — compact "at a glance" dashboard.
 *
 * Shows only the most critical scan information in a dense,
 * visually scannable layout:
 *  • Summary stats (hosts up/down, critical ports, OS)
 *  • Top open ports across all hosts
 *  • Most exposed hosts (most open ports)
 */
export default function DashboardView({ scanResult, hosts, onSelectHost }) {
  const { summary } = scanResult;

  const topPorts = useMemo(() => {
    const map = new Map();
    for (const host of hosts) {
      for (const p of host.ports) {
        if (p.state !== "open") continue;
        const existing = map.get(p.portId);
        if (existing) {
          existing.count++;
        } else {
          map.set(p.portId, {
            port: p.portId,
            protocol: p.protocol,
            service: p.service.name || "unknown",
            count: 1,
          });
        }
      }
    }
    return [...map.values()].sort((a, b) => b.count - a.count).slice(0, 10);
  }, [hosts]);

  const exposedHosts = useMemo(() => {
    return [...hosts]
      .map((h) => ({
        ...h,
        openCount: h.ports.filter((p) => p.state === "open").length,
      }))
      .filter((h) => h.openCount > 0)
      .sort((a, b) => b.openCount - a.openCount)
      .slice(0, 10);
  }, [hosts]);

  const maxPortCount = topPorts[0]?.count ?? 1;

  return (
    <div className="space-y-5">
      {/* ── Row 1: Summary stats ───────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={Server}
          label="Total Hosts"
          value={summary.totalHosts}
          color="text-sky-400"
          bg="bg-sky-400/10"
        />
        <StatCard
          icon={ArrowUpCircle}
          label="Hosts Up"
          value={summary.hostsUp}
          color="text-emerald-400"
          bg="bg-emerald-400/10"
        />
        <StatCard
          icon={ArrowDownCircle}
          label="Hosts Down"
          value={summary.hostsDown}
          color="text-rose-400"
          bg="bg-rose-400/10"
        />
        <StatCard
          icon={ShieldAlert}
          label="Critical Ports"
          value={summary.criticalPortCount}
          color="text-amber-400"
          bg="bg-amber-400/10"
        />
      </div>

      {/* ── Row 2: Two-column — Top ports + Most exposed hosts ── */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Top Open Ports */}
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <div className="mb-4 flex items-center gap-2">
            <div className="rounded-lg bg-violet-400/10 p-2">
              <Network className="h-4 w-4 text-violet-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-100">Top Open Ports</h3>
              <p className="text-[11px] text-slate-500">
                {topPorts.length} most common across all hosts
              </p>
            </div>
          </div>
          {topPorts.length === 0 ? (
            <p className="text-xs text-slate-500">No open ports detected.</p>
          ) : (
            <div className="space-y-1.5">
              {topPorts.map(({ port, service, count }) => {
                const pct = (count / maxPortCount) * 100;
                return (
                  <div key={port} className="flex items-center gap-3 px-1">
                    <span className="w-20 shrink-0 flex items-center gap-1.5">
                      <span className="font-mono text-xs font-semibold text-slate-300">
                        {port}
                      </span>
                      <span className="truncate text-[10px] text-slate-500">{service}</span>
                    </span>
                    <div className="relative flex-1 h-3.5 rounded bg-slate-800">
                      <div
                        className="absolute inset-y-0 left-0 rounded bg-violet-500/40"
                        style={{ width: `${Math.max(pct, 4)}%` }}
                      />
                    </div>
                    <span className="w-8 text-right text-xs font-medium text-slate-400">
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Most Exposed Hosts */}
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <div className="mb-4 flex items-center gap-2">
            <div className="rounded-lg bg-amber-400/10 p-2">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-100">Most Exposed Hosts</h3>
              <p className="text-[11px] text-slate-500">
                Hosts with the most open ports
              </p>
            </div>
          </div>
          {exposedHosts.length === 0 ? (
            <p className="text-xs text-slate-500">No hosts with open ports.</p>
          ) : (
            <div className="space-y-1">
              {exposedHosts.map((h) => (
                <button
                  key={h.ip}
                  onClick={() => onSelectHost(h)}
                  className="group flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition hover:bg-slate-800/60"
                >
                  <Globe className="h-3.5 w-3.5 shrink-0 text-slate-500 group-hover:text-sky-400 transition" />
                  <span className="flex-1 min-w-0">
                    <span className="font-mono text-xs text-slate-200">{h.ip}</span>
                    {h.hostnames[0] && (
                      <span className="ml-2 truncate text-[10px] text-slate-500">
                        {h.hostnames[0]}
                      </span>
                    )}
                  </span>
                  <span className="inline-flex items-center rounded-md border border-sky-700 bg-sky-400/10 px-2 py-0.5 text-[11px] font-semibold text-sky-400">
                    {h.openCount} {h.openCount === 1 ? "port" : "ports"}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Row 3: OS Distribution (if available) ──────── */}
      {summary.osDistribution.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <div className="mb-4 flex items-center gap-2">
            <div className="rounded-lg bg-violet-400/10 p-2">
              <MonitorSmartphone className="h-4 w-4 text-violet-400" />
            </div>
            <h3 className="text-sm font-semibold text-slate-100">OS Distribution</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {summary.osDistribution.slice(0, 8).map((os) => (
              <span
                key={os.name}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-800/40 px-3 py-1.5 text-xs"
              >
                <span className="text-slate-300">{os.name}</span>
                <span className="rounded-full bg-violet-400/10 px-1.5 py-0.5 text-[10px] font-semibold text-violet-400">
                  {os.count}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────────────── */

function StatCard({ icon: Icon, label, value, color, bg }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4">
      <div className={`rounded-lg p-2 ${bg}`}>
        <Icon className={`h-5 w-5 ${color}`} />
      </div>
      <div>
        <p className="text-2xl font-semibold tracking-tight text-slate-100">{value}</p>
        <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">{label}</p>
      </div>
    </div>
  );
}
