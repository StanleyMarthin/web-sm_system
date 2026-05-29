const DEFAULT_API_BASE_URL = "http://127.0.0.1:3203";

function isLoopbackHost(hostname: string): boolean {
  return hostname === "127.0.0.1" || hostname === "localhost";
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/$/u, "");
}

function isDevelopmentServerFallbackCandidate(configuredApiBaseUrl: string): boolean {
  if (process.env.NODE_ENV === "production") {
    return false;
  }

  try {
    const url = new URL(configuredApiBaseUrl);
    return !isLoopbackHost(url.hostname);
  } catch {
    return false;
  }
}

function getConfiguredApiBaseUrl(): string {
  const configuredApiBaseUrl = (
    process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_URL?.trim() ||
    DEFAULT_API_BASE_URL
  );

  if (typeof window === "undefined" && isDevelopmentServerFallbackCandidate(configuredApiBaseUrl)) {
    const apiHost = process.env.API_HOST?.trim() || "127.0.0.1";
    const apiPort = process.env.API_PORT?.trim() || "3203";
    return `http://${apiHost}:${apiPort}`;
  }

  return configuredApiBaseUrl;
}

export function resolveApiBaseUrl(
  configuredApiBaseUrl: string,
  browserHostname?: string | null,
): string {
  try {
    const url = new URL(configuredApiBaseUrl);

    if (
      browserHostname &&
      isLoopbackHost(browserHostname) &&
      !isLoopbackHost(url.hostname)
    ) {
      url.protocol = "http:";
      url.hostname = browserHostname;
      url.port = process.env.NEXT_PUBLIC_LOCAL_API_PORT?.trim() || "3203";
      url.pathname = "";
      url.search = "";
      url.hash = "";
      return stripTrailingSlash(url.toString());
    }

    if (
      browserHostname &&
      browserHostname !== url.hostname &&
      isLoopbackHost(browserHostname) &&
      isLoopbackHost(url.hostname)
    ) {
      url.hostname = browserHostname;
    }

    return stripTrailingSlash(url.toString());
  } catch {
    return stripTrailingSlash(configuredApiBaseUrl);
  }
}

export function getApiBaseUrl(): string {
  const configuredApiBaseUrl = getConfiguredApiBaseUrl();

  if (typeof window === "undefined") {
    return configuredApiBaseUrl;
  }

  return resolveApiBaseUrl(
    configuredApiBaseUrl,
    window.location?.hostname ?? null,
  );
}

export function getProxiedImageUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;

  if (url.includes(".r2.dev")) {
    const apiBase = getApiBaseUrl();
    return `${apiBase}/api/proxy/image?url=${encodeURIComponent(url)}`;
  }

  return url;
}
