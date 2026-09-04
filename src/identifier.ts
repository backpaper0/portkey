export type HostClassification =
  | { kind: "console" }
  | { kind: "upstream"; hostname: string; port: number }
  | { kind: "invalid" };

export function classifyHost(hostHeader: string): HostClassification {
  const host = hostHeader.replace(/:\d+$/, "").toLowerCase();

  if (host === "localhost") {
    return { kind: "console" };
  }

  if (!host.endsWith(".localhost")) {
    return { kind: "invalid" };
  }

  const identifier = host.slice(0, -".localhost".length);
  const parts = identifier.split("~");
  if (parts.length !== 2) {
    return { kind: "invalid" };
  }

  const [hostname, portPart] = parts as [string, string];
  if (!isValidHostname(hostname) || !isValidPort(portPart)) {
    return { kind: "invalid" };
  }

  return { kind: "upstream", hostname, port: Number(portPart) };
}

const HOSTNAME_LABEL = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
const MAX_HOSTNAME_LENGTH = 253;

function isValidHostname(hostname: string): boolean {
  if (hostname.length === 0 || hostname.length > MAX_HOSTNAME_LENGTH) {
    return false;
  }
  return hostname.split(".").every((label) => HOSTNAME_LABEL.test(label));
}

function isValidPort(portStr: string): boolean {
  if (!/^[0-9]+$/.test(portStr)) {
    return false;
  }
  if (portStr.length > 1 && portStr.startsWith("0")) {
    return false;
  }
  const port = Number(portStr);
  return port >= 1 && port <= 65535;
}
