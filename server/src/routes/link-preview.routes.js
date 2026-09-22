const express = require("express");
const dns = require("dns").promises;
const net = require("net");

const router = express.Router();

const cache = new Map(); // url -> { data, expiresAt }
const CACHE_TTL_MS = 30 * 60 * 1000;
const MAX_CACHE_ENTRIES = 500;
const MAX_BYTES = 200 * 1024;

// Best-effort SSRF guard: resolve the hostname and refuse anything that
// lands in a loopback/private/link-local range before we ever fetch it.
async function isSafeHost(hostname) {
  if (hostname === "localhost") return false;
  try {
    const { address } = await dns.lookup(hostname);
    if (net.isIP(address) === 4) {
      const parts = address.split(".").map(Number);
      if (parts[0] === 127) return false;
      if (parts[0] === 10) return false;
      if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return false;
      if (parts[0] === 192 && parts[1] === 168) return false;
      if (parts[0] === 169 && parts[1] === 254) return false;
      if (address === "0.0.0.0") return false;
    }
    if (address === "::1") return false;
    return true;
  } catch {
    return false;
  }
}

const metaValue = (html, prop) => {
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${prop}["']`, "i"),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return match[1];
  }
  return null;
};

const extractMeta = (html) => {
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return {
    title: metaValue(html, "og:title") || (titleMatch ? titleMatch[1].trim() : null),
    description: metaValue(html, "og:description") || metaValue(html, "description"),
    image: metaValue(html, "og:image"),
    siteName: metaValue(html, "og:site_name"),
  };
};

router.get("/link-preview", async (req, res) => {
  try {
    const rawUrl = String(req.query.url || "");
    let parsed;
    try {
      parsed = new URL(rawUrl);
    } catch {
      return res.status(400).json({ error: { code: "INVALID_URL", message: "Invalid URL." } });
    }
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return res.status(400).json({ error: { code: "INVALID_URL", message: "Invalid URL." } });
    }

    const cacheKey = parsed.toString();
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return res.json({ data: cached.data });
    }

    if (!(await isSafeHost(parsed.hostname))) {
      return res.json({ data: null });
    }

    let response;
    try {
      response = await fetch(parsed.toString(), {
        redirect: "follow",
        signal: AbortSignal.timeout(5000),
        headers: { "User-Agent": "Mozilla/5.0 (compatible; KothaBarthaLinkPreview/1.0)" },
      });
    } catch {
      return res.json({ data: null });
    }

    const contentType = response.headers.get("content-type") || "";
    if (!response.ok || !contentType.includes("text/html")) {
      return res.json({ data: null });
    }

    const reader = response.body.getReader();
    let html = "";
    let bytes = 0;
    while (bytes < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.length;
      html += Buffer.from(value).toString("utf8");
    }
    reader.cancel().catch(() => {});

    const meta = extractMeta(html);
    const data = meta.title
      ? {
          url: parsed.toString(),
          title: meta.title.slice(0, 200),
          description: meta.description ? meta.description.slice(0, 300) : null,
          image: meta.image || null,
          siteName: meta.siteName || parsed.hostname,
        }
      : null;

    if (cache.size >= MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value);
    cache.set(cacheKey, { data, expiresAt: Date.now() + CACHE_TTL_MS });

    res.json({ data });
  } catch {
    res.json({ data: null });
  }
});

module.exports = router;
