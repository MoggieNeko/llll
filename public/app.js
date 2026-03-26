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

function parseNaturalLanguage(input) {
  const text = (input || '').trim();
  if (!text) return {};
  const parsed = { query: text, platforms: ['Instagram'] };
  if (/(tiktok)/i.test(text)) parsed.platforms = ['TikTok'];
  if (/(youtube|yt)/i.test(text)) parsed.platforms = ['YouTube'];
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

  const candidateTerms = ['latte', 'grinder', 'coffee', 'beans', 'espresso', 'serum', 'skincare', 'lipstick', 'bag', 'shoe', 'camera', 'outfit'];
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

function colorHex(name) {
  const map = { red:'#dc3247', orange:'#f39c12', yellow:'#f1c40f', green:'#2ecc71', blue:'#3498db', purple:'#9b59b6', pink:'#e87ea4', brown:'#8d6e63', black:'#2d2d2d', white:'#ecf0f1', gray:'#95a5a6', unknown:'#7f8c8d' };
  return map[name] || map.unknown;
}

function confidenceLabel(value) {
  return value === 'high' ? '高可信' : value === 'medium' ? '中可信' : '低可信';
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
        <h3>${escapeHtml(item.title || '未命名內容')}</h3>
        <div class="meta-row">
          <span class="chip">${escapeHtml(item.platform || 'Other')}</span>
          <span class="chip">${escapeHtml(item.detectedLanguage || 'unknown')}</span>
          <span class="chip"><span class="color-dot" style="background:${colorHex(item.dominantColorName)}"></span>${escapeHtml(item.dominantColorName || 'unknown')}</span>
          <span class="chip">分數 ${escapeHtml(String(item.score || 0))}</span>
          <span class="chip confidence-${escapeHtml(item.confidence || 'low')}">${escapeHtml(confidenceLabel(item.confidence))}</span>
        </div>
        <div class="chips" style="margin-top:8px;">
          ${(item.matchedProducts || []).map(v => `<span class="chip">${escapeHtml(v)}</span>`).join('')}
        </div>
        <p class="muted">${escapeHtml(item.intro || item.description || item.snippet || '')}</p>
        <div class="small-note">來源：${escapeHtml(item.source || '-')} ${item.fetchStatus ? `· 補抓：${escapeHtml(item.fetchStatus)}` : ''}</div>
        <details>
          <summary>為何排前</summary>
          <ul>
            ${(item.matchReasons || []).map(v => `<li>${escapeHtml(v)}</li>`).join('') || '<li>沒有額外說明</li>'}
          </ul>
        </details>
        <div class="action-row top-gap">
          <a href="${escapeAttr(item.url)}" target="_blank" rel="noreferrer noopener" class="link-btn">打開原網址</a>
        </div>
      </div>
    </article>
  `).join('');
}

function downloadBlob(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

function exportCsv() {
  if (!state.results.length) return alert('未有結果');
  const headers = ['platform','url','title','detectedLanguage','dominantColorName','matchedProducts','score','confidence','source','intro'];
  const rows = [headers.join(',')];
  for (const item of state.results) {
    const values = headers.map(key => {
      const value = Array.isArray(item[key]) ? item[key].join('|') : (item[key] ?? '');
      return `"${String(value).replaceAll('"', '""')}"`;
    });
    rows.push(values.join(','));
  }
  downloadBlob('ig-video-analysis-v4.csv', rows.join('\n'), 'text/csv;charset=utf-8');
}

function exportJson() {
  if (!state.results.length) return alert('未有結果');
  downloadBlob('ig-video-analysis-v4.json', JSON.stringify(state.results, null, 2), 'application/json;charset=utf-8');
}

function exportHtml() {
  if (!state.results.length) return alert('未有結果');
  const html = `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><title>IG 分析報告</title><style>body{font-family:Arial,sans-serif;padding:24px;background:#f6f7fb;color:#1e293b}article{background:#fff;border:1px solid #d8e0ee;border-radius:16px;padding:18px;margin-bottom:16px}img{max-width:240px;border-radius:12px}h1{margin-top:0}.chip{display:inline-block;margin:0 6px 6px 0;padding:4px 10px;border-radius:999px;background:#eef3ff;border:1px solid #c8d8ff;font-size:12px}</style></head><body><h1>IG 影片分析報告</h1>${state.results.map(item => `<article><h2>${escapeHtml(item.title || '未命名內容')}</h2>${item.thumbnailUrl ? `<img src="${escapeAttr(item.thumbnailUrl)}" alt="thumb">` : ''}<p><a href="${escapeAttr(item.url)}">${escapeHtml(item.url)}</a></p><p>${escapeHtml(item.intro || '')}</p><div>${(item.matchReasons || []).map(r => `<span class="chip">${escapeHtml(r)}</span>`).join('')}</div></article>`).join('')}</body></html>`;
  downloadBlob('ig-video-analysis-v4.html', html, 'text/html;charset=utf-8');
}

async function runAnalyze() {
  const collectorText = $('collectorText').value.trim();
  if (!collectorText) {
    alert('請先貼上收集器 JSON 或網址清單');
    return;
  }

  const payload = {
    collectorText,
    query: $('query').value.trim(),
    language: $('language').value,
    color: $('color').value,
    products: $('products').value.trim(),
    strictMode: $('strictMode').checked,
    forceFetch: $('forceFetch').checked,
    platforms: getSelectedValues($('platforms'))
  };

  setStatus('分析中...');
  setDebug('requesting /api/analyze');

  try {
    const resp = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || '分析失敗');
    state.results = data.results || [];
    setStatus(`完成：${state.results.length} 筆結果`);
    setDebug(data.debug || {});
    updateSummary(state.results);
    renderResults(state.results);
    localStorage.setItem('igFinderV4:lastCollectorText', collectorText);
    localStorage.setItem('igFinderV4:lastFilters', JSON.stringify(payload));
  } catch (error) {
    setStatus('失敗');
    setDebug(String(error?.message || error));
    alert(`分析失敗：${error?.message || error}`);
  }
}

function loadSamples() {
  const sample = [
    {
      url: 'https://www.instagram.com/reel/sample-coffee-1/',
      platform: 'Instagram',
      title: 'Blue latte art coffee setup',
      caption: 'English coffee reel with latte art, grinder, espresso setup and blue background props.',
      thumbnailUrl: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=800&q=80',
      source: '瀏覽器收集器',
      collectedAt: new Date().toISOString()
    },
    {
      url: 'https://www.instagram.com/reel/sample-fashion-2/',
      platform: 'Instagram',
      title: 'Neutral outfit styling reel',
      caption: 'Lookbook styling ideas with bag and shoes on a clean beige set.',
      thumbnailUrl: 'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=800&q=80',
      source: '瀏覽器收集器',
      collectedAt: new Date().toISOString()
    }
  ];
  $('collectorText').value = JSON.stringify(sample, null, 2);
}

function loadSampleUrls() {
  $('collectorText').value = [
    'https://www.instagram.com/reel/Cx123456789/',
    'https://www.instagram.com/p/CxABCDEFGH/'
  ].join('\n');
}

function restoreState() {
  const text = localStorage.getItem('igFinderV4:lastCollectorText');
  const rawFilters = localStorage.getItem('igFinderV4:lastFilters');
  if (text) $('collectorText').value = text;
  if (rawFilters) {
    try {
      const filters = JSON.parse(rawFilters);
      if (filters.query) $('query').value = filters.query;
      if (filters.language) $('language').value = filters.language;
      if (filters.color) $('color').value = filters.color;
      if (filters.products) $('products').value = filters.products;
      $('strictMode').checked = Boolean(filters.strictMode);
      $('forceFetch').checked = Boolean(filters.forceFetch);
      if (Array.isArray(filters.platforms)) {
        Array.from($('platforms').options).forEach(opt => { opt.selected = filters.platforms.includes(opt.value); });
      }
    } catch {}
  }
}

$('applyNaturalBtn').addEventListener('click', applyNaturalLanguage);
$('analyzeBtn').addEventListener('click', runAnalyze);
$('exportCsvBtn').addEventListener('click', exportCsv);
$('exportJsonBtn').addEventListener('click', exportJson);
$('exportHtmlBtn').addEventListener('click', exportHtml);
$('sampleCollectorBtn').addEventListener('click', loadSamples);
$('sampleUrlBtn').addEventListener('click', loadSampleUrls);
$('clearBtn').addEventListener('click', () => {
  $('collectorText').value = '';
  state.results = [];
  renderResults([]);
  updateSummary([]);
  setDebug('已清空');
  setStatus('未開始');
});

restoreState();
renderResults([]);
