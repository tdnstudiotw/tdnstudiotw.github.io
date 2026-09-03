(() => {
  // ⚠️ 部署地震報告 Cloudflare Worker 後，把網址填到這裡（不含路徑）
  const WORKER_URL = 'https://report.tdntech.de5.net';
  const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 分鐘自動更新
  const DATA_SOURCE = '交通部中央氣象署';

  // ----- 主題與選單（與網站其他頁面一致） -----
  const root = document.documentElement;
  const themeToggle = document.querySelector('[data-theme-toggle]');
  const menuToggle = document.querySelector('[data-menu-toggle]');
  const mobileMenu = document.querySelector('[data-mobile-menu]');
  const themeColor = document.querySelector('meta[name="theme-color"]');

  const updateThemeButton = () => {
    const isDark = root.dataset.theme === 'dark';
    if (themeToggle) {
      themeToggle.setAttribute('aria-pressed', String(isDark));
      themeToggle.setAttribute('aria-label', isDark ? '切換淺色模式' : '切換深色模式');
    }
    if (themeColor) themeColor.setAttribute('content', isDark ? '#111111' : '#fffaf5');
  };

  themeToggle?.addEventListener('click', () => {
    const nextTheme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    root.dataset.theme = nextTheme;
    localStorage.setItem('site-theme', nextTheme);
    updateThemeButton();
  });

  menuToggle?.addEventListener('click', () => {
    const isOpen = mobileMenu?.classList.toggle('is-open');
    menuToggle.classList.toggle('is-open', isOpen);
    menuToggle.setAttribute('aria-expanded', String(Boolean(isOpen)));
  });

  mobileMenu?.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      mobileMenu.classList.remove('is-open');
      menuToggle?.classList.remove('is-open');
      menuToggle?.setAttribute('aria-expanded', 'false');
    });
  });

  document.querySelectorAll('.footer-bottom span:first-child').forEach((node) => {
    node.textContent = '© ' + new Date().getFullYear() + ' TDN Studio';
  });

  // ----- 圖示 -----
  const PIN_SVG = '<svg class="eq-pin" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z"/></svg>';
  const CHEVRON_SVG = '<svg class="eq-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  // ----- DOM -----
  const listEl = document.getElementById('eq-list');
  const banner = document.getElementById('eq-banner');
  const statusTitle = document.getElementById('eq-title');
  const statusSub = document.getElementById('eq-sub');
  const metaIssue = document.getElementById('eq-issue');
  const metaFetched = document.getElementById('eq-fetched');
  const errorPanel = document.getElementById('eq-error');
  const errorMessage = document.getElementById('eq-error-message');
  const refreshBtn = document.getElementById('eq-refresh-btn');
  const retryBtn = document.getElementById('eq-retry-btn');

  // 展開／頁籤／檢視／搜尋的狀態（以地震 key 為單位，跨自動更新保留）
  const ui = { openKey: null, tab: {}, view: {}, query: {} };
  let currentByKey = {};
  let lastLoadAt = 0;

  const setBanner = (state, title, sub) => {
    banner.classList.remove('is-loading', 'is-none', 'is-partial', 'is-error');
    banner.classList.add('is-' + state);
    statusTitle.textContent = title;
    statusSub.textContent = sub;
  };

  const showError = (message) => {
    setBanner('error', '資料暫時無法取得', '請稍後再試，或直接前往中央氣象署查詢');
    errorMessage.textContent = message;
    errorPanel.hidden = false;
    listEl.innerHTML = '';
  };

  // ----- 基本工具 -----
  const esc = (v) =>
    String(v == null ? '' : v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const fmtDateTime = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('zh-TW', { hour12: false, timeZone: 'Asia/Taipei' });
  };

  // CWA 時間格式（保留 +08:00）
  const fmtIso = (iso) => (iso ? String(iso).replace('T', ' ') : '—');
  const fmtMag = (v) => (v == null ? '—' : String(v));
  const fmtDepth = (v) => (v == null ? '—' : v + ' 公里');
  const fmtDist = (v) => (v == null ? '—' : Number(v).toFixed(1) + ' 公里');

  const keyOf = (e) => e.type + ':' + (e.originTime || 'x');

  // 震度文字轉排序數值（5弱=51、5強=52 …）
  const intKey = (text) => {
    const level = Number.parseInt(String(text), 10);
    if (!Number.isFinite(level)) return -1;
    const s = String(text);
    let bonus = 0;
    if (s.indexOf('強') !== -1) bonus = 2;
    else if (s.indexOf('弱') !== -1) bonus = 1;
    return level * 10 + bonus;
  };

  const intMeta = (text) => {
    const s = String(text || '').trim();
    const level = Number.parseInt(s, 10);
    if (!Number.isFinite(level) || level <= 0) {
      return { bg: 'var(--surface-soft)', fg: 'var(--text-soft)' };
    }
    let bg;
    let fg = '#ffffff';
    if (level >= 7) bg = '#7c3aed';
    else if (level === 6) bg = s.indexOf('強') !== -1 ? '#b91c1c' : '#dc2626';
    else if (level === 5) bg = s.indexOf('強') !== -1 ? '#ea580c' : '#f97316';
    else if (level === 4) {
      bg = '#ffc400';
      fg = '#3a2b00';
    } else if (level === 3) bg = '#1e3a8a';
    else if (level === 2) bg = '#4a90d9';
    else {
      bg = '#c9e6f7';
      fg = '#14507a';
    }
    return { bg, fg };
  };

  const chipStyle = (text) => {
    const m = intMeta(text);
    return 'style="background:' + m.bg + ';color:' + m.fg + '"';
  };

  const geoText = (e) => {
    const ep = e && e.epicenter;
    if (!ep || (ep.lat == null && ep.lon == null)) return '—';
    const parts = [];
    if (ep.lat != null) {
      parts.push((ep.lat >= 0 ? '北緯 ' : '南緯 ') + Math.abs(ep.lat).toFixed(2) + '°');
    }
    if (ep.lon != null) {
      parts.push((ep.lon >= 0 ? '東經 ' : '西經 ') + Math.abs(ep.lon).toFixed(2) + '°');
    }
    return parts.join('、');
  };

  const cardTitle = (e) => {
    if (e.type === 'regional') return '小區域有感地震';
    return e.id ? '編號 ' + e.id : '顯著有感地震';
  };

  const sortStations = (list) => {
    const arr = list.slice();
    arr.sort((a, b) => {
      const ka = intKey(a.intensity);
      const kb = intKey(b.intensity);
      if (kb !== ka) return kb - ka;
      const da = a.dist == null ? 1e9 : a.dist;
      const db = b.dist == null ? 1e9 : b.dist;
      if (da !== db) return da - db;
      return String(a.name).localeCompare(String(b.name), 'zh-Hant');
    });
    return arr;
  };

  const matches = (st, q) => {
    if (!q) return true;
    const hay = String(st.name + ' ' + st.county).toLowerCase();
    return hay.indexOf(q) !== -1;
  };

  const maxOf = (list) => {
    let m = null;
    let mk = -1;
    for (const s of list) {
      const k = intKey(s.intensity);
      if (k > mk) {
        mk = k;
        m = s.intensity;
      }
    }
    return m || '';
  };

  const findData = (key) => currentByKey[key] || null;

  // ----- 卡片 -----
  const cardHtml = (e) => {
    const key = keyOf(e);
    const loc = (e.epicenter && e.epicenter.location) || e.content || '—';
    const badge = intMeta(e.maxIntensity);
    const mag = e.magnitude == null ? '—' : 'M' + e.magnitude;
    const lines = [];
    lines.push('<article class="eq-card" data-key="' + esc(key) + '" data-type="' + e.type + '">');
    lines.push('<div class="eq-card-head">');
    lines.push('<div class="eq-badge" style="background:' + badge.bg + ';color:' + badge.fg + '"><span>最大</span><strong>' + esc(e.maxIntensity || '—') + '</strong></div>');
    lines.push('<div class="eq-card-main">');
    lines.push('<div class="eq-card-line1"><h3 class="eq-card-title">' + esc(cardTitle(e)) + '</h3><time class="eq-card-time">' + esc(fmtIso(e.originTime)) + '</time></div>');
    lines.push('<p class="eq-card-loc">' + PIN_SVG + '<span>' + esc(loc) + '</span></p>');
    lines.push('</div>');
    lines.push('<dl class="eq-card-stats">');
    lines.push('<div class="eq-stat"><dt>芮氏規模</dt><dd>' + esc(mag) + '</dd></div>');
    lines.push('<div class="eq-stat"><dt>震源深度</dt><dd>' + esc(fmtDepth(e.depth)) + '</dd></div>');
    lines.push('</dl>');
    lines.push('<div class="eq-card-actions">');
    lines.push('<button type="button" class="eq-share" data-share="' + esc(key) + '">分享連結</button>');
    lines.push('<button type="button" class="eq-expand" aria-expanded="false" aria-label="展開詳細資料" data-expand="' + esc(key) + '">' + CHEVRON_SVG + '</button>');
    lines.push('</div>');
    lines.push('</div>');
    lines.push('<div class="eq-detail" hidden></div>');
    lines.push('</article>');
    return lines.join('');
  };

  // ----- 詳細內容 -----
  const stationRowHtml = (st, hasWaveCol) => {
    const cells = [];
    cells.push('<td class="eq-st-name">' + esc(st.name || '—') + '</td>');
    cells.push('<td class="eq-st-county">' + esc(st.county || '—') + '</td>');
    cells.push('<td class="eq-st-int"><span class="eq-chip" ' + chipStyle(st.intensity) + '>' + esc(st.intensity || '—') + '</span></td>');
    cells.push('<td class="eq-st-dist">' + esc(fmtDist(st.dist)) + '</td>');
    if (hasWaveCol) {
      cells.push('<td class="eq-st-wave">' + waveCellHtml(st) + '</td>');
    }
    return '<tr>' + cells.join('') + '</tr>';
  };

  const waveCellHtml = (st) => {
    if (!st.waveUrl) return '<span class="eq-wave is-none">—</span>';
    return '<a class="eq-wave" href="' + esc(st.waveUrl) + '" target="_blank" rel="noreferrer" referrerpolicy="no-referrer">波形 ↗</a>';
  };

  const tableHtml = (e, q) => {
    const hasWaveCol = e.type === 'notable';
    const cols = hasWaveCol ? 5 : 4;
    const list = sortStations(e.stations || []).filter((st) => matches(st, q));
    let html = '<table class="eq-table"><thead><tr><th scope="col">測站</th><th scope="col">縣市</th><th scope="col">震度</th><th scope="col">震央距</th>';
    if (hasWaveCol) html += '<th scope="col">波形記錄</th>';
    html += '</tr></thead><tbody>';
    if (!list.length) {
      const msg = q ? '查無符合的測站或縣市' : '尚無測站資料';
      html += '<tr><td colspan="' + cols + '" class="eq-empty">' + msg + '</td></tr>';
    } else {
      for (const st of list) html += stationRowHtml(st, hasWaveCol);
    }
    html += '</tbody></table>';
    return html;
  };

  const groupHtml = (e, q) => {
    const hasWaveCol = e.type === 'notable';
    const all = sortStations(e.stations || []).filter((st) => matches(st, q));
    if (!all.length) {
      const msg = q ? '查無符合的測站或縣市' : '尚無測站資料';
      return '<p class="eq-empty">' + msg + '</p>';
    }
    const byCounty = {};
    for (const st of all) {
      const c = st.county || '其他';
      if (!byCounty[c]) byCounty[c] = [];
      byCounty[c].push(st);
    }
    const counties = Object.keys(byCounty).sort((a, b) => intKey(maxOf(byCounty[b])) - intKey(maxOf(byCounty[a])));
    let html = '';
    for (const c of counties) {
      const sts = byCounty[c];
      const cm = maxOf(sts);
      html += '<section class="eq-group">';
      html += '<header class="eq-group-head"><span class="eq-chip" ' + chipStyle(cm) + '>' + esc(cm || '—') + '</span><h5>' + esc(c) + '</h5><span class="eq-group-count">' + sts.length + ' 個測站</span></header>';
      html += '<ul class="eq-group-list">';
      for (const st of sts) {
        html += '<li><span class="eq-g-name">' + esc(st.name || '—') + '</span><span class="eq-g-chip"><span class="eq-chip" ' + chipStyle(st.intensity) + '>' + esc(st.intensity || '—') + '</span></span><span class="eq-g-dist">' + esc(fmtDist(st.dist)) + '</span>';
        if (hasWaveCol && st.waveUrl) html += '<a class="eq-g-wave" href="' + esc(st.waveUrl) + '" target="_blank" rel="noreferrer" referrerpolicy="no-referrer">波形 ↗</a>';
        html += '</li>';
      }
      html += '</ul></section>';
    }
    return html;
  };

  const metaHtml = (e) => {
    const html = [];
    html.push('<dl class="eq-report-meta">');
    html.push('<div><dt>發表時間</dt><dd>' + esc(fmtIso(e.issueTime)) + '</dd></div>');
    html.push('<div><dt>震央經緯度</dt><dd>' + esc(geoText(e)) + '</dd></div>');
    html.push('<div><dt>發震位置</dt><dd>' + esc((e.epicenter && e.epicenter.location) || '—') + '</dd></div>');
    html.push('<div><dt>資料來源</dt><dd>' + esc(DATA_SOURCE) + '</dd></div>');
    html.push('</dl>');
    return html.join('');
  };

  const imagePanelHtml = (src, alt, fallback) => {
    if (!src) return '<p class="eq-empty">' + fallback + '</p>';
    return '<img class="eq-bigimg" src="' + esc(src) + '" alt="' + esc(alt) + '" loading="lazy" referrerpolicy="no-referrer" />';
  };

  const detailHtml = (e) => {
    const key = keyOf(e);
    const count = e.stationCount || (e.stations || []).length;
    const hasWaveCol = e.type === 'notable';
    const html = [];

    html.push('<div class="eq-detail-grid">');

    // 左側頁籤
    html.push('<aside class="eq-tabbar">');
    html.push('<div class="eq-tabs" role="tablist" aria-label="地震詳細資料">');
    html.push('<button type="button" class="eq-tab is-active" role="tab" aria-selected="true" data-tab="intensity" data-key="' + esc(key) + '">各地震度</button>');
    html.push('<button type="button" class="eq-tab" role="tab" aria-selected="false" data-tab="report" data-key="' + esc(key) + '">地震報告圖</button>');
    if (e.shakemap) html.push('<button type="button" class="eq-tab" role="tab" aria-selected="false" data-tab="shakemap" data-key="' + esc(key) + '">震度分布圖</button>');
    html.push('<button type="button" class="eq-tab" role="tab" aria-selected="false" data-tab="link" data-key="' + esc(key) + '">外部連結</button>');
    html.push('</div>');
    html.push('<button type="button" class="eq-copy" data-copy="' + esc(key) + '">複製此報告連結</button>');
    html.push('</aside>');

    html.push('<div class="eq-panel">');

    // 各地震度
    html.push('<div class="eq-tabpanel is-active" data-panel="intensity">');
    html.push('<div class="eq-panel-head">');
    html.push('<h4>各地震度與觀測站資料（<strong>' + count + '</strong> 個測站）</h4>');
    html.push('<div class="eq-panel-tools">');
    html.push('<input type="search" class="eq-search" placeholder="搜尋測站或縣市…" aria-label="搜尋測站或縣市" data-key="' + esc(key) + '" />');
    html.push('<div class="eq-viewtoggle" role="group" aria-label="檢視方式">');
    html.push('<button type="button" class="is-active" data-view="table" data-key="' + esc(key) + '">表格</button>');
    html.push('<button type="button" data-view="group" data-key="' + esc(key) + '">分組</button>');
    html.push('</div>');
    html.push('</div>');
    html.push('</div>');
    html.push('<div class="eq-view" data-viewbody="table">' + tableHtml(e, '') + '</div>');
    html.push('<div class="eq-view" data-viewbody="group" hidden>' + groupHtml(e, '') + '</div>');
    html.push(metaHtml(e));
    html.push('</div>');

    // 地震報告圖
    html.push('<div class="eq-tabpanel" data-panel="report" hidden>');
    html.push('<div class="eq-panel-head"><h4>地震報告圖</h4></div>');
    html.push(imagePanelHtml(e.image, '地震報告圖', '此筆地震沒有地震報告圖。'));
    if (e.content) html.push('<p class="eq-content">' + esc(e.content) + '</p>');
    html.push('</div>');

    // 震度分布圖（僅顯著有感）
    html.push('<div class="eq-tabpanel" data-panel="shakemap" hidden>');
    html.push('<div class="eq-panel-head"><h4>震度分布圖</h4></div>');
    html.push(imagePanelHtml(e.shakemap, '震度分布圖', '此筆地震沒有震度分布圖。'));
    html.push('</div>');

    // 外部連結
    html.push('<div class="eq-tabpanel" data-panel="link" hidden>');
    html.push('<div class="eq-panel-head"><h4>外部連結</h4></div>');
    html.push('<div class="eq-linkpanel">');
    if (e.web) {
      html.push('<a class="button button-primary" href="' + esc(e.web) + '" target="_blank" rel="noreferrer">前往中央氣象署查看詳細報告 ↗</a>');
    } else {
      html.push('<p class="eq-empty">此筆地震沒有外部連結。</p>');
    }
    if (e.content) html.push('<p class="eq-content">' + esc(e.content) + '</p>');
    html.push('</div>');
    html.push('</div>');

    html.push('</div>');
    html.push('</div>');
    return html.join('');
  };

  // ----- 卡片展開／收合 -----
  const openCard = (card) => {
    const key = card.getAttribute('data-key');
    const detail = card.querySelector('.eq-detail');
    const e = findData(key);
    if (e && !detail.innerHTML) detail.innerHTML = detailHtml(e);
    detail.hidden = false;
    card.classList.add('is-open');
    const expandBtn = card.querySelector('.eq-expand');
    if (expandBtn) expandBtn.setAttribute('aria-expanded', 'true');
    applyStateTo(card, key);
    ui.openKey = key;
  };

  const closeCard = (card) => {
    const detail = card.querySelector('.eq-detail');
    if (detail) detail.hidden = true;
    card.classList.remove('is-open');
    const expandBtn = card.querySelector('.eq-expand');
    if (expandBtn) expandBtn.setAttribute('aria-expanded', 'false');
    if (ui.openKey === card.getAttribute('data-key')) ui.openKey = null;
  };

  const toggleCard = (card) => {
    const detail = card.querySelector('.eq-detail');
    if (detail && !detail.hidden) closeCard(card);
    else openCard(card);
  };

  const setTab = (card, key, tab) => {
    card.querySelectorAll('.eq-tab').forEach((b) => {
      const on = b.getAttribute('data-tab') === tab;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    card.querySelectorAll('.eq-tabpanel').forEach((p) => {
      const on = p.getAttribute('data-panel') === tab;
      p.hidden = !on;
      p.classList.toggle('is-active', on);
    });
    ui.tab[key] = tab;
  };

  const setView = (card, key, view) => {
    card.querySelectorAll('.eq-viewtoggle button').forEach((b) => {
      b.classList.toggle('is-active', b.getAttribute('data-view') === view);
    });
    const tableBody = card.querySelector('[data-viewbody="table"]');
    const groupBody = card.querySelector('[data-viewbody="group"]');
    if (tableBody) tableBody.hidden = view !== 'table';
    if (groupBody) groupBody.hidden = view !== 'group';
    ui.view[key] = view;
  };

  const applySearch = (card, key, q) => {
    const e = findData(key);
    if (!e) return;
    ui.query[key] = q;
    const tableBody = card.querySelector('[data-viewbody="table"]');
    const groupBody = card.querySelector('[data-viewbody="group"]');
    if (tableBody) tableBody.innerHTML = tableHtml(e, q);
    if (groupBody) groupBody.innerHTML = groupHtml(e, q);
  };

  const applyStateTo = (card, key) => {
    const tab = ui.tab[key] || 'intensity';
    const view = ui.view[key] || 'table';
    const query = ui.query[key] || '';
    const input = card.querySelector('.eq-search');
    if (input) input.value = query;
    setTab(card, key, tab);
    setView(card, key, view);
    if (query) applySearch(card, key, query);
  };

  // ----- 分享／複製連結 -----
  const reportUrl = (key) => {
    const base = location.href.split('#')[0];
    return base + '#eq=' + encodeURIComponent(key);
  };

  const flashButton = (btn, text) => {
    const old = btn.textContent;
    btn.textContent = text;
    clearTimeout(btn._flashTimer);
    btn._flashTimer = setTimeout(() => {
      btn.textContent = old;
    }, 1400);
  };

  const legacyCopy = (text) => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch (err) {
      ok = false;
    }
    document.body.removeChild(ta);
    return ok;
  };

  const copyTextToClipboard = (text) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).catch(() => {
        legacyCopy(text);
      });
    }
    return Promise.resolve(legacyCopy(text));
  };

  const shareLink = (btn, key) => {
    copyTextToClipboard(reportUrl(key)).then(
      () => flashButton(btn, '已複製！'),
      () => flashButton(btn, '複製失敗'),
    );
  };

  // ----- 事件委派 -----
  listEl.addEventListener('click', (ev) => {
    const card = ev.target.closest('.eq-card');
    if (!card) return;
    const key = card.getAttribute('data-key');
    const shareBtn = ev.target.closest('[data-share]');
    if (shareBtn) {
      shareLink(shareBtn, key);
      return;
    }
    const expandBtn = ev.target.closest('[data-expand]');
    if (expandBtn) {
      toggleCard(card);
      return;
    }
    const copyBtn = ev.target.closest('[data-copy]');
    if (copyBtn) {
      shareLink(copyBtn, key);
      return;
    }
    const tabBtn = ev.target.closest('[data-tab]');
    if (tabBtn) {
      setTab(card, key, tabBtn.getAttribute('data-tab'));
      return;
    }
    const viewBtn = ev.target.closest('[data-view]');
    if (viewBtn) {
      setView(card, key, viewBtn.getAttribute('data-view'));
      return;
    }
    if (ev.target.closest('.eq-detail')) return; // 詳細區內其它互動（連結、輸入框）不觸發收合
    if (ev.target.closest('a')) return;
    toggleCard(card);
  });

  listEl.addEventListener('input', (ev) => {
    const input = ev.target.closest('.eq-search');
    if (!input) return;
    const key = input.getAttribute('data-key');
    const card = input.closest('.eq-card');
    if (card) applySearch(card, key, input.value.toLowerCase());
  });

  // ----- 渲染 -----
  const mergedOf = (data) => {
    const merged = [];
    (Array.isArray(data.notable) ? data.notable : []).forEach((e) => merged.push(e));
    (Array.isArray(data.regional) ? data.regional : []).forEach((e) => merged.push(e));
    merged.sort((a, b) => String(b.originTime || '').localeCompare(String(a.originTime || '')));
    return merged;
  };

  const render = (data) => {
    metaFetched.textContent = fmtDateTime(data.fetchedAt);
    errorPanel.hidden = true;
    const merged = mergedOf(data);
    currentByKey = {};
    merged.forEach((e) => {
      currentByKey[keyOf(e)] = e;
    });
    const html = [];
    for (const e of merged) html.push(cardHtml(e));
    listEl.innerHTML = html.join('');

    const top = merged[0] || null;
    metaIssue.textContent = top ? fmtDateTime(top.issueTime || top.originTime) : '—';
    if (!merged.length) {
      listEl.innerHTML = '<p class="eq-empty-list">目前沒有地震報告</p>';
      setBanner('none', '目前沒有地震報告', '中央氣象署暫無顯著有感或小區域有感地震報告');
      return;
    }
    const loc = (top.epicenter && top.epicenter.location) || '';
    setBanner(
      'partial',
      '最新地震報告已更新',
      top ? cardTitle(top) + '：規模 ' + (top.magnitude == null ? '—' : top.magnitude) + (loc ? '、' + loc : '') : '已取得最新地震報告',
    );

    // 展開原本開啟的卡片（自動更新後保留狀態）
    if (ui.openKey) {
      const card = listEl.querySelector('[data-key="' + ui.openKey + '"]');
      if (card) openCard(card);
    }
  };

  // ----- 深層連結：開啟 #eq=type:id 對應的地震 -----
  const openFromHash = () => {
    const h = location.hash || '';
    if (h.indexOf('#eq=') !== 0) return;
    const key = decodeURIComponent(h.slice(4));
    const card = listEl.querySelector('[data-key="' + key + '"]');
    if (!card) return;
    openCard(card);
    card.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // ----- 載入 -----
  const load = async () => {
    setBanner('loading', '載入中…', '正在向中央氣象署取得最新地震報告');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const res = await fetch(WORKER_URL, { signal: controller.signal });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || '未知錯誤');
      render(data);
      lastLoadAt = Date.now();
    } catch (error) {
      showError(error.name === 'AbortError' ? '連線逾時，請再試一次。' : error.message);
    } finally {
      clearTimeout(timer);
    }
  };

  refreshBtn?.addEventListener('click', load);
  retryBtn?.addEventListener('click', load);
  window.addEventListener('hashchange', openFromHash);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && Date.now() - lastLoadAt > REFRESH_INTERVAL_MS) load();
  });

  load();
  setInterval(load, REFRESH_INTERVAL_MS);
  setTimeout(openFromHash, 50);
  updateThemeButton();
})();
