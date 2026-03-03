import { useMemo } from "react";
import { SlidersHorizontal, X } from "lucide-react";

/**
 * FilterBar
 * ─────────
 * Renders dropdown selects for Subnet, Site Name, Site Code, Status,
 * and date-range pickers for the scan timestamp.
 *
 * Props:
 *  hosts            – full (unfiltered) host array, used to derive unique option values
 *  filters          – current filter state object from useHostFilter
 *  setFilter(k, v)  – updates a single filter key
 *  clearFilters()   – resets everything
 *  activeFilterCount – number of active filters (for badge)
 */
export default function FilterBar({ hosts, filters, setFilter, clearFilters, activeFilterCount }) {
  // Derive unique sorted options from ALL hosts (not filtered)
  const options = useMemo(() => {
    const subnets   = new Set();
    const siteNames = new Set();
    const siteCodes = new Set();
    const statuses  = new Set();

    for (const h of hosts) {
      if (h.subnet)   subnets.add(h.subnet);
      if (h.siteName) siteNames.add(h.siteName);
      if (h.siteCode) siteCodes.add(h.siteCode);
      if (h.status)   statuses.add(h.status);
    }

    return {
      subnets:   [...subnets].sort(),
      siteNames: [...siteNames].sort(),
      siteCodes: [...siteCodes].sort(),
      statuses:  [...statuses].sort(),
    };
  }, [hosts]);

  const hasAny =
    options.subnets.length > 0 ||
    options.siteNames.length > 0 ||
    options.siteCodes.length > 0 ||
    options.statuses.length > 1;

  if (!hasAny && hosts.length === 0) return null;

  return (
    <div className="space-y-3">
      {/* Filter row */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 self-center">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filters
          {activeFilterCount > 0 && (
            <span className="rounded-full bg-sky-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
              {activeFilterCount}
            </span>
          )}
        </div>

        {/* Subnet */}
        {options.subnets.length > 0 && (
          <FilterSelect
            label="Subnet"
            value={filters.subnet}
            onChange={(v) => setFilter("subnet", v)}
            options={options.subnets}
            placeholder="All subnets"
          />
        )}

        {/* Site Name */}
        {options.siteNames.length > 0 && (
          <FilterSelect
            label="Site Name"
            value={filters.siteName}
            onChange={(v) => setFilter("siteName", v)}
            options={options.siteNames}
            placeholder="All sites"
          />
        )}

        {/* Site Code */}
        {options.siteCodes.length > 0 && (
          <FilterSelect
            label="Site Code"
            value={filters.siteCode}
            onChange={(v) => setFilter("siteCode", v)}
            options={options.siteCodes}
            placeholder="All codes"
          />
        )}

        {/* Status */}
        {options.statuses.length > 1 && (
          <FilterSelect
            label="Status"
            value={filters.status}
            onChange={(v) => setFilter("status", v)}
            options={options.statuses}
            placeholder="Any status"
          />
        )}

        {/* Date From */}
        <DateInput
          label="From"
          value={filters.dateFrom}
          onChange={(v) => setFilter("dateFrom", v)}
        />

        {/* Date To */}
        <DateInput
          label="To"
          value={filters.dateTo}
          onChange={(v) => setFilter("dateTo", v)}
        />

        {/* Clear all */}
        {activeFilterCount > 0 && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-400 transition hover:border-red-700 hover:text-red-400"
          >
            <X className="h-3 w-3" />
            Clear all
          </button>
        )}
      </div>

      {/* Active filter chips */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(filters).map(([key, val]) => {
            if (!val) return null;
            return (
              <span
                key={key}
                className="inline-flex items-center gap-1 rounded-full border border-sky-800 bg-sky-900/40 px-2.5 py-0.5 text-xs text-sky-300"
              >
                <span className="text-sky-500">{FILTER_LABELS[key] ?? key}:</span>
                {val}
                <button
                  onClick={() => setFilter(key, "")}
                  className="ml-0.5 rounded-full hover:text-white"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────────────── */

function FilterSelect({ label, value, onChange, options, placeholder }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`rounded-lg border px-3 py-2 text-xs outline-none transition focus:ring-1 focus:ring-sky-500/40
          ${value
            ? "border-sky-700 bg-sky-900/30 text-sky-300 focus:border-sky-500"
            : "border-slate-700 bg-slate-900/80 text-slate-300 focus:border-slate-500"
          }`}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}

function DateInput({ label, value, onChange }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
        {label}
      </label>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`rounded-lg border px-3 py-2 text-xs outline-none transition focus:ring-1 focus:ring-sky-500/40
          [color-scheme:dark]
          ${value
            ? "border-sky-700 bg-sky-900/30 text-sky-300 focus:border-sky-500"
            : "border-slate-700 bg-slate-900/80 text-slate-300 focus:border-slate-500"
          }`}
      />
    </div>
  );
}

/* ── Constants ──────────────────────────────────────────────── */

const FILTER_LABELS = {
  subnet:   "Subnet",
  siteName: "Site Name",
  siteCode: "Site Code",
  status:   "Status",
  dateFrom: "From",
  dateTo:   "To",
};
