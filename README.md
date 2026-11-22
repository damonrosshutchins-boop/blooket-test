# Blooket Test — GitHub Pages + Cloudflare Worker

The public GitHub Pages frontend is at:
https://damonrosshutchins-boop.github.io/blooket-test/

The requested source URL is:
https://clients.x-network.lol/blooket

**What this includes**

- A responsive GitHub Pages launcher that shows the Cloudflare-proxied site in a frame.
- A Cloudflare Worker that requests content from the **single fixed host** clients.x-network.lol. It loads /blooket by default and forwards its own host's asset/API paths. It cannot be pointed at another website.
- A Worker reachability check and an option to open the Worker in its own tab if embedding does not work.
- No API keys or paid account details stored in the repository.

## 1. Enable GitHub Pages

In this repository, open **Settings → Pages**, select **Deploy from a branch** as the build/deployment source, choose **main** and **/(root)**, and save. The frontend is then served at the GitHub Pages URL above.

## 2. Deploy the Cloudflare Worker

You must use your own Cloudflare account to deploy the Worker. GitHub Pages is static hosting and **cannot itself run the proxy**.

**Cloudflare dashboard option:** Open Workers & Pages, create a Worker, replace its starter code with the complete contents of [worker.js](worker.js), then deploy it. Copy its HTTPS workers.dev URL.

**Wrangler command-line option:** If you have Node.js, run:

~~~sh
npx wrangler login
npx wrangler deploy
~~~

The configuration in [wrangler.toml](wrangler.toml) uses a fixed worker name and requires no hardcoded tokens. Cloudflare Workers may be available on its free plan; check its current plan limits.

## 3. Launch from GitHub Pages

Open https://damonrosshutchins-boop.github.io/blooket-test/ and paste the deployed Worker URL, for example:

~~~text
https://blooket-test-fixed-proxy.YOUR-SUBDOMAIN.workers.dev/
~~~

Click **Save & Launch**. The Worker URL is stored only in that browser's local storage, not published to GitHub.

## Important limitations

- The source site could not be fetched from the assistant's environment during setup, so compatibility has **not** been verified.
- Some sites refuse iframe embedding through Content-Security-Policy or X-Frame-Options. This project does not remove those restrictions.
- Third-party login cookies, WebSockets, dynamically generated URLs, and external host dependencies may not work through this simple reverse proxy.
- Redirects to other hosts are blocked. The Worker has no arbitrary target URL field, and no unrestricted browsing feature.
- The GitHub Pages frontend is **not connected to a live Worker until you deploy it**. The GitHub account alone cannot deploy to an unconnected Cloudflare account.
- Only reverse-proxy content you own or have authorization to proxy. Do not use this to bypass website security or network restrictions.

## Troubleshooting

1. Visit your Worker URL directly. If it says the upstream is unreachable, the source itself may be down or may reject Cloudflare.
2. Visit YOUR-WORKER-URL/__proxy_health and check that it returns JSON with service = blooket-test-fixed-proxy. This only checks the Worker, **not** the upstream site.
3. If a blank frame appears, use **Open proxy in new tab** to distinguish embedding restrictions from a Worker routing problem.
4. If styles, images, or actions are missing, inspect the browser developer console for resources fetched from other origins or blocked by the source's policies.
