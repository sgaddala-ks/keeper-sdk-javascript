/** Allowlist of Keeper infra hosts the dev proxy may forward to. */
export function isAllowedKeeperProxyHost(host: string): boolean {
  if (!host || host.includes("..") || host.includes("/")) return false;
  if (/^push\.services\./.test(host)) {
    return isAllowedKeeperProxyHost(host.slice("push.services.".length));
  }
  if (/^connect\./.test(host)) {
    const rest = host.slice("connect.".length);
    return (
      rest === "keepersecurity.us" ||
      /^[a-z0-9.-]+\.keepersecurity\.(com|eu|us)$/.test(rest) ||
      rest === "keepersecurity.com" ||
      rest === "keepersecurity.eu"
    );
  }
  return /^([a-z0-9.-]+\.)?keepersecurity\.(com|eu|us)$/.test(host);
}

export const KEEPER_REST_PROXY_PREFIX = "/__keeper/";
export const KEEPER_WSS_PROXY_PREFIX = "/__keeper-wss/";
