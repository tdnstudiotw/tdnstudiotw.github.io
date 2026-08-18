(() => {
  const root = document.documentElement;
  const themeToggle = document.querySelector('[data-theme-toggle]');
  const menuToggle = document.querySelector('[data-menu-toggle]');
  const mobileMenu = document.querySelector('[data-mobile-menu]');
  const themeColor = document.querySelector('meta[name="theme-color"]');
  const articles = Array.isArray(window.BLOG_ARTICLES) ? window.BLOG_ARTICLES : [];
  const categories = Array.isArray(window.BLOG_CATEGORIES) ? window.BLOG_CATEGORIES : [];

  const escapeHTML = (value = '') => String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));

  const updateThemeButton = () => {
    const isDark = root.dataset.theme === 'dark';
    themeToggle?.setAttribute('aria-pressed', String(isDark));
    themeToggle?.setAttribute('aria-label', isDark ? '切換淺色模式' : '切換深色模式');
    themeColor?.setAttribute('content', isDark ? '#111111' : '#fffaf5');
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

  const params = new URLSearchParams(window.location.search);
  const state = {
    query: params.get('q') || '',
    category: params.get('category') || 'all',
    tag: params.get('tag') || 'all',
  };

  const searchInput = document.querySelector('[data-search]');
  const categorySelect = document.querySelector('[data-category-select]');
  const tagFilter = document.querySelector('[data-tag-filter]');
  const featuredSlot = document.querySelector('[data-featured-slot]');
  const postList = document.querySelector('[data-post-list]');
  const resultCount = document.querySelector('[data-result-count]');
  const emptyState = document.querySelector('[data-empty-state]');

  const allTags = [...new Set(articles.flatMap((article) => article.tags))].sort((a, b) => a.localeCompare(b, 'zh-Hant'));
  const sortedArticles = [...articles].sort((a, b) => b.date.localeCompare(a.date));

  if (searchInput) searchInput.value = state.query;
  if (categorySelect) {
    categorySelect.innerHTML = categories.map((category) => `<option value="${escapeHTML(category.key)}">${escapeHTML(category.label)}</option>`).join('');
    categorySelect.value = categories.some((category) => category.key === state.category) ? state.category : 'all';
  }
  if (tagFilter) {
    tagFilter.innerHTML = ['all', ...allTags].map((tag) => `<button type="button" data-tag="${escapeHTML(tag)}" class="${state.tag === tag ? 'active' : ''}">${tag === 'all' ? '全部標籤' : `#${escapeHTML(tag)}`}</button>`).join('');
  }

  const articleMatches = (article) => {
    const haystack = [article.title, article.excerpt, article.category, ...article.tags].join(' ').toLowerCase();
    const queryMatches = !state.query || haystack.includes(state.query.toLowerCase());
    const categoryMatches = state.category === 'all' || article.categoryKey === state.category;
    const tagMatches = state.tag === 'all' || article.tags.includes(state.tag);
    return queryMatches && categoryMatches && tagMatches;
  };

  const articleURL = (article) => `./post.html?post=${encodeURIComponent(article.id)}`;

  const renderFeatured = (visibleArticles) => {
    const featured = visibleArticles.find((article) => article.featured) || visibleArticles[0];
    if (!featuredSlot || !featured) {
      if (featuredSlot) featuredSlot.innerHTML = '';
      return;
    }
    featuredSlot.innerHTML = `<a class="featured-card" href="${articleURL(featured)}" aria-label="閱讀：${escapeHTML(featured.title)}"><div class="featured-copy"><div class="post-meta"><span class="category">${escapeHTML(featured.category)}</span><span class="meta-bullet">/</span><span>${escapeHTML(featured.dateLabel)}</span><span class="meta-bullet">/</span><span>${escapeHTML(featured.readingTime)}</span></div><h3>${escapeHTML(featured.title)}</h3><p>${escapeHTML(featured.excerpt)}</p><span class="read-link">閱讀這篇文章 <span aria-hidden="true">↗</span></span></div><div class="featured-art"><span class="art-index">${escapeHTML(featured.id)}</span><span class="art-lines"><span></span><span></span><span></span><span></span></span></div></a>`;
  };

  const renderList = (visibleArticles) => {
    if (!postList) return;
    postList.innerHTML = visibleArticles.map((article) => `<a class="post-row" href="${articleURL(article)}"><span class="post-date">${escapeHTML(article.dateLabel)}</span><span class="post-row-copy"><h3>${escapeHTML(article.title)}</h3><p>${escapeHTML(article.excerpt)}</p></span><span class="post-side"><span class="category">${escapeHTML(article.category)}</span><span class="reading-time">${escapeHTML(article.readingTime)}</span></span><span class="post-arrow" aria-hidden="true">↗</span></a>`).join('');
  };

  const syncURL = () => {
    const nextParams = new URLSearchParams();
    if (state.query) nextParams.set('q', state.query);
    if (state.category !== 'all') nextParams.set('category', state.category);
    if (state.tag !== 'all') nextParams.set('tag', state.tag);
    const nextURL = `${window.location.pathname}${nextParams.toString() ? `?${nextParams}` : ''}`;
    window.history.replaceState({}, '', nextURL);
  };

  const render = () => {
    const visibleArticles = sortedArticles.filter(articleMatches);
    renderFeatured(visibleArticles);
    renderList(visibleArticles);
    if (resultCount) resultCount.textContent = `${visibleArticles.length} / ${articles.length} ARTICLES`;
    if (emptyState) emptyState.hidden = visibleArticles.length > 0;
    if (featuredSlot) featuredSlot.hidden = visibleArticles.length === 0;
    if (tagFilter) tagFilter.querySelectorAll('button').forEach((button) => button.classList.toggle('active', button.dataset.tag === state.tag));
    syncURL();
  };

  searchInput?.addEventListener('input', (event) => { state.query = event.target.value.trim(); render(); });
  categorySelect?.addEventListener('change', (event) => { state.category = event.target.value; render(); });
  tagFilter?.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-tag]');
    if (!button) return;
    state.tag = button.dataset.tag;
    render();
  });

  document.querySelectorAll('.footer-bottom span:first-child').forEach((node) => { node.textContent = `© ${new Date().getFullYear()} 你的名字／工作室`; });
  updateThemeButton();
  render();
})();
