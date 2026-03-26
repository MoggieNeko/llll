import {
  json,
  parseCollectorInput,
  fetchPage,
  parseMeta,
  enrichWithThumbnailColor,
  scoreItem,
  filterItem,
  cleanText
} from './_lib.js';

export async function onRequestOptions() {
  return json({ ok: true });
}

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const filters = {
      query: cleanText(body.query || ''),
      language: body.language || 'all',
      color: body.color || '',
      products: body.products || '',
      strictMode: Boolean(body.strictMode),
      platforms: Array.isArray(body.platforms) ? body.platforms.filter(Boolean) : [],
      preferInstagram: body.preferInstagram !== false
    };

    const inputText = [body.collectorText || '', body.urlList || ''].filter(Boolean).join('\n');
    const items = parseCollectorInput(inputText);
    const debug = {
      received: items.length,
      fetchedPages: 0,
      fetchedFailures: 0,
      collectorItems: items.filter(v => v.source === '瀏覽器收集器').length,
      plainUrlItems: items.filter(v => v.source !== '瀏覽器收集器').length,
      filteredOut: 0
    };

    const results = [];

    for (const baseItem of items.slice(0, 120)) {
      let item = { ...baseItem };

      const shouldFetch = (!item.title && !item.description && !item.pageText) || body.forceFetch;
      if (shouldFetch) {
        try {
          const html = await fetchPage(item.url);
          const meta = parseMeta(html, item.url);
          item = { ...meta, ...item, title: item.title || meta.title, description: item.description || meta.description, snippet: item.snippet || meta.snippet, thumbnailUrl: item.thumbnailUrl || meta.thumbnailUrl, pageText: item.pageText || meta.pageText, detectedLanguage: item.detectedLanguage === 'unknown' ? meta.detectedLanguage : item.detectedLanguage, fetchStatus: 'fetched' };
          debug.fetchedPages += 1;
        } catch {
          item.fetchStatus = 'failed';
          debug.fetchedFailures += 1;
        }
      }

      item = await enrichWithThumbnailColor(item);
      item = scoreItem(item, filters);
      if (filterItem(item, filters)) results.push(item);
      else debug.filteredOut += 1;
    }

    results.sort((a, b) => (b.score || 0) - (a.score || 0));
    return json({ results, debug });
  } catch (error) {
    return json({ error: String(error?.message || error) }, 500);
  }
}
