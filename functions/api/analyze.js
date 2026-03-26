import {
  json, fetchPage, parseMeta, enrichWithThumbnailColor,
  scoreItem, filterItem
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
    for (const url of urls.slice(0, 100)) {
      try {
        const html = await fetchPage(url);
        let parsed = parseMeta(html, url);
        parsed = scoreItem(parsed, filters);
        parsed = await enrichWithThumbnailColor(parsed);
        parsed = scoreItem(parsed, filters);
        if (filterItem(parsed, filters)) analyzed.push(parsed);
      } catch {
        // skip failing pages
      }
    }

    analyzed.sort((a, b) => (b.score || 0) - (a.score || 0));
    return json({ results: analyzed });
  } catch (error) {
    return json({ error: String(error?.message || error) }, 500);
  }
}
