(() => {
  // ⚠️ 部署 Cloudflare Worker 後，把網址填到這裡
  const WORKER_URL = 'https://suspension.tdntw.cc.cd';
  const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 分鐘自動更新

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
    node.textContent = `© ${new Date().getFullYear()} TDN Studio`;
  });

  // ----- 停班停課資料 -----
  const banner = document.getElementById('status-banner');
  const statusTitle = document.getElementById('status-title');
  const statusSub = document.getElementById('status-sub');
  const metaDate = document.getElementById('meta-date');
  const metaUpdated = document.getElementById('meta-updated');
  const metaFetched = document.getElementById('meta-fetched');
  const cityList = document.getElementById('city-list');
  const errorPanel = document.getElementById('error-panel');
  const errorMessage = document.getElementById('error-message');
  const refreshBtn = document.getElementById('refresh-btn');
  const retryBtn = document.getElementById('retry-btn');

  const setBanner = (state, title, sub) => {
    banner.classList.remove('is-loading', 'is-none', 'is-partial', 'is-error');
    banner.classList.add(`is-${state}`);
    statusTitle.textContent = title;
    statusSub.textContent = sub;
  };

  const showError = (message) => {
    setBanner('error', '資料暫時無法取得', '請稍後再試，或直接前往人事行政總處查詢');
    errorMessage.textContent = message;
    errorPanel.hidden = false;
    cityList.hidden = true;
  };

  const escapeHtml = (text) =>
    text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const splitItem = (item) => {
    const sepIndex = item.indexOf('：') !== -1 ? item.indexOf('：') : item.indexOf(':');
    if (sepIndex === -1) return { place: '', status: item };
    return { place: item.slice(0, sepIndex).trim(), status: item.slice(sepIndex + 1).trim() };
  };

  const classify = (status) =>
    status.includes('停止上班') || status.includes('停止上課') ? 'stop' : 'normal';

  const render = (data) => {
    metaDate.textContent = data.dateText || '—';
    metaUpdated.textContent = data.updatedAt || '—';
    metaFetched.textContent = data.fetchedAt
      ? new Date(data.fetchedAt).toLocaleString('zh-TW', { hour12: false })
      : '—';
    errorPanel.hidden = true;

    if (!data.hasAnnouncement) {
      setBanner('none', '目前無停班停課訊息', '全台照常上班、照常上課');
      cityList.hidden = true;
      return;
    }

    const stopCount = data.cities.filter((city) =>
      city.items.some((item) => item.includes('停止上班') || item.includes('停止上課')),
    ).length;
    setBanner('partial', `有 ${stopCount} 個縣市發布停班停課公告`, '點擊下方縣市卡片查看詳細內容');

    cityList.hidden = false;
    cityList.innerHTML = data.cities
      .map(
        (city) => `
        <article class="city-card">
          <h3 class="city-name">${escapeHtml(city.city)}</h3>
          <ul class="city-items">
            ${city.items
              .map((item) => {
                const { place, status } = splitItem(item);
                return `<li class="item ${classify(status)}"><span class="item-place">${escapeHtml(place)}</span><span class="item-status">${escapeHtml(status)}</span></li>`;
              })
              .join('')}
          </ul>
        </article>`,
      )
      .join('');
  };

  const load = async () => {
    setBanner('loading', '載入中…', '正在向人事行政總處取得最新公告');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const res = await fetch(WORKER_URL, { signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || '未知錯誤');
      render(data);
    } catch (error) {
      showError(error.name === 'AbortError' ? '連線逾時，請再試一次。' : error.message);
    } finally {
      clearTimeout(timer);
    }
  };

  refreshBtn?.addEventListener('click', load);
  retryBtn?.addEventListener('click', load);

  load();
  setInterval(load, REFRESH_INTERVAL_MS);
  updateThemeButton();
})();
