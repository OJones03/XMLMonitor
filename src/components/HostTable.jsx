import { ChevronUp, ChevronDown, Eye } from "lucide-react";

/**
 * Sortable host table.
 *
 * Props:
 *  - hosts – filtered + sorted host array
 *  - sortKey / sortAsc / toggleSort – sorting state
 *  - onSelect(host) – callback when "View Details" is clicked
 */
export default function HostTable({ hosts, sortKey, sortAsc, toggleSort, onSelect }) {
  const columns = [
    { key: "status",   label: "Status",    width: "w-24" },
    { key: "ip",       label: "IP Address", width: "" },
    { key: "subnet",   label: "Subnet",     width: "w-36" },
    { key: "hostname", label: "Hostname",   width: "" },
    { key: "siteName", label: "Site Name",  width: "w-32" },
    { key: "siteCode", label: "Site Code",  width: "w-24" },
    { key: "scanTime", label: "Timestamp",  width: "w-36" },
    { key: "ports",    label: "Open Ports", width: "w-28" },
    { key: null,       label: "",            width: "w-28" },
  ];

  if (hosts.length === 0) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-10 text-center text-slate-500">
        No hosts match the current filter.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-800 text-xs font-medium uppercase tracking-wider text-slate-500">
            {columns.map((col) => (
              <th
                key={col.label || "actions"}
                className={`px-5 py-3 ${col.width} ${col.key ? "cursor-pointer select-none hover:text-slate-300 transition-colors" : ""}`}
                onClick={() => col.key && toggleSort(col.key)}
              >
                <span className="flex items-center gap-1">
                  {col.label}
                  {col.key && sortKey === col.key && (
                    sortAsc
                      ? <ChevronUp className="h-3 w-3" />
                      : <ChevronDown className="h-3 w-3" />
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {hosts.map((host, i) => {
            const openPorts = host.ports.filter((p) => p.state === "open").length;
            return (
              <tr
                key={host.ip + i}
                className="border-b border-slate-800/50 transition-colors hover:bg-slate-800/40"
              >
                {/* Status */}
                <td className="px-5 py-3">
                  <span className="flex items-center gap-2">
                    <span
                      className={`inline-block h-2 w-2 rounded-full ${
                        host.isUp ? "bg-emerald-400 animate-pulse-dot" : "bg-rose-500"
                      }`}
                    />
                    <span className={host.isUp ? "text-emerald-400" : "text-rose-400"}>
                      {host.status}
                    </span>
                  </span>
                </td>

                {/* IP */}
                <td className="px-5 py-3 font-mono text-slate-200">{host.ip}</td>

                {/* Subnet */}
                <td className="px-5 py-3 font-mono text-slate-400 text-xs">
                  {host.subnet || "—"}
                </td>

                {/* Hostname */}
                <td className="px-5 py-3 text-slate-400">
                  {host.hostnames[0] || "—"}
                </td>

                {/* Site Name */}
                <td className="px-5 py-3 text-slate-400 text-xs">
                  {host.siteName ? (
                    <span className="inline-flex items-center rounded-full bg-violet-400/10 px-2 py-0.5 text-violet-300">
                      {host.siteName}
                    </span>
                  ) : "—"}
                </td>

                {/* Site Code */}
                <td className="px-5 py-3">
                  {host.siteCode ? (
                    <span className="inline-flex items-center rounded-full bg-amber-400/10 px-2 py-0.5 text-xs font-semibold text-amber-300">
                      {host.siteCode}
                    </span>
                  ) : "—"}
                </td>

                {/* Timestamp */}
                <td className="px-5 py-3 text-xs text-slate-500 whitespace-nowrap">
                  {host.scanTime ? formatTs(host.scanTime) : "—"}
                </td>

                {/* Open Ports count */}
                <td className="px-5 py-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      openPorts > 0
                        ? "bg-sky-400/10 text-sky-400"
                        : "bg-slate-800 text-slate-500"
                    }`}
                  >
                    {openPorts}
                  </span>
                </td>

                {/* Actions */}
                <td className="px-5 py-3 text-right">
                  <button
                    onClick={() => onSelect(host)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-sky-500 hover:text-sky-400"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Details
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function formatTs(iso) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}
