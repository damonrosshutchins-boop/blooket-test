/**
 * Fixed-destination reverse proxy for the user's Blooket Test.
 * Cloudflare Workers deployment only; this file cannot run on GitHub Pages.
 * It never accepts a user-selected upstream host.
 */
const UPSTREAM = "https://clients.x-network.lol";
const START_PATH = "/blooket";
const GITHUB_PAGES_ORIGIN = "https://damonrosshutchins-boop.github.io";
const METHODS = new Set(["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]);

class SameHostAttributeRewriter {
  constructor(originUrl, workerOrigin) {
    this.originUrl = originUrl;
    this.workerOrigin = workerOrigin;
  }
  element(element) {
    for (const attribute of ["href", "src", "action", "poster"]) {
      const original = element.getAttribute(attribute);
      if (!original || /^(#|data:|javascript:|mailto:|tel:)/i.test(original)) continue;
      try {
        const parsed = new URL(original, this.originUrl);
        if (parsed.origin === UPSTREAM) {
          element.setAttribute(attribute, this.workerOrigin + parsed.pathname + parsed.search + parsed.hash);
        }
      } catch { /* Invalid or non-HTTP URLs are left unchanged. */ }
    }
  }
}

function commonCors(origin) {
  if (origin !== GITHUB_PAGES_ORIGIN) return {};
  return {
    "Access-Control-Allow-Origin": GITHUB_PAGES_ORIGIN,
    "Access-Control-Allow-Methods": "GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Vary": "Origin"
  };
}

export default {
  async fetch(request) {
    const current = new URL(request.url);
    const browserOrigin = request.headers.get("Origin");

    if (!METHODS.has(request.method)) {
      return new Response("Method not allowed", { status: 405, headers: { "Allow": [...METHODS].join(", ") } });
    }
    if (request.method === "OPTIONS") {
      return browserOrigin === GITHUB_PAGES_ORIGIN
        ? new Response(null, { status: 204, headers: commonCors(browserOrigin) })
        : new Response("Forbidden", { status: 403 });
    }
    if (current.pathname === "/__proxy_health" && request.method === "GET") {
      return new Response(JSON.stringify({
        service: "blooket-test-fixed-proxy",
        target: UPSTREAM + START_PATH,
        status: "worker-online"
      }), {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
          ...commonCors(browserOrigin)
        }
      });
    }

    // Reject cross-origin write attempts from unrelated sites.
    if (!["GET", "HEAD"].includes(request.method) &&
        browserOrigin &&
        browserOrigin !== current.origin &&
        browserOrigin !== GITHUB_PAGES_ORIGIN) {
      return new Response("Forbidden origin", { status: 403 });
    }

    const destination = new URL(UPSTREAM);
    destination.pathname = current.pathname === "/" ? START_PATH : current.pathname;
    destination.search = current.search;

    const upstreamHeaders = new Headers();
    for (const name of [
      "accept", "accept-language", "authorization", "content-type", "cookie",
      "if-modified-since", "if-none-match", "range", "user-agent"
    ]) {
      const value = request.headers.get(name);
      if (value !== null) upstreamHeaders.set(name, value);
    }
    if (!["GET", "HEAD"].includes(request.method)) {
      upstreamHeaders.set("Origin", UPSTREAM);
      upstreamHeaders.set("Referer", UPSTREAM + START_PATH);
    }

    let upstreamResponse;
    try {
      upstreamResponse = await fetch(destination.toString(), {
        method: request.method,
        headers: upstreamHeaders,
        body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
        redirect: "manual"
      });
    } catch {
      return new Response("The upstream Blooket site could not be reached from Cloudflare.", {
        status: 502,
        headers: { "Content-Type": "text/plain; charset=utf-8", ...commonCors(browserOrigin) }
      });
    }

    // Never follow redirects to other hosts or turn this into a general web proxy.
    const responseHeaders = new Headers(upstreamResponse.headers);
    const location = responseHeaders.get("Location");
    if (location) {
      let redirectTarget;
      try { redirectTarget = new URL(location, destination); } catch {
        return new Response("Invalid upstream redirect", { status: 502 });
      }
      if (redirectTarget.origin !== UPSTREAM) {
        return new Response("The upstream redirected outside its approved host; blocked by this fixed-destination proxy.", {
          status: 502, headers: { "Content-Type": "text/plain; charset=utf-8" }
        });
      }
      responseHeaders.set("Location", current.origin + redirectTarget.pathname + redirectTarget.search + redirectTarget.hash);
    }

    responseHeaders.set("X-Robots-Tag", "noindex, nofollow");
    for (const [name, value] of Object.entries(commonCors(browserOrigin))) responseHeaders.set(name, value);

    // Honor the source's frame and security restrictions; do not remove its CSP/X-Frame-Options.
    if ((upstreamResponse.headers.get("Content-Type") || "").toLowerCase().includes("text/html")) {
      responseHeaders.delete("Content-Length");
      responseHeaders.delete("Content-Encoding");
      const reply = new Response(upstreamResponse.body, {
        status: upstreamResponse.status,
        statusText: upstreamResponse.statusText,
        headers: responseHeaders
      });
      return new HTMLRewriter()
        .on("[href], [src], [action], [poster]", new SameHostAttributeRewriter(destination, current.origin))
        .transform(reply);
    }

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: responseHeaders
    });
  }
};
