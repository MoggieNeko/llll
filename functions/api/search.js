import {
  json, searchDuckDuckGo, fetchPage, parseMeta, enrichWithThumbnailColor,
  scoreItem, filterItem, buildQueries, inferPlatform, detectLanguage
} from './_lib.js';

export const onRequestOptions = () => json({ ok: true });

export async function onRequestPost(context) {
  try {
    const payload = await context.request.json();
    const query = (payload.query || '').trim();
    if (!query) return json({ error: 'Missing query' }, 400);

    const maxResults = Math.min(50, Math.max(5, Number(payload.maxResults || 15)));
    const filters = {
      query,
      platforms: payload.platforms || ['Instagram'],
      language: payload.language || 'all',
      color: payload.color || '',
      products: payload.products || ''
    };

    const searchQueries = buildQueries(query, filters.platforms);
    const rawResults = [];
    const seen = new Set();

    for (const q of searchQueries) {
      const found = await searchDuckDuckGo(q, maxResults);
      for (const item of found) {
        if (!seen.has(item.url)) {
          seen.add(item.url);
          rawResults.push(item);
        }
      }
    }

    const analyzed = [];
    const debug = {
      query,
      searchQueries,
      rawResults: rawResults.length,
      fetchedOk: 0,
      fallbackUsed: 0,
      filteredOut: 0,
      finalCount: 0
    };

    for (const item of rawResults.slice(0, maxResults * 3)) {
      let parsed = null;
      try {
        const html = await fetchPage(item.url);
        parsed = parseMeta(html, item.url);
        parsed.title = parsed.title || item.title;
        parsed.snippet = parsed.snippet || item.snippet;
        parsed.description = parsed.description || item.snippet;
        parsed.intro = parsed.intro || item.snippet;
        debug.fetchedOk += 1;
      } catch {
        parsed = {
          platform: inferPlatform(item.url),
          url: item.url,
          title: item.title || '',
          description: item.snippet || '',
          snippet: item.snippet || '',
          thumbnailUrl: '',
          detectedLanguage: detectLanguage(`${item.title || ''} ${item.snippet || ''}`),
          dominantColorName: 'unknown',
          matchedProducts: [],
          intro: (item.snippet || '').slice(0, 220),
          source: 'search-fallback'
        };
        debug.fallbackUsed += 1;
      }

      parsed = scoreItem(parsed, filters);
      parsed = await enrichWithThumbnailColor(parsed);
      parsed = scoreItem(parsed, filters);

      if (filterItem(parsed, filters)) analyzed.push(parsed);
      else debug.filteredOut += 1;
    }

    analyzed.sort((a, b) => (b.score || 0) - (a.score || 0));
    debug.finalCount = analyzed.length;
    return json({ results: analyzed.slice(0, maxResults), debug });
  } catch (error) {
    return json({ error: String(error?.message || error) }, 500);
  }
}
