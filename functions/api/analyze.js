import { json, fetchPage, parseMeta, tryOEmbed, enrichWithThumbnailColor, scoreItem, filterItem, inferPlatform, detectLanguage, cleanText } from './_lib.js';

export const onRequestOptions = () => json({ ok: true });

export async function onRequestPost(context) {
  try {
    const payload = await context.request.json();
    const urls = Array.isArray(payload.urls) ? payload.urls.slice(0, 100) : [];
    if (!urls.length) return json({ error: 'Missing urls' }, 400);

    const filters = {
      query: payload.query || '',
      language: payload.language || 'all',
      color: payload.color || '',
      products: payload.products || '',
      strictMode: Boolean(payload.strictMode),
      preferYoutube: true
    };

    const results = [];
    const debug = { mode: 'analyze-urls', inputUrls: urls.length, oembedHits: 0, pageFetchHits: 0, fallbacks: 0, filteredOut: 0 };

    for (const url of urls) {
      let item = {
        platform: inferPlatform(url),
        url,
        title: '',
        description: '',
        snippet: '',
        thumbnailUrl: '',
        detectedLanguage: 'unknown',
        dominantColorName: 'unknown',
        intro: '',
        matchedProducts: [],
        matchReasons: []
      };

      const oembed = await tryOEmbed(url);
      if (oembed) {
        item.title = oembed.title || item.title;
        item.thumbnailUrl = oembed.thumbnailUrl || item.thumbnailUrl;
        item.authorName = oembed.authorName || '';
        item.providerName = oembed.providerName || '';
        item.description = cleanText(`${oembed.authorName || ''} ${oembed.providerName || ''}`);
        item.snippet = item.description;
        item.detectedLanguage = detectLanguage(`${item.title} ${item.description}`);
        item.intro = cleanText(`${item.title} ${item.description}`).slice(0, 220);
        debug.oembedHits += 1;
      }

      if (!item.title || !item.thumbnailUrl) {
        try {
          const html = await fetchPage(url);
          const parsed = parseMeta(html, url);
          item = { ...item, ...parsed, title: item.title || parsed.title, thumbnailUrl: item.thumbnailUrl || parsed.thumbnailUrl };
          item.intro = cleanText(item.description || item.snippet || item.title).slice(0, 220);
          debug.pageFetchHits += 1;
        } catch {
          debug.fallbacks += 1;
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
