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

    if (
      url.startsWith('/api/') ||
      url.startsWith('http://localhost/api/') ||
      url.startsWith('https://localhost/api/') ||
      url.startsWith('capacitor://localhost/api/')
    ) {
      const serverUrl = localStorage.getItem('mailsentinel_server_url');
      if (serverUrl && serverUrl.trim()) {
        const cleanPath = url.replace(/^(?:https?|capacitor):\/\/localhost/, '');
        const base = serverUrl.trim().replace(/\/+$/, '');
        const fullUrl = `${base}${cleanPath}`;
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

/**
 * Safely parse JSON responses from the server, providing clear and actionable
 * error messages if an HTML error page or SPA fallback was returned.
 */
export async function safeJson(res: Response): Promise<any> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    if (text.trim().startsWith('<')) {
      throw new Error(
        'Could not reach backend server. Please enter your Backend Server URL in Settings (e.g. http://192.168.0.102:3001 or your cloud URL).'
      );
    }
    throw new Error(`Invalid response: ${text.slice(0, 80)}`);
  }
}
