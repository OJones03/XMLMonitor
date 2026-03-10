import { ChevronUp, ChevronDown, MapPin, Tag, Download } from "lucide-react";

function downloadCsv(hosts, siteName, siteCode) {
  const headers = ["Site Code", "Site Name", "Status", "IP Address", "Hostname", "Timestamp", "Open Ports"];

  const escape = (v) => {
    const s = String(v ?? "");
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };

  const rows = hosts.map((h) => [
    siteCode ?? "",
    siteName ? siteName.replace(/_/g, " ") : "",
    h.status,
    h.ip,
    h.hostnames[0] ?? "",
    h.scanTime ? new Date(h.scanTime).toLocaleString() : "",
    h.ports.filter((p) => p.state === "open").length,
  ]);

  const csv = [headers, ...rows].map((r) => r.map(escape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${siteCode || "scan"}_hosts_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Sortable host table.
 *
 * Props:
 *  - hosts – filtered + sorted host array
 *  - sortKey / sortAsc / toggleSort – sorting state
 *  - onSelect(host) – callback when "View Details" is clicked
 *  - siteName / siteCode – shown once above the table
 */
export default function HostTable({ hosts, sortKey, sortAsc, toggleSort, onSelect, siteName, siteCode }) {
  const columns = [
    { key: "status",   label: "Status",    width: "w-24" },
    { key: "ip",       label: "IP Address", width: "" },
    { key: "hostname", label: "Hostname",   width: "" },
    { key: "scanTime", label: "Timestamp",  width: "w-36" },
    { key: "ports",    label: "Open Ports", width: "w-28" },
  ];

  if (hosts.length === 0) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-10 text-center text-slate-500">
        No hosts match the current filter.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900">
      {/* ── Site banner ───────────────────────────────────── */}
      {(siteName || siteCode) && (
        <div className="flex items-center gap-4 border-b border-slate-800 bg-slate-800/40 px-5 py-2.5">
          {siteName && (
            <span className="flex items-center gap-1.5 text-xs text-violet-300">
              <MapPin className="h-3.5 w-3.5 text-violet-400" />
              <span className="font-medium text-slate-400">Site:</span>
              <span className="rounded-full bg-violet-400/10 px-2 py-0.5">{siteName.replace(/_/g, " ")}</span>
            </span>
          )}
          {siteCode && (
            <span className="flex items-center gap-1.5 text-xs text-amber-300">
              <Tag className="h-3.5 w-3.5 text-amber-400" />
              <span className="font-medium text-slate-400">Code:</span>
              <span className="rounded-full bg-amber-400/10 px-2 py-0.5 font-semibold">{siteCode}</span>
            </span>
          )}
          {hosts[0]?.subnet && (
            <span className="flex items-center gap-1.5 text-xs text-cyan-300">
              <span className="font-medium text-slate-400">Subnet:</span>
              <span className="rounded-full bg-cyan-400/10 px-2 py-0.5 font-mono text-cyan-400">{hosts[0].subnet}</span>
            </span>
          )}
          <button
            onClick={() => downloadCsv(hosts, siteName, siteCode)}
            title="Download table as CSV"
            className="ml-auto flex items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1 text-xs text-slate-400 transition hover:border-emerald-600 hover:text-emerald-400"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
        </div>
      )}
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

                {/* Hostname */}
                <td className="px-5 py-3 text-slate-400">
                  {host.hostnames[0] || "—"}
                </td>

                {/* Timestamp */}
                <td className="px-5 py-3 text-xs text-slate-500 whitespace-nowrap">
                  {host.scanTime ? formatTs(host.scanTime) : "—"}
                </td>

                {/* Open Ports — clicking opens detail panel */}
                <td className="px-5 py-3">
                  <button
                    onClick={() => onSelect(host)}
                    className={`inline-flex items-center rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                      openPorts > 0
                        ? "border-sky-700 bg-sky-400/10 text-sky-400 hover:border-sky-400 hover:bg-sky-400/20"
                        : "border-slate-700 bg-slate-800 text-slate-500 hover:border-slate-500 hover:text-slate-300"
                    }`}
                  >
                    {openPorts} {openPorts === 1 ? "port" : "ports"}
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
