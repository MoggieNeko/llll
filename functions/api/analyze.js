import {
  json, fetchPage, parseMeta, enrichWithThumbnailColor,
  scoreItem, filterItem, inferPlatform, detectLanguage
} from './_lib.js';

export const onRequestOptions = () => json({ ok: true });

export async function onRequestPost(context) {
  try {
    const payload = await context.request.json();
    const urls = Array.isArray(payload.urls) ? payload.urls : [];
    if (!urls.length) return json({ error: 'Missing urls' }, 400);

    const filters = {
      query: '',
      platforms: [],
      language: payload.language || 'all',
      color: payload.color || '',
      products: payload.products || ''
    };

    const analyzed = [];
    const debug = {
      rawResults: urls.length,
      fetchedOk: 0,
      fallbackUsed: 0,
      filteredOut: 0,
      finalCount: 0
    };

    for (const url of urls.slice(0, 100)) {
      let parsed = null;
      try {
        const html = await fetchPage(url);
        parsed = parseMeta(html, url);
        debug.fetchedOk += 1;
      } catch {
        parsed = {
          platform: inferPlatform(url),
          url,
          title: '',
          description: '',
          snippet: '',
          thumbnailUrl: '',
          detectedLanguage: 'unknown',
          dominantColorName: 'unknown',
          matchedProducts: [],
          intro: '',
          source: 'url-fallback'
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
    return json({ results: analyzed, debug });
  } catch (error) {
    return json({ error: String(error?.message || error) }, 500);
  }
}
