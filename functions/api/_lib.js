const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36';

const COLOR_PALETTE = {
  red: [220, 50, 47], orange: [243, 156, 18], yellow: [241, 196, 15], green: [46, 204, 113],
  blue: [52, 152, 219], purple: [155, 89, 182], pink: [232, 126, 164], brown: [141, 110, 99],
  black: [45, 45, 45], white: [236, 240, 241], gray: [149, 165, 166]
};

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,OPTIONS'
    }
  });
}

export function cleanText(value = '') {
  return String(value).replace(/\s+/g, ' ').trim();
}

export function parseProducts(input = '') {
  return [...new Set(String(input).split(/[\n,;|]/).map(v => cleanText(v).toLowerCase()).filter(Boolean))];
}

export function inferPlatform(url = '') {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes('instagram.com')) return 'Instagram';
    if (host.includes('tiktok.com')) return 'TikTok';
    if (host.includes('youtube.com') || host.includes('youtu.be')) return 'YouTube';
    if (host.includes('facebook.com')) return 'Facebook';
    if (host.includes('x.com') || host.includes('twitter.com')) return 'X / Twitter';
  } catch {}
  return 'Other';
}

export function detectLanguage(text = '') {
  const sample = String(text).slice(0, 600);
  if (!sample) return 'unknown';
  if(/[\u3040-\u30ff]/.test(sample)) return 'ja';
  if(/[\uac00-\ud7af]/.test(sample)) return 'ko';
  if(/[\u4e00-\u9fff]/.test(sample)) return 'zh';
  if(/[a-zA-Z]/.test(sample)) return 'en';
  return 'unknown';
}

function decodeHtml(str = '') {
  return String(str)
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function getMeta(html, property) {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`, 'i'),
    new RegExp(`<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${property}["']`, 'i')
  ];
  for (const p of patterns) {
    const match = html.match(p);
    if (match?.[1]) return decodeHtml(match[1]);
  }
  return '';
}

export function parseMeta(html = '', url = '') {
  const titleMatch = html.match(/<title>(.*?)<\/title>/is);
  const title = getMeta(html, 'og:title') || cleanText(decodeHtml(titleMatch?.[1] || ''));
  const description = getMeta(html, 'og:description') || getMeta(html, 'description');
  const thumbnailUrl = getMeta(html, 'og:image') || getMeta(html, 'twitter:image');
  const content = `${title} ${description}`;
  return {
    platform: inferPlatform(url),
    url,
    title,
    snippet: description,
    description,
    thumbnailUrl,
    detectedLanguage: detectLanguage(content),
    dominantColorName: 'unknown',
    intro: cleanText(description).slice(0, 220),
    matchedProducts: [],
    matchReasons: []
  };
}

export async function fetchPage(url) {
  const resp = await fetch(url, {
    headers: {
      'user-agent': USER_AGENT,
      'accept-language': 'en-US,en;q=0.9,zh-HK;q=0.8'
    },
    redirect: 'follow'
  });
  if (!resp.ok) throw new Error(`Fetch failed ${resp.status}`);
  return await resp.text();
}

export async function tryOEmbed(url) {
  const platform = inferPlatform(url);
  const oembedTargets = [];
  if (platform === 'YouTube') {
    oembedTargets.push(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`);
  }
  oembedTargets.push(`https://noembed.com/embed?url=${encodeURIComponent(url)}`);

  for (const endpoint of oembedTargets) {
    try {
      const resp = await fetch(endpoint, { headers: { 'user-agent': USER_AGENT } });
      if (!resp.ok) continue;
      const data = await resp.json();
      return {
        title: cleanText(data.title || ''),
        thumbnailUrl: data.thumbnail_url || '',
        authorName: cleanText(data.author_name || ''),
        providerName: cleanText(data.provider_name || ''),
        html: data.html || ''
      };
    } catch {}
  }
  return null;
}

function distance(a, b) {
  return Math.sqrt((a[0]-b[0])**2 + (a[1]-b[1])**2 + (a[2]-b[2])**2);
}

function guessColorFromBytes(bytes) {
  if (!bytes || bytes.length < 60) return 'unknown';
  let r = 0, g = 0, b = 0, count = 0;
  const step = Math.max(4, Math.floor(bytes.length / 1500));
  for (let i = 0; i < bytes.length; i += step) {
    r += bytes[i] || 0;
    g += bytes[i + 1] || 0;
    b += bytes[i + 2] || 0;
    count += 1;
  }
  const avg = [Math.round(r / Math.max(1, count)), Math.round(g / Math.max(1, count)), Math.round(b / Math.max(1, count))];
  let bestName = 'unknown';
  let bestDistance = Infinity;
  for (const [name, rgb] of Object.entries(COLOR_PALETTE)) {
    const d = distance(avg, rgb);
    if (d < bestDistance) {
      bestDistance = d;
      bestName = name;
    }
  }
  return bestName;
}

export async function enrichWithThumbnailColor(item) {
  if (!item.thumbnailUrl) return item;
  try {
    const resp = await fetch(item.thumbnailUrl, { headers: { 'user-agent': USER_AGENT } });
    if (!resp.ok) return item;
    const bytes = new Uint8Array(await resp.arrayBuffer());
    item.dominantColorName = guessColorFromBytes(bytes);
  } catch {}
  return item;
}

export function parseNaturalTerms(query = '') {
  const raw = cleanText(query).toLowerCase();
  const mustTerms = raw.split(/\s+/).filter(Boolean);
  const expanded = new Set(mustTerms);
  const synonymMap = {
    coffee: ['latte', 'espresso', 'cafe', 'cappuccino', 'beans'],
    skincare: ['serum', 'cream', 'toner', 'beauty'],
    bag: ['handbag', 'tote', 'crossbody'],
    shoe: ['sneaker', 'heels', 'boots'],
    camera: ['lens', 'photography']
  };
  for (const [k, arr] of Object.entries(synonymMap)) {
    if (mustTerms.includes(k)) arr.forEach(v => expanded.add(v));
  }
  return { mustTerms, expandedTerms: [...expanded] };
}

export function scoreItem(item, filters = {}) {
  const text = cleanText(`${item.title} ${item.description} ${item.snippet} ${item.authorName || ''}`).toLowerCase();
  const reasons = [];
  let score = 20;

  const { mustTerms, expandedTerms } = parseNaturalTerms(filters.query || '');
  const strongHits = mustTerms.filter(term => text.includes(term));
  const softHits = expandedTerms.filter(term => !strongHits.includes(term) && text.includes(term));
  if (strongHits.length) {
    score += Math.min(35, strongHits.length * 10);
    reasons.push(`主題命中：${strongHits.join(', ')}`);
  }
  if (softHits.length) {
    score += Math.min(18, softHits.length * 4);
    reasons.push(`延伸字眼：${softHits.slice(0, 5).join(', ')}`);
  }

  if (filters.language && filters.language !== 'all') {
    if (item.detectedLanguage === filters.language) {
      score += 15;
      reasons.push(`語言符合：${filters.language}`);
    } else if (item.detectedLanguage === 'unknown') {
      score -= 3;
    } else {
      score -= 8;
    }
  }

  const productTerms = parseProducts(filters.products);
  const productHits = productTerms.filter(term => text.includes(term));
  item.matchedProducts = productHits;
  if (productHits.length) {
    score += Math.min(24, productHits.length * 8);
    reasons.push(`產品字眼：${productHits.join(', ')}`);
  } else if (productTerms.length) {
    score -= 4;
  }

  if (filters.color) {
    if (item.dominantColorName === filters.color) {
      score += 10;
      reasons.push(`主色符合：${filters.color}`);
    } else if (item.dominantColorName && item.dominantColorName !== 'unknown') {
      score -= 4;
    }
  }

  if (item.thumbnailUrl) {
    score += 4;
    reasons.push('有縮圖');
  }
  if (item.description) {
    score += 4;
    reasons.push('有描述');
  }
  if (item.authorName) {
    score += 2;
  }

  if (item.platform === 'YouTube' && filters.preferYoutube !== false) {
    score += 5;
  }

  item.score = Math.max(0, score);
  item.matchReasons = reasons;
  return item;
}

export function filterItem(item, filters = {}) {
  if (!filters.strictMode) return true;

  const text = cleanText(`${item.title} ${item.description} ${item.snippet}`).toLowerCase();
  const mustTerms = parseNaturalTerms(filters.query || '').mustTerms;
  const productTerms = parseProducts(filters.products);

  if (mustTerms.length && !mustTerms.some(term => text.includes(term))) return false;
  if (filters.language && filters.language !== 'all' && item.detectedLanguage !== filters.language) return false;
  if (productTerms.length && !productTerms.some(term => text.includes(term))) return false;
  if (filters.color && item.dominantColorName !== 'unknown' && item.dominantColorName !== filters.color) return false;
  return true;
}
