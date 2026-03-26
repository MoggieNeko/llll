import { json, enrichWithThumbnailColor, scoreItem, filterItem, detectLanguage, cleanText } from './_lib.js';

export const onRequestOptions = () => json({ ok: true });

export async function onRequestPost(context) {
  try {
    const payload = await context.request.json();
    const query = cleanText(payload.query || '');
    if (!query) return json({ error: 'Missing query' }, 400);

    const apiKey = cleanText(payload.youtubeApiKey || context.env.YOUTUBE_API_KEY || '');
    if (!apiKey) {
      return json({
        error: 'Missing YouTube API key',
        hint: '請在 Cloudflare 環境變數加入 YOUTUBE_API_KEY，或在前端臨時輸入 API key。'
      }, 400);
    }

    const maxResults = Math.min(50, Math.max(5, Number(payload.maxResults || 15)));
    const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search');
    searchUrl.searchParams.set('part', 'snippet');
    searchUrl.searchParams.set('type', 'video');
    searchUrl.searchParams.set('maxResults', String(maxResults));
    searchUrl.searchParams.set('q', query);
    searchUrl.searchParams.set('key', apiKey);

    const searchResp = await fetch(searchUrl.toString());
    const searchData = await searchResp.json();
    if (!searchResp.ok) {
      return json({ error: searchData?.error?.message || `YouTube search failed ${searchResp.status}` }, 500);
    }

    const filters = {
      query,
      language: payload.language || 'all',
      color: payload.color || '',
      products: payload.products || '',
      strictMode: Boolean(payload.strictMode),
      preferYoutube: true
    };

    const items = Array.isArray(searchData.items) ? searchData.items : [];
    const results = [];
    for (const entry of items) {
      const videoId = entry?.id?.videoId;
      const sn = entry?.snippet || {};
      if (!videoId) continue;
      let item = {
        platform: 'YouTube',
        url: `https://www.youtube.com/watch?v=${videoId}`,
        title: cleanText(sn.title || ''),
        description: cleanText(sn.description || ''),
        snippet: cleanText(sn.description || ''),
        thumbnailUrl: sn?.thumbnails?.high?.url || sn?.thumbnails?.medium?.url || sn?.thumbnails?.default?.url || '',
        detectedLanguage: detectLanguage(`${sn.title || ''} ${sn.description || ''}`),
        dominantColorName: 'unknown',
        intro: cleanText(sn.description || sn.title || '').slice(0, 220),
        channelTitle: cleanText(sn.channelTitle || ''),
        publishedAt: sn.publishedAt || '',
        matchedProducts: [],
        matchReasons: []
      };
      item = await enrichWithThumbnailColor(item);
      item = scoreItem(item, filters);
      if (filterItem(item, filters)) results.push(item);
    }

    results.sort((a, b) => (b.score || 0) - (a.score || 0));
    return json({
      results,
      debug: {
        mode: 'youtube-search',
        query,
        apiResults: items.length,
        finalCount: results.length,
        strictMode: Boolean(payload.strictMode)
      }
    });
  } catch (error) {
    return json({ error: String(error?.message || error) }, 500);
  }
}
