import { Search, X, Monitor, Globe, Server } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Global search bar with a categorised suggestion dropdown.
 *
 * Props:
 *  value    – current query string
 *  onChange – setter for query string
 *  hosts    – full (unfiltered) host array for building suggestions
 */
export default function SearchBar({ value, onChange, hosts = [] }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleOutsideClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const q = value.toLowerCase().trim();

  const suggestions = useMemo(() => {
    if (!hosts.length) return { ips: [], hostnames: [], ports: [] };

    // All unique IPs
    const allIps = [...new Set(hosts.map((h) => h.ip).filter(Boolean))].sort();
    const ips = q ? allIps.filter((ip) => ip.includes(q)) : allIps;

    // All unique hostnames
    const allHostnames = [
      ...new Set(hosts.flatMap((h) => h.hostnames).filter(Boolean)),
    ].sort();
    const hostnames = q
      ? allHostnames.filter((n) => n.toLowerCase().includes(q))
      : allHostnames;

    // Port breakdown: aggregate open ports across all hosts
    const portMap = new Map();
    for (const host of hosts) {
      for (const p of host.ports) {
        if (p.state !== "open") continue;
        const key = `${p.portId}/${p.protocol}`;
        if (!portMap.has(key)) {
          portMap.set(key, {
            portId: p.portId,
            protocol: p.protocol,
            service: p.service.name || "unknown",
            product: p.service.product || "",
            count: 0,
          });
        }
        portMap.get(key).count++;
      }
    }
    const allPorts = [...portMap.values()].sort((a, b) => b.count - a.count || a.portId - b.portId);
    const ports = q
      ? allPorts.filter(
          (p) =>
            String(p.portId).includes(q) ||
            p.service.toLowerCase().includes(q) ||
            p.product.toLowerCase().includes(q) ||
            p.protocol.includes(q)
        )
      : allPorts;

    return {
      ips: ips.slice(0, 25),
      hostnames: hostnames.slice(0, 25),
      ports: ports.slice(0, 40),
    };
  }, [hosts, q]);

  const hasResults =
    suggestions.ips.length ||
    suggestions.hostnames.length ||
    suggestions.ports.length;

  function pick(val) {
    onChange(val);
    setOpen(false);
  }

  return (
    <div className="relative" ref={containerRef}>
      {/* Input */}
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        placeholder="Filter by IP, hostname, port, or service…"
        className="w-full rounded-lg border border-slate-700 bg-slate-900/80 py-2.5 pl-10 pr-8 text-sm text-slate-200 placeholder-slate-500 outline-none transition focus:border-sky-500 focus:ring-1 focus:ring-sky-500/40"
      />
      {value && (
        <button
          onClick={() => { onChange(""); setOpen(true); }}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-500 hover:text-slate-300 transition"
          title="Clear"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}

      {/* Dropdown */}
      {open && hasResults && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden">
          <div className="max-h-[26rem] overflow-y-auto divide-y divide-slate-800/60">

            {/* ── IP Addresses ──────────────────────────── */}
            {suggestions.ips.length > 0 && (
              <section className="px-3 py-2.5">
                <p className="mb-1.5 flex items-center gap-1.5 px-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  <Monitor className="h-3 w-3" />
                  IP Addresses
                  <span className="ml-auto rounded-full bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-500">
                    {suggestions.ips.length}
                  </span>
                </p>
                <div className="grid grid-cols-2 gap-0.5 sm:grid-cols-3">
                  {suggestions.ips.map((ip) => (
                    <button
                      key={ip}
                      onMouseDown={(e) => { e.preventDefault(); pick(ip); }}
                      className="rounded-lg px-2 py-1.5 text-left text-xs font-mono text-slate-300 hover:bg-slate-800 hover:text-sky-400 transition"
                    >
                      {ip}
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* ── Hostnames ─────────────────────────────── */}
            {suggestions.hostnames.length > 0 && (
              <section className="px-3 py-2.5">
                <p className="mb-1.5 flex items-center gap-1.5 px-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  <Globe className="h-3 w-3" />
                  Hostnames
                  <span className="ml-auto rounded-full bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-500">
                    {suggestions.hostnames.length}
                  </span>
                </p>
                <div className="flex flex-col gap-0.5">
                  {suggestions.hostnames.map((name) => (
                    <button
                      key={name}
                      onMouseDown={(e) => { e.preventDefault(); pick(name); }}
                      className="rounded-lg px-2 py-1.5 text-left text-xs text-slate-300 hover:bg-slate-800 hover:text-sky-400 transition"
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* ── Open Ports Breakdown ──────────────────── */}
            {suggestions.ports.length > 0 && (
              <section className="px-3 py-2.5">
                <p className="mb-1.5 flex items-center gap-1.5 px-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  <Server className="h-3 w-3" />
                  Open Ports
                  <span className="ml-auto rounded-full bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-500">
                    {suggestions.ports.length} unique
                  </span>
                </p>
                <div className="flex flex-col gap-0.5">
                  {suggestions.ports.map((p) => (
                    <button
                      key={`${p.portId}/${p.protocol}`}
                      onMouseDown={(e) => { e.preventDefault(); pick(String(p.portId)); }}
                      className="group flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs hover:bg-slate-800 transition"
                    >
                      <span className="flex items-center gap-2.5 min-w-0">
                        {/* Port badge */}
                        <span className="shrink-0 rounded bg-sky-400/10 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-sky-400 group-hover:text-sky-300">
                          {p.portId}
                        </span>
                        {/* Protocol tag */}
                        <span className="shrink-0 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-500">
                          {p.protocol}
                        </span>
                        {/* Service */}
                        <span className="truncate text-slate-300 group-hover:text-slate-200">
                          {p.service}
                          {p.product ? (
                            <span className="ml-1 text-slate-500">{p.product}</span>
                          ) : null}
                        </span>
                      </span>
                      {/* Host count pill */}
                      <span className="ml-3 shrink-0 rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-500 group-hover:bg-slate-700 group-hover:text-slate-400">
                        {p.count} {p.count === 1 ? "host" : "hosts"}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
