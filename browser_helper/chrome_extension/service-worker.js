chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      const isMatch = href => /instagram\.com\/(reel|p)\//i.test(href || '');
      const items = [...new Map([...document.querySelectorAll('a[href]')].map(a => {
        const href = a.href || '';
        if (!isMatch(href)) return null;
        const article = a.closest('article,div,section') || a.parentElement || document.body;
        const img = article.querySelector('img');
        const text = (article.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 500);
        const title = (img?.alt || a.getAttribute('aria-label') || text || '').replace(/\s+/g, ' ').trim().slice(0, 220);
        return [href, { url: href, platform: 'Instagram', title, caption: text, thumbnailUrl: img?.src || '', source: '瀏覽器收集器', collectedAt: new Date().toISOString(), pageTitle: document.title, pageUrl: location.href }];
      }).filter(Boolean)).values()];
      return JSON.stringify(items, null, 2);
    }
  });
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: async (text) => {
        await navigator.clipboard.writeText(text);
        alert(`已複製 ${JSON.parse(text).length} 筆收集結果到剪貼簿`);
      },
      args: [result]
    });
  } catch {}
});
