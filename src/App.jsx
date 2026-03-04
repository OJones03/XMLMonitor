import { useState, useCallback } from "react";
import { Radar, Github } from "lucide-react";
import { parseNmapXml } from "./lib/nmapParser";
import { useHostFilter } from "./hooks/useHostFilter";

import ScanPicker from "./components/ScanPicker";
import SummaryCards from "./components/SummaryCards";
import SearchBar from "./components/SearchBar";

import HostTable from "./components/HostTable";
import HostDetail from "./components/HostDetail";

/**
 * Root application layout.
 * Uses a grid-based widget system so cards can be reordered / added easily.
 */
export default function App() {
  const [scanResult, setScanResult] = useState(null);
  const [currentFile, setCurrentFile] = useState(null);
  const [parseError, setParseError] = useState(null);
  const [selectedHost, setSelectedHost] = useState(null);

  const hosts = scanResult?.hosts ?? [];
  const {
    query, setQuery,
    sorted, sortKey, sortAsc, toggleSort,
  } = useHostFilter(hosts);

  const handleLoadXml = useCallback((xmlString, filename) => {
    try {
      setParseError(null);
      const result = parseNmapXml(xmlString, filename);
      setScanResult(result);
      setCurrentFile(filename);
      setSelectedHost(null);
    } catch (err) {
      setParseError(err.message);
      setScanResult(null);
      setCurrentFile(null);
    }
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* ── Navbar ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-screen-2xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <Radar className="h-6 w-6 text-sky-400" />
            <span className="text-lg font-bold tracking-tight">
              ELEMENT<span className="text-sky-400">Monitor</span>
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-500">
            {scanResult && (
              <span className="hidden sm:inline">
                {scanResult.scanner} {scanResult.version} — {scanResult.args.slice(0, 60)}
                {scanResult.args.length > 60 && "…"}
              </span>
            )}
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg p-1.5 transition hover:bg-slate-800 hover:text-slate-300"
            >
              <Github className="h-4 w-4" />
            </a>
          </div>
        </div>
      </header>

      {/* ── Main Content ──────────────────────────────────────── */}
      <main className="mx-auto max-w-screen-2xl space-y-6 px-6 py-8">
        {/* Widget: Two-column layout — Scan Picker sidebar + main content */}
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          {/* ── Sidebar: Scan file picker ───────────────── */}
          <div className="w-full lg:w-96 lg:shrink-0">
            <ScanPicker onLoadXml={handleLoadXml} currentFile={currentFile} />
            {parseError && (
              <p className="mt-3 rounded-lg border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-400">
                {parseError}
              </p>
            )}
          </div>

          {/* ── Main content area ───────────────────────── */}
          <div className="min-w-0 flex-1 space-y-6">
            {!scanResult && (
              <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-slate-800 text-slate-600">
                Select a scan file from the panel to get started.
              </div>
            )}

        {scanResult && (
          <>
            {/* Widget: Scan title */}
            <div>
              <h2 className="text-xl font-semibold tracking-tight">
                {currentFile ?? "Scan Results"}
              </h2>
              <p className="text-xs text-slate-500">
                {scanResult.startTime}
              </p>
            </div>

            {/* Widget: Summary Cards */}
            <section>
              <SummaryCards summary={scanResult.summary} />
            </section>

            {/* Widget: Search + Filters + Table */}
            <section className="space-y-4">
              <SearchBar value={query} onChange={setQuery} />
              <HostTable
                hosts={sorted}
                sortKey={sortKey}
                sortAsc={sortAsc}
                toggleSort={toggleSort}
                onSelect={setSelectedHost}
                siteName={scanResult.fileSiteName}
                siteCode={scanResult.fileSiteCode}
              />
            </section>
          </>
        )}
          </div>
        </div>
      </main>

      {/* ── Detail slide-over ─────────────────────────────────── */}
      <HostDetail
        host={selectedHost}
        open={!!selectedHost}
        onClose={() => setSelectedHost(null)}
      />
    </div>
  );
}
