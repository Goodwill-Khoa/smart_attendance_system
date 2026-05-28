export function getApiBaseUrl() {
  const envBase = (import.meta.env.VITE_API_BASE_URL || "").trim();
  const host = window.location.hostname || "127.0.0.1";

  if (envBase) {
    try {
      const parsed = new URL(envBase);
      const isLocalBackend =
        parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost";
      const isRemoteClient = host !== "127.0.0.1" && host !== "localhost";

      if (isLocalBackend && isRemoteClient) {
        return `${parsed.protocol}//${host}:${parsed.port || "8000"}`;
      }
    } catch {
      // If env base is not a valid URL, return it as-is and let fetch surface the issue.
    }

    return envBase;
  }

  return `http://${host}:8000`;
}
