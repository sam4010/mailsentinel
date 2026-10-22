/**
 * Intercepts fetch requests starting with /api/ and prepends the configured server URL
 * if running inside Capacitor or configured in Settings.
 */
export function setupApiIntercept() {
  const originalFetch = window.fetch;
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    let url: string;
    if (typeof input === 'string') {
      url = input;
    } else if (input instanceof URL) {
      url = input.toString();
    } else if (input instanceof Request) {
      url = input.url;
    } else {
      url = String(input);
    }

    if (url.startsWith('/api/')) {
      const serverUrl = localStorage.getItem('mailsentinel_server_url');
      if (serverUrl && serverUrl.trim()) {
        const base = serverUrl.trim().replace(/\/+$/, '');
        const fullUrl = `${base}${url}`;
        if (input instanceof Request) {
          input = new Request(fullUrl, input);
        } else {
          input = fullUrl;
        }
      }
    }

    return originalFetch.call(window, input, init);
  };
}
