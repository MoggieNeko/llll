import {
  json, searchDuckDuckGo, fetchPage, parseMeta, enrichWithThumbnailColor,
  scoreItem, filterItem, buildQueries
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
    for (const item of rawResults.slice(0, maxResults * 2)) {
      try {
        const html = await fetchPage(item.url);
        let parsed = parseMeta(html, item.url);
        parsed.title = parsed.title || item.title;
        parsed.snippet = item.snippet || parsed.snippet;
        parsed.intro = parsed.intro || item.snippet;
        parsed = scoreItem(parsed, filters);
        parsed = await enrichWithThumbnailColor(parsed);
        parsed = scoreItem(parsed, filters);
        if (filterItem(parsed, filters)) analyzed.push(parsed);
      } catch {
        // skip failing pages
      }
    }

    analyzed.sort((a, b) => (b.score || 0) - (a.score || 0));
    return json({ results: analyzed.slice(0, maxResults) });
  } catch (error) {
    return json({ error: String(error?.message || error) }, 500);
  }
}
