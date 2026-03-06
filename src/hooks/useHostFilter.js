import { useMemo, useState } from "react";

/**
 * Custom hook for filtering + sorting the host list.
 *
 * Filters:
 *  query    – free-text (IP, hostname, port, service)
 *  subnet   – exact /24 subnet match
 *  siteName – exact DNS domain match
 *  siteCode – exact site code prefix match
 *  status   – "up" | "down" | ""
 *  dateFrom – ISO date string (inclusive lower bound on scanTime)
 *  dateTo   – ISO date string (inclusive upper bound on scanTime)
 */
export function useHostFilter(hosts, { portFilter = null } = {}) {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState({
    subnet: "",
    siteName: "",
    siteCode: "",
    status: "",
    dateFrom: "",
    dateTo: "",
  });
  const [sortKey, setSortKey] = useState("ip");
  const [sortAsc, setSortAsc] = useState(true);

  function setFilter(key, value) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function clearFilters() {
    setFilters({ subnet: "", siteName: "", siteCode: "", status: "", dateFrom: "", dateTo: "" });
    setQuery("");
  }

  const activeFilterCount = useMemo(
    () => [query, ...Object.values(filters)].filter(Boolean).length,
    [query, filters]
  );

  const filtered = useMemo(() => {
    let list = hosts;

    // Free-text search
    const q = query.toLowerCase().trim();
    if (q) {
      list = list.filter((h) => {
        if (h.ip.toLowerCase().includes(q)) return true;
        if (h.hostnames.some((n) => n.toLowerCase().includes(q))) return true;
        if (h.ports.some((p) => String(p.portId).includes(q))) return true;
        if (h.ports.some((p) => p.service.name.toLowerCase().includes(q))) return true;
        if (h.subnet?.toLowerCase().includes(q)) return true;
        if (h.siteName?.toLowerCase().includes(q)) return true;
        if (h.siteCode?.toLowerCase().includes(q)) return true;
        return false;
      });
    }

    // Dropdown / exact filters
    if (filters.subnet)   list = list.filter((h) => h.subnet === filters.subnet);
    if (filters.siteName) list = list.filter((h) => h.siteName === filters.siteName);
    if (filters.siteCode) list = list.filter((h) => h.siteCode === filters.siteCode);
    if (filters.status)   list = list.filter((h) => h.status === filters.status);

    // Timestamp range
    if (filters.dateFrom) {
      const from = new Date(filters.dateFrom).getTime();
      list = list.filter((h) => h.scanTime && new Date(h.scanTime).getTime() >= from);
    }
    if (filters.dateTo) {
      // dateTo is a date string (YYYY-MM-DD); include the whole day
      const to = new Date(filters.dateTo).getTime() + 86_400_000 - 1;
      list = list.filter((h) => h.scanTime && new Date(h.scanTime).getTime() <= to);
    }

    // Port filter (from PortOverview click)
    if (portFilter != null) {
      list = list.filter((h) =>
        h.ports.some((p) => p.portId === portFilter && p.state === "open")
      );
    }

    return list;
  }, [hosts, query, filters, portFilter]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    list.sort((a, b) => {
      let va, vb;
      switch (sortKey) {
        case "ip":       va = ipToNum(a.ip);    vb = ipToNum(b.ip);    break;
        case "subnet":   va = ipToNum(a.subnet?.replace("/24","") ?? ""); vb = ipToNum(b.subnet?.replace("/24","") ?? ""); break;
        case "hostname": va = (a.hostnames[0] ?? "").toLowerCase(); vb = (b.hostnames[0] ?? "").toLowerCase(); break;
        case "siteName": va = (a.siteName ?? "").toLowerCase(); vb = (b.siteName ?? "").toLowerCase(); break;
        case "siteCode": va = (a.siteCode ?? "").toLowerCase(); vb = (b.siteCode ?? "").toLowerCase(); break;
        case "status":   va = a.status;  vb = b.status;  break;
        case "ports":    va = a.ports.filter((p) => p.state === "open").length; vb = b.ports.filter((p) => p.state === "open").length; break;
        case "scanTime": va = a.scanTime ?? ""; vb = b.scanTime ?? ""; break;
        default:         va = a.ip;      vb = b.ip;
      }
      if (va < vb) return sortAsc ? -1 : 1;
      if (va > vb) return sortAsc ? 1 : -1;
      return 0;
    });
    return list;
  }, [filtered, sortKey, sortAsc]);

  function toggleSort(key) {
    if (sortKey === key) setSortAsc((v) => !v);
    else { setSortKey(key); setSortAsc(true); }
  }

  return {
    query, setQuery,
    filters, setFilter, clearFilters, activeFilterCount,
    sorted, sortKey, sortAsc, toggleSort,
  };
}

function ipToNum(ip) {
  const parts = ip.split(".").map(Number);
  return parts.reduce((acc, octet) => acc * 256 + (octet || 0), 0);
}

