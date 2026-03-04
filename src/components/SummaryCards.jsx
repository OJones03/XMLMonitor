import {
  Server,
  ArrowUpCircle,
  ArrowDownCircle,
  ShieldAlert,
  MonitorSmartphone,
} from "lucide-react";

/**
 * Top-level summary cards: Total Hosts, Up/Down, Open Ports, OS Distribution.
 */
export default function SummaryCards({ summary }) {
  if (!summary) return null;

  const cards = [
    {
      label: "Total Hosts",
      value: summary.totalHosts,
      icon: Server,
      color: "text-sky-400",
      bg: "bg-sky-400/10",
    },
    {
      label: "Hosts Up",
      value: summary.hostsUp,
      icon: ArrowUpCircle,
      color: "text-emerald-400",
      bg: "bg-emerald-400/10",
    },
    {
      label: "Hosts Down",
      value: summary.hostsDown,
      icon: ArrowDownCircle,
      color: "text-rose-400",
      bg: "bg-rose-400/10",
    },
    {
      label: "Open Ports",
      value: summary.criticalPortCount,
      icon: ShieldAlert,
      color: "text-amber-400",
      bg: "bg-amber-400/10",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
      {cards.map((c) => (
        <div
          key={c.label}
          className="animate-fade-in flex items-center gap-4 rounded-xl border border-slate-800 bg-slate-900 p-5"
        >
          <div className={`rounded-lg p-2.5 ${c.bg}`}>
            <c.icon className={`h-5 w-5 ${c.color}`} />
          </div>
          <div>
            <p className="text-2xl font-semibold tracking-tight text-slate-100">
              {c.value}
            </p>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
              {c.label}
            </p>
          </div>
        </div>
      ))}

      {/* OS Distribution mini-card */}
      {summary.osDistribution.length > 0 && (
        <div className="animate-fade-in flex items-start gap-4 rounded-xl border border-slate-800 bg-slate-900 p-5 sm:col-span-2 lg:col-span-1">
          <div className="rounded-lg bg-violet-400/10 p-2.5">
            <MonitorSmartphone className="h-5 w-5 text-violet-400" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-1">
              OS Distribution
            </p>
            {summary.osDistribution.slice(0, 4).map((os) => (
              <p key={os.name} className="truncate text-sm text-slate-300">
                {os.name}{" "}
                <span className="text-slate-500">×{os.count}</span>
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
