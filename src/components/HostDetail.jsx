import { Fragment } from "react";
import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild, Tab, TabGroup, TabList, TabPanel, TabPanels } from "@headlessui/react";
import { X, Globe, Wifi, Terminal, Shield, Clock } from "lucide-react";

/**
 * Detail panel — opens as a slide-over dialog for a selected host.
 * Shows open ports, service info, NSE script output, and OS data.
 */
export default function HostDetail({ host, open, onClose }) {
  if (!host) return null;

  const openPorts = host.ports.filter((p) => p.state === "open");
  const otherPorts = host.ports.filter((p) => p.state !== "open");
  const hasScripts = host.ports.some((p) => p.scripts.length > 0);

  return (
    <Transition show={open} as={Fragment}>
      <Dialog onClose={onClose} className="relative z-50">
        {/* Backdrop */}
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
        </TransitionChild>

        {/* Panel */}
        <div className="fixed inset-0 flex justify-end">
          <TransitionChild
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="translate-x-full"
            enterTo="translate-x-0"
            leave="ease-in duration-150"
            leaveFrom="translate-x-0"
            leaveTo="translate-x-full"
          >
            <DialogPanel className="w-full max-w-2xl overflow-y-auto bg-slate-950 shadow-2xl border-l border-slate-800">
              {/* Header */}
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-800 bg-slate-950/90 backdrop-blur px-6 py-4">
                <div>
                  <DialogTitle className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                    <Globe className="h-5 w-5 text-sky-400" />
                    {host.ip}
                  </DialogTitle>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {host.hostnames[0] || "No hostname"} · {host.mac ? `MAC ${host.mac}` : host.addrType}
                    {host.macVendor ? ` (${host.macVendor})` : ""}
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-800 hover:text-slate-300"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Tabs */}
              <TabGroup className="px-6 py-5">
                <TabList className="flex gap-1 rounded-lg bg-slate-900 p-1 mb-5">
                  {["Ports", hasScripts && "Scripts", host.os.length > 0 && "OS"].filter(Boolean).map((t) => (
                    <Tab
                      key={t}
                      className={({ selected }) =>
                        `flex-1 rounded-md px-3 py-2 text-xs font-medium transition outline-none
                        ${selected
                          ? "bg-slate-800 text-sky-400 shadow"
                          : "text-slate-500 hover:text-slate-300"
                        }`
                      }
                    >
                      {t}
                    </Tab>
                  ))}
                </TabList>

                <TabPanels>
                  {/* ── Ports Tab ─────────────────────────── */}
                  <TabPanel>
                    {openPorts.length === 0 ? (
                      <p className="text-sm text-slate-500">No open ports detected.</p>
                    ) : (
                      <div className="space-y-2">
                        {openPorts.map((p) => (
                          <PortRow key={`${p.protocol}-${p.portId}`} port={p} />
                        ))}
                      </div>
                    )}

                    {otherPorts.length > 0 && (
                      <details className="mt-6 group">
                        <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-400 transition">
                          Show {otherPorts.length} filtered/closed port(s)
                        </summary>
                        <div className="mt-2 space-y-2">
                          {otherPorts.map((p) => (
                            <PortRow key={`${p.protocol}-${p.portId}`} port={p} muted />
                          ))}
                        </div>
                      </details>
                    )}

                    {host.uptime && (
                      <div className="mt-6 flex items-center gap-2 text-xs text-slate-500">
                        <Clock className="h-3.5 w-3.5" />
                        Uptime: {formatUptime(host.uptime.seconds)}
                        {host.uptime.lastBoot && ` · Last boot: ${host.uptime.lastBoot}`}
                      </div>
                    )}
                  </TabPanel>

                  {/* ── Scripts Tab ───────────────────────── */}
                  {hasScripts && (
                    <TabPanel>
                      <div className="space-y-4">
                        {host.ports
                          .filter((p) => p.scripts.length > 0)
                          .map((p) => (
                            <div key={`${p.protocol}-${p.portId}`}>
                              <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                                <Terminal className="h-3.5 w-3.5 text-amber-400" />
                                {p.portId}/{p.protocol} — {p.service.name || "unknown"}
                              </h4>
                              {p.scripts.map((s) => (
                                <div
                                  key={s.id}
                                  className="mb-3 rounded-lg border border-slate-800 bg-slate-900 p-4"
                                >
                                  <p className="mb-1 text-xs font-medium text-sky-400">
                                    {s.id}
                                  </p>
                                  <pre className="whitespace-pre-wrap break-words text-xs leading-relaxed text-slate-300">
                                    {s.output}
                                  </pre>
                                </div>
                              ))}
                            </div>
                          ))}
                      </div>
                    </TabPanel>
                  )}

                  {/* ── OS Tab ────────────────────────────── */}
                  {host.os.length > 0 && (
                    <TabPanel>
                      <div className="space-y-3">
                        {host.os.map((m, i) => (
                          <div
                            key={i}
                            className="flex items-start gap-3 rounded-lg border border-slate-800 bg-slate-900 p-4"
                          >
                            <Shield className="mt-0.5 h-4 w-4 shrink-0 text-violet-400" />
                            <div>
                              <p className="text-sm font-medium text-slate-200">
                                {m.name}
                              </p>
                              <p className="text-xs text-slate-500">
                                Accuracy: {m.accuracy}%
                              </p>
                              {m.classes.map((c, j) => (
                                <p key={j} className="mt-1 text-xs text-slate-400">
                                  {[c.vendor, c.osfamily, c.osgen, c.type]
                                    .filter(Boolean)
                                    .join(" · ")}
                                </p>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </TabPanel>
                  )}
                </TabPanels>
              </TabGroup>
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  );
}

/* ── Sub-components ────────────────────────────────────────────── */

function PortRow({ port, muted = false }) {
  const stateColor = {
    open: "bg-emerald-400/10 text-emerald-400",
    closed: "bg-rose-400/10 text-rose-400",
    filtered: "bg-amber-400/10 text-amber-400",
  }[port.state] ?? "bg-slate-800 text-slate-500";

  return (
    <div
      className={`flex items-center gap-4 rounded-lg border px-4 py-3 transition ${
        muted
          ? "border-slate-800/50 bg-slate-900/40 opacity-60"
          : "border-slate-800 bg-slate-900"
      }`}
    >
      {/* Port number + protocol */}
      <div className="w-20 shrink-0">
        <span className="font-mono text-sm font-semibold text-slate-200">
          {port.portId}
        </span>
        <span className="text-xs text-slate-500">/{port.protocol}</span>
      </div>

      {/* State badge */}
      <span
        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${stateColor}`}
      >
        {port.state}
      </span>

      {/* Service info */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-slate-300">
          <Wifi className="mr-1 inline h-3 w-3 text-slate-500" />
          {port.service.name || "unknown"}
          {port.service.product && (
            <span className="ml-2 text-slate-500">
              {port.service.product}
              {port.service.version && ` ${port.service.version}`}
            </span>
          )}
        </p>
        {port.service.extraInfo && (
          <p className="truncate text-xs text-slate-500">{port.service.extraInfo}</p>
        )}
      </div>

      {/* Script count badge */}
      {port.scripts.length > 0 && (
        <span className="shrink-0 rounded-full bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
          {port.scripts.length} NSE
        </span>
      )}
    </div>
  );
}

/* ── Helpers ───────────────────────────────────────────────────── */

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return [d && `${d}d`, h && `${h}h`, `${m}m`].filter(Boolean).join(" ");
}
