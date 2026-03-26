const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36";

const PLATFORM_RULES = {
  "Instagram": ["site:instagram.com/reel/", "site:instagram.com/p/"],
  "TikTok": ["site:tiktok.com"],
  "YouTube": ["site:youtube.com/watch", "site:youtube.com/shorts", "site:youtu.be"],
  "Facebook": ["site:facebook.com/watch", "site:facebook.com/reel"],
  "X / Twitter": ["site:x.com", "site:twitter.com"]
};

const COLOR_PALETTE = {
  red: [220, 50, 47], orange: [243, 156, 18], yellow: [241, 196, 15], green: [46, 204, 113],
  blue: [52, 152, 219], purple: [155, 89, 182], pink: [232, 126, 164], brown: [141, 110, 99],
  black: [45, 45, 45], white: [236, 240, 241], gray: [149, 165, 166]
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,OPTIONS"
    }
  });
}

function cleanText(value = "") {
  return value.replace(/\s+/g, " ").trim();
}

function decodeDuckDuckGoLink(href) {
  try {
    const url = new URL(href);
    if (url.hostname.endsWith("duckduckgo.com") && url.pathname.startsWith("/l/")) {
      return decodeURIComponent(url.searchParams.get("uddg") || "");
    }
  } catch {}
  return href;
}

function inferPlatform(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes("instagram.com")) return "Instagram";
    if (host.includes("tiktok.com")) return "TikTok";
    if (host.includes("youtube.com") || host.includes("youtu.be")) return "YouTube";
    if (host.includes("facebook.com")) return "Facebook";
    if (host.includes("twitter.com") || host.includes("x.com")) return "X / Twitter";
  } catch {}
  return "Other";
}

function detectLanguage(text) {
  const sample = (text || "").slice(0, 500);
  if (!sample) return "unknown";
  if (/[\u3040-\u30ff]/.test(sample)) return "ja";
  if (/[\uac00-\ud7af]/.test(sample)) return "ko";
  if (/[\u4e00-\u9fff]/.test(sample)) return "zh";
  if (/[a-zA-Z]/.test(sample)) return "en";
  return "unknown";
}

function parseMeta(html, url) {
  const getMeta = (property) => {
    const patterns = [
      new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`, "i"),
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`, "i"),
      new RegExp(`<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']+)["']`, "i"),
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${property}["']`, "i")
    ];
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match?.[1]) return decodeHtml(match[1]);
    }
    return "";
  };
  const titleMatch = html.match(/<title>(.*?)<\/title>/is);
  const title = getMeta("og:title") || cleanText(decodeHtml(titleMatch?.[1] || ""));
  const description = getMeta("og:description") || getMeta("description");
  const thumbnailUrl = getMeta("og:image") || getMeta("twitter:image");
  const content = `${title} ${description}`.trim();
  return {
    platform: inferPlatform(url),
    url,
    title,
    description,
    snippet: description,
    thumbnailUrl,
    detectedLanguage: detectLanguage(content),
    dominantColorName: "unknown",
    matchedProducts: [],
    intro: cleanText(description).slice(0, 220)
  };
}

function decodeHtml(str = "") {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

async function searchDuckDuckGo(query, maxResults = 15) {
  const body = new URLSearchParams({ q: query });
  const resp = await fetch("https://html.duckduckgo.com/html/", {
    method: "POST",
    headers: { "user-agent": USER_AGENT, "content-type": "application/x-www-form-urlencoded" },
    body
  });
  if (!resp.ok) throw new Error(`Search failed ${resp.status}`);
  const html = await resp.text();
  const matches = [...html.matchAll(/<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>(.*?)<\/a>/gsi)];
  const snippets = [...html.matchAll(/<a[^>]+class="result__snippet"[^>]*>(.*?)<\/a>|<div[^>]+class="result__snippet"[^>]*>(.*?)<\/div>/gsi)];
  const results = [];
  const seen = new Set();
  for (let i = 0; i < matches.length && results.length < maxResults; i++) {
    const href = decodeDuckDuckGoLink(decodeHtml(matches[i][1] || ""));
    if (!href || seen.has(href)) continue;
    seen.add(href);
    const title = cleanText(matches[i][2].replace(/<[^>]*>/g, " "));
    const snippet = cleanText(((snippets[i]?.[1] || snippets[i]?.[2] || "")).replace(/<[^>]*>/g, " "));
    results.push({ url: href, title, snippet });
  }
  return results;
}

async function fetchPage(url) {
  const resp = await fetch(url, {
    headers: { "user-agent": USER_AGENT, "accept-language": "en-US,en;q=0.9,zh-HK;q=0.8" },
    redirect: "follow"
  });
  if (!resp.ok) throw new Error(`Fetch failed ${resp.status}`);
  return await resp.text();
}

function distance(a, b) {
  return Math.sqrt((a[0]-b[0])**2 + (a[1]-b[1])**2 + (a[2]-b[2])**2);
}

function guessColorFromImageBytes(bytes) {
  if (!bytes || bytes.length < 48) return "unknown";
  let r = 0, g = 0, b = 0, count = 0;
  const step = Math.max(4, Math.floor(bytes.length / 1200));
  for (let i = 0; i < bytes.length; i += step) {
    r += bytes[i] || 0;
    g += bytes[i + 1] || 0;
    b += bytes[i + 2] || 0;
    count += 1;
  }
  if (!count) return "unknown";
  const avg = [Math.round(r / count), Math.round(g / count), Math.round(b / count)];
  let best = "unknown";
  let bestDistance = Infinity;
  for (const [name, rgb] of Object.entries(COLOR_PALETTE)) {
    const d = distance(avg, rgb);
    if (d < bestDistance) {
      bestDistance = d;
      best = name;
    }
  }
  return best;
}

async function enrichWithThumbnailColor(item) {
  if (!item.thumbnailUrl) return item;
  try {
    const resp = await fetch(item.thumbnailUrl, { headers: { "user-agent": USER_AGENT } });
    if (!resp.ok) return item;
    const bytes = new Uint8Array(await resp.arrayBuffer());
    item.dominantColorName = guessColorFromImageBytes(bytes);
  } catch {}
  return item;
}

function scoreItem(item, filters) {
  let score = 25;
  const text = `${item.title} ${item.description} ${item.snippet}`.toLowerCase();
  if (filters.language && filters.language !== "all" && item.detectedLanguage === filters.language) score += 20;
  if (filters.color && item.dominantColorName === filters.color) score += 15;
  const products = parseProducts(filters.products);
  const matches = products.filter((p) => text.includes(p.toLowerCase()));
  item.matchedProducts = matches;
  score += Math.min(30, matches.length * 12);
  if (filters.query) {
    const queryTerms = filters.query.toLowerCase().split(/\s+/).filter(Boolean);
    const hitCount = queryTerms.filter((term) => text.includes(term)).length;
    score += Math.min(25, hitCount * 6);
  }
  if (item.thumbnailUrl) score += 4;
  if (item.description) score += 6;
  item.score = score;
  return item;
}

function filterItem(item, filters) {
  if (filters.platforms?.length && !filters.platforms.includes(item.platform)) return false;
  if (filters.language && filters.language !== "all" && item.detectedLanguage !== "unknown" && item.detectedLanguage !== filters.language) return false;

  // 顏色與產品在公開頁面常常拿不到完整資料，所以遇到 unknown 時不要直接剔除
  if (filters.color && item.dominantColorName !== "unknown" && item.dominantColorName !== filters.color) return false;

  const products = parseProducts(filters.products);
  if (products.length) {
    const hasText = Boolean((item.title || "").trim() || (item.description || "").trim() || (item.snippet || "").trim());
    if (hasText && (item.matchedProducts || []).length === 0) return false;
  }
  return true;
}

function parseProducts(input = "") {
  return input.split(",").map((s) => s.trim()).filter(Boolean);
}

function buildQueries(query, platforms = []) {
  const selected = platforms.length ? platforms : ["Instagram"];
  const queries = [];
  for (const platform of selected) {
    const rules = PLATFORM_RULES[platform] || [];
    if (!rules.length) {
      queries.push(query);
      continue;
    }
    for (const rule of rules) {
      queries.push(`${query} ${rule}`);
    }
  }
  return [...new Set(queries)];
}

export {
  json,
  searchDuckDuckGo,
  fetchPage,
  parseMeta,
  enrichWithThumbnailColor,
  scoreItem,
  filterItem,
  buildQueries,
  parseProducts,
  inferPlatform,
  detectLanguage
};
