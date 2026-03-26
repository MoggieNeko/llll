const state = { results: [] };
const $ = id => document.getElementById(id);

function getSelectedValues(selectEl) {
  return Array.from(selectEl.selectedOptions).map(o => o.value);
}

function setStatus(text) { $('statusText').textContent = text; }
function setDebug(value) { $('debugBox').textContent = typeof value === 'string' ? value : JSON.stringify(value, null, 2); }

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
function escapeAttr(value) { return escapeHtml(value); }
function jsSafe(value) { return String(value || '').replaceAll('\\', '\\\\').replaceAll("'", "\\'"); }

function parseNaturalLanguage(input) {
  const text = (input || '').trim();
  if (!text) return {};
  const parsed = { query: text };
  if (/(youtube|yt|shorts)/i.test(text)) parsed.platforms = ['YouTube'];
  if (/(ig|instagram)/i.test(text)) parsed.platforms = ['Instagram'];
  if (/tiktok/i.test(text)) parsed.platforms = ['TikTok'];
  if (/(facebook|fb)/i.test(text)) parsed.platforms = ['Facebook'];
  if (/(x|twitter)/i.test(text)) parsed.platforms = ['X / Twitter'];

  if (/(英文|english)/i.test(text)) parsed.language = 'en';
  else if (/(中文|廣東話|粵語|mandarin|chinese)/i.test(text)) parsed.language = 'zh';
  else if (/(日文|日本語|japanese)/i.test(text)) parsed.language = 'ja';
  else if (/(韓文|한국어|korean)/i.test(text)) parsed.language = 'ko';

  const colorMap = [
    [/(藍|blue)/i, 'blue'], [/(粉|pink)/i, 'pink'], [/(綠|green)/i, 'green'], [/(黃|yellow)/i, 'yellow'],
    [/(黑|black)/i, 'black'], [/(白|white)/i, 'white'], [/(紅|red)/i, 'red'], [/(紫|purple)/i, 'purple'],
    [/(橙|orange)/i, 'orange'], [/(啡|棕|brown)/i, 'brown'], [/(灰|gray|grey)/i, 'gray']
  ];
  for (const [regex, color] of colorMap) if (regex.test(text)) { parsed.color = color; break; }

  const candidateTerms = ['latte', 'grinder', 'coffee', 'beans', 'espresso', 'serum', 'skincare', 'lipstick', 'bag', 'shoe', 'camera'];
  const hits = candidateTerms.filter(term => new RegExp(`\\b${term}\\b`, 'i').test(text));
  if (hits.length) parsed.products = hits.join(', ');
  return parsed;
}

function applyNaturalLanguage() {
  const parsed = parseNaturalLanguage($('naturalQuery').value);
  if (parsed.query) $('query').value = parsed.query;
  if (parsed.language) $('language').value = parsed.language;
  if (parsed.color) $('color').value = parsed.color;
  if (parsed.products) $('products').value = parsed.products;
  if (parsed.platforms?.length) {
    Array.from($('platforms').options).forEach(opt => {
      opt.selected = parsed.platforms.includes(opt.value);
    });
  }
}

function normalizeUrls(text) {
  return [...new Set(String(text || '').split(/\r?\n|,|;/).map(v => v.trim()).filter(v => /^https?:\/\//i.test(v)))];
}

function colorHex(name) {
  const map = { red:'#dc3247', orange:'#f39c12', yellow:'#f1c40f', green:'#2ecc71', blue:'#3498db', purple:'#9b59b6', pink:'#e87ea4', brown:'#8d6e63', black:'#2d2d2d', white:'#ecf0f1', gray:'#95a5a6', unknown:'#7f8c8d' };
  return map[name] || map.unknown;
}

function updateSummary(results) {
  const grid = $('summaryGrid');
  if (!results.length) { grid.innerHTML = ''; return; }
  const countBy = key => results.reduce((acc, item) => {
    const value = item[key] || 'unknown';
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
  const topEntry = obj => Object.entries(obj).sort((a,b)=>b[1]-a[1])[0]?.[0] || '-';
  const avgScore = Math.round(results.reduce((sum, item) => sum + (item.score || 0), 0) / results.length);
  const summary = [
    { label: '總結果', value: results.length },
    { label: '主要平台', value: topEntry(countBy('platform')) },
    { label: '最多語言', value: topEntry(countBy('detectedLanguage')) },
    { label: '最多主色', value: topEntry(countBy('dominantColorName')) },
    { label: '平均分數', value: avgScore }
  ];
  grid.innerHTML = summary.map(item => `<div class="summary-card"><div class="label">${escapeHtml(item.label)}</div><div class="value">${escapeHtml(String(item.value))}</div></div>`).join('');
}

function renderResults(results) {
  const container = $('resultsContainer');
  if (!results.length) {
    container.classList.add('empty');
    container.textContent = '未有結果';
    return;
  }
  container.classList.remove('empty');
  container.innerHTML = results.map(item => `
    <article class="result-card">
      <div>
        ${item.thumbnailUrl ? `<img src="${escapeAttr(item.thumbnailUrl)}" alt="thumbnail" loading="lazy" />` : `<div class="no-thumb">沒有縮圖</div>`}
      </div>
      <div>
        <h3>${escapeHtml(item.title || '未命名影片')}</h3>
        <div class="meta-row">
          <span class="chip">${escapeHtml(item.platform || 'Other')}</span>
          <span class="chip">${escapeHtml(item.detectedLanguage || 'unknown')}</span>
          <span class="chip"><span class="color-dot" style="background:${colorHex(item.dominantColorName)}"></span>${escapeHtml(item.dominantColorName || 'unknown')}</span>
          <span class="chip">分數 ${escapeHtml(String(item.score || 0))}</span>
        </div>
        <div class="chips" style="margin-top:8px;">
          ${(item.matchedProducts || []).map(v => `<span class="chip">${escapeHtml(v)}</span>`).join('')}
        </div>
        <p>${escapeHtml(item.intro || item.description || item.snippet || '沒有簡介')}</p>
        <div class="reason-list">
          ${(item.matchReasons || []).map(v => `<span class="chip">${escapeHtml(v)}</span>`).join('')}
        </div>
        <div class="result-actions" style="margin-top:12px;">
          <a href="${escapeAttr(item.url)}" target="_blank" rel="noopener noreferrer">打開頁面</a>
          <button onclick="copyText('${jsSafe(item.url)}')">複製網址</button>
        </div>
      </div>
    </article>
  `).join('');
}

async function copyText(value) {
  try { await navigator.clipboard.writeText(value); alert('已複製'); }
  catch { alert('複製失敗'); }
}
window.copyText = copyText;

function downloadFile(filename, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function toCsv(results) {
  const headers = ['platform','url','title','language','color','score','matchedProducts','matchReasons','intro'];
  const rows = results.map(item => [
    item.platform, item.url, item.title, item.detectedLanguage, item.dominantColorName, item.score,
    (item.matchedProducts || []).join('|'), (item.matchReasons || []).join('|'), item.intro || item.description || item.snippet || ''
  ]);
  return [headers, ...rows].map(row => row.map(cell => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(',')).join('\n');
}

function exportHtmlReport() {
  if (!state.results.length) { alert('未有結果'); return; }
  const cards = state.results.map(item => `
    <div style="border:1px solid #ddd;border-radius:16px;padding:16px;margin-bottom:14px;font-family:Arial,sans-serif;">
      <h3 style="margin:0 0 8px;">${escapeHtml(item.title || '未命名影片')}</h3>
      <p><strong>平台：</strong>${escapeHtml(item.platform)} | <strong>語言：</strong>${escapeHtml(item.detectedLanguage)} | <strong>主色：</strong>${escapeHtml(item.dominantColorName)} | <strong>分數：</strong>${escapeHtml(String(item.score || 0))}</p>
      <p><strong>網址：</strong><a href="${escapeAttr(item.url)}">${escapeHtml(item.url)}</a></p>
      <p><strong>原因：</strong>${escapeHtml((item.matchReasons || []).join(' / '))}</p>
      <p>${escapeHtml(item.intro || item.description || item.snippet || '')}</p>
    </div>
  `).join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>影片搜尋報告</title></head><body><h1>影片搜尋報告</h1>${cards}</body></html>`;
  downloadFile('video-report.html', html, 'text/html;charset=utf-8');
}

async function postJson(url, payload) {
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(data.error || `HTTP ${resp.status}`);
  return data;
}

function commonPayload() {
  return {
    query: $('query').value.trim(),
    platforms: getSelectedValues($('platforms')),
    language: $('language').value,
    color: $('color').value,
    products: $('products').value,
    maxResults: Number($('maxResults').value || 15),
    strictMode: $('strictMode').checked,
    youtubeApiKey: $('youtubeApiKey').value.trim()
  };
}

async function runYoutubeSearch() {
  applyNaturalLanguage();
  const payload = commonPayload();
  if (!payload.query) { alert('請先輸入主題關鍵字'); return; }
  setStatus('YouTube 搜尋中...');
  try {
    const data = await postJson('/api/youtube-search', payload);
    state.results = data.results || [];
    renderResults(state.results);
    updateSummary(state.results);
    setDebug(data.debug || {});
    setStatus(`完成，共 ${state.results.length} 個結果`);
  } catch (err) {
    setStatus('YouTube 搜尋失敗');
    setDebug({ error: err.message || String(err) });
    alert(`YouTube 搜尋失敗：${err.message || err}`);
  }
}

async function analyzeUrls() {
  applyNaturalLanguage();
  const urls = normalizeUrls($('urlList').value);
  if (!urls.length) { alert('請先貼上網址'); return; }
  const payload = { ...commonPayload(), urls };
  setStatus('分析網址中...');
  try {
    const data = await postJson('/api/analyze', payload);
    state.results = data.results || [];
    renderResults(state.results);
    updateSummary(state.results);
    setDebug(data.debug || {});
    setStatus(`完成，共 ${state.results.length} 個結果`);
  } catch (err) {
    setStatus('分析失敗');
    setDebug({ error: err.message || String(err) });
    alert(`分析失敗：${err.message || err}`);
  }
}

function loadSample() {
  $('urlList').value = [
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://www.instagram.com/reel/C5k0Example1/',
    'https://www.tiktok.com/@example/video/7350000000000000000'
  ].join('\n');
}

$('applyNaturalBtn').addEventListener('click', applyNaturalLanguage);
$('youtubeSearchBtn').addEventListener('click', runYoutubeSearch);
$('analyzeBtn').addEventListener('click', analyzeUrls);
$('sampleBtn').addEventListener('click', loadSample);
$('exportCsvBtn').addEventListener('click', () => {
  if (!state.results.length) return alert('未有結果');
  downloadFile('video-results.csv', toCsv(state.results), 'text/csv;charset=utf-8');
});
$('exportJsonBtn').addEventListener('click', () => {
  if (!state.results.length) return alert('未有結果');
  downloadFile('video-results.json', JSON.stringify(state.results, null, 2), 'application/json;charset=utf-8');
});
$('exportHtmlBtn').addEventListener('click', exportHtmlReport);
