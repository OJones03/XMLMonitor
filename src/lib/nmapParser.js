/**
 * nmapParser.js
 * ─────────────
 * Converts raw Nmap XML into a normalised JSON structure.
 * Keeps parser logic 100 % separate from UI concerns.
 */

import { XMLParser } from "fast-xml-parser";

/* ── XML → JSON ──────────────────────────────────────────────── */

const parserOptions = {
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  allowBooleanAttributes: true,
  parseTagValue: true,
  trimValues: true,
};

/**
 * Parse an Nmap XML string and return a structured scan result.
 * @param {string} xmlString  Raw XML content from an Nmap scan
 * @returns {import("./types").ScanResult}
 */
export function parseNmapXml(xmlString) {
  const parser = new XMLParser(parserOptions);
  const json = parser.parse(xmlString);

  const nmaprun = json.nmaprun;
  if (!nmaprun) throw new Error("Invalid Nmap XML – missing <nmaprun> root element.");

  const hosts = normaliseArray(nmaprun.host).map(normaliseHost);

  return {
    scanner: nmaprun["@_scanner"] ?? "nmap",
    args: nmaprun["@_args"] ?? "",
    startTime: nmaprun["@_startstr"] ?? "",
    version: nmaprun["@_version"] ?? "",
    hosts,
    summary: buildSummary(hosts),
  };
}

/* ── Host normalisation ──────────────────────────────────────── */

function normaliseHost(raw) {
  const status = raw.status?.["@_state"] ?? "unknown";
  const addresses = normaliseArray(raw.address);

  const ipEntry = addresses.find((a) => a["@_addrtype"] === "ipv4" || a["@_addrtype"] === "ipv6");
  const macEntry = addresses.find((a) => a["@_addrtype"] === "mac");

  const hostnames = normaliseArray(raw.hostnames?.hostname).map(
    (h) => h["@_name"] ?? ""
  );

  const ports = normaliseArray(raw.ports?.port).map(normalisePort);
  const os = normaliseOs(raw.os);

  const uptime = raw.uptime
    ? { seconds: Number(raw.uptime["@_seconds"] ?? 0), lastBoot: raw.uptime["@_lastboot"] ?? "" }
    : null;

  const ip = ipEntry?.["@_addr"] ?? "";

  // ── Derived fields ─────────────────────────────────────────
  // Subnet: /24 derived from IPv4 (e.g. 192.168.1.0/24)
  const subnet = deriveSubnet(ip);

  // Scan timestamp: unix epoch on the <host> element
  const rawTs = raw["@_starttime"];
  const scanTime = rawTs ? new Date(Number(rawTs) * 1000).toISOString() : null;

  // Site name: DNS domain suffix of the first FQDN
  // e.g. "dc01.corp.local" → "corp.local"
  const siteName = deriveSiteName(hostnames);

  // Site code: uppercase prefix before the first "-" in the hostname label
  // e.g. "NYC-DC01.corp.local" → "NYC"
  // Falls back to the first DNS label if no dash present.
  const siteCode = deriveSiteCode(hostnames);

  return {
    status,
    ip,
    addrType: ipEntry?.["@_addrtype"] ?? "ipv4",
    mac: macEntry?.["@_addr"] ?? "",
    macVendor: macEntry?.["@_vendor"] ?? "",
    hostnames,
    ports,
    os,
    uptime,
    subnet,
    scanTime,
    siteName,
    siteCode,
    // convenience flags
    isUp: status === "up",
  };
}

/* ── Port normalisation ──────────────────────────────────────── */

function normalisePort(raw) {
  const scripts = normaliseArray(raw.script).map((s) => ({
    id: s["@_id"] ?? "",
    output: s["@_output"] ?? "",
    // some scripts have nested <elem> / <table> children – keep raw for display
    elements: normaliseArray(s.elem).map((e) =>
      typeof e === "object" ? { key: e["@_key"] ?? "", value: e["#text"] ?? "" } : { key: "", value: String(e) }
    ),
  }));

  return {
    protocol: raw["@_protocol"] ?? "tcp",
    portId: Number(raw["@_portid"]),
    state: raw.state?.["@_state"] ?? "unknown",
    reason: raw.state?.["@_reason"] ?? "",
    service: {
      name: raw.service?.["@_name"] ?? "",
      product: raw.service?.["@_product"] ?? "",
      version: raw.service?.["@_version"] ?? "",
      extraInfo: raw.service?.["@_extrainfo"] ?? "",
      tunnel: raw.service?.["@_tunnel"] ?? "",
      method: raw.service?.["@_method"] ?? "",
      conf: Number(raw.service?.["@_conf"] ?? 0),
    },
    scripts,
  };
}

/* ── OS normalisation ────────────────────────────────────────── */

function normaliseOs(raw) {
  if (!raw) return [];
  return normaliseArray(raw.osmatch).map((m) => ({
    name: m["@_name"] ?? "",
    accuracy: Number(m["@_accuracy"] ?? 0),
    classes: normaliseArray(m.osclass).map((c) => ({
      type: c["@_type"] ?? "",
      vendor: c["@_vendor"] ?? "",
      osfamily: c["@_osfamily"] ?? "",
      osgen: c["@_osgen"] ?? "",
    })),
  }));
}

/* ── Summary builder ─────────────────────────────────────────── */

function buildSummary(hosts) {
  const totalHosts = hosts.length;
  const hostsUp = hosts.filter((h) => h.isUp).length;
  const hostsDown = totalHosts - hostsUp;

  // Collect critical ports (well-known risky ports)
  const CRITICAL_PORTS = new Set([21, 22, 23, 25, 53, 80, 110, 135, 139, 143, 443, 445, 993, 995, 1433, 1521, 3306, 3389, 5432, 5900, 6379, 8080, 8443, 27017]);
  let criticalPortCount = 0;
  const osMap = {};

  for (const host of hosts) {
    for (const port of host.ports) {
      if (port.state === "open" && CRITICAL_PORTS.has(port.portId)) {
        criticalPortCount++;
      }
    }
    for (const match of host.os) {
      const family = match.classes?.[0]?.osfamily || match.name || "Unknown";
      osMap[family] = (osMap[family] || 0) + 1;
    }
  }

  return {
    totalHosts,
    hostsUp,
    hostsDown,
    criticalPortCount,
    osDistribution: Object.entries(osMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count),
  };
}

/* ── Helpers ──────────────────────────────────────────────────── */

/** Ensure a value is always an array (XML parsers collapse single-element arrays). */
function normaliseArray(val) {
  if (val == null) return [];
  return Array.isArray(val) ? val : [val];
}

/** Derive a /24 subnet string from an IPv4 address. */
function deriveSubnet(ip) {
  if (!ip) return "";
  const parts = ip.split(".");
  if (parts.length !== 4) return ip;
  return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
}

/**
 * Derive site name from the DNS domain suffix of the first FQDN hostname.
 * "dc01.corp.local" → "corp.local"
 */
function deriveSiteName(hostnames) {
  const fqdn = hostnames.find((h) => h.includes("."));
  if (!fqdn) return "";
  const labels = fqdn.split(".");
  // Drop the first label (hostname) and keep the rest as the domain
  return labels.length > 1 ? labels.slice(1).join(".") : "";
}

/**
 * Derive site code from the first hostname label.
 * If the label contains "-" the prefix before it is used (e.g. "NYC-DC01" → "NYC").
 * Falls back to the full first label uppercased (capped at 8 chars) when no dash.
 */
function deriveSiteCode(hostnames) {
  const first = hostnames[0];
  if (!first) return "";
  const firstLabel = first.split(".")[0];
  const dashIdx = firstLabel.indexOf("-");
  if (dashIdx > 0 && dashIdx <= 6) {
    return firstLabel.substring(0, dashIdx).toUpperCase();
  }
  return "";
}
