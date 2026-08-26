(() => {
  const root = document.documentElement;
  const projects = Array.isArray(window.PROJECTS) ? window.PROJECTS : [];
  const list = document.querySelector('[data-project-list]');
  const empty = document.querySelector('[data-empty-state]');
  const themeToggle = document.querySelector('[data-theme-toggle]');
  const themeColor = document.querySelector('meta[name="theme-color"]');
  const mobileMenu = document.querySelector('[data-mobile-menu]');
  const menuToggle = document.querySelector('[data-menu-toggle]');

  const escapeHTML = (value = '') => String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
  const card = (project) => `<a class="project-card project-card-${escapeHTML(project.accent || 'orange')}" href="${escapeHTML(project.href)}" ${project.href.startsWith('http') ? 'target="_blank" rel="noreferrer"' : ''} data-status="${escapeHTML(project.status)}" data-category="${escapeHTML(project.category)}"><div class="project-card-head"><span class="project-number">${escapeHTML(project.number)}</span><span class="project-status status-${escapeHTML(project.status)}">${escapeHTML(project.statusLabel)}</span></div><span class="project-subtitle">${escapeHTML(project.subtitle)}</span><h3>${escapeHTML(project.title)}</h3><p class="project-description">${escapeHTML(project.description)}</p><div class="project-tags">${project.tags.map((tag) => `<span class="project-tag">${escapeHTML(tag)}</span>`).join('')}</div><div class="project-card-foot"><span>${escapeHTML(project.category)} · ${escapeHTML(project.linkLabel)}</span><span class="arrow">↗</span></div></a>`;
  const render = (filter = 'all') => {
    const visible = projects.filter((project) => filter === 'all' || project.status === filter);
    if (list) list.innerHTML = visible.map(card).join('');
    if (empty) empty.hidden = visible.length > 0;
    document.querySelector('[data-total]')?.replaceChildren(document.createTextNode(String(projects.length).padStart(2, '0')));
    document.querySelector('[data-active]')?.replaceChildren(document.createTextNode(String(projects.filter((project) => project.status === 'active' || project.status === 'building').length).padStart(2, '0')));
  };
  const setFilter = (filter, updateURL = true) => {
    document.querySelectorAll('[data-filter]').forEach((button) => button.classList.toggle('active', button.dataset.filter === filter));
    render(filter);
    if (updateURL) { const url = new URL(window.location.href); if (filter === 'all') url.searchParams.delete('status'); else url.searchParams.set('status', filter); window.history.replaceState({}, '', url); }
  };
  document.querySelectorAll('[data-filter]').forEach((button) => button.addEventListener('click', () => setFilter(button.dataset.filter)));

  const updateThemeButton = () => { const isDark = root.dataset.theme === 'dark'; themeToggle?.setAttribute('aria-pressed', String(isDark)); themeToggle?.setAttribute('aria-label', isDark ? '切換淺色模式' : '切換深色模式'); themeColor?.setAttribute('content', isDark ? '#111111' : '#fffaf5'); };
  themeToggle?.addEventListener('click', () => { const nextTheme = root.dataset.theme === 'dark' ? 'light' : 'dark'; root.dataset.theme = nextTheme; localStorage.setItem('site-theme', nextTheme); updateThemeButton(); });
  menuToggle?.addEventListener('click', () => { const isOpen = mobileMenu?.classList.toggle('is-open'); menuToggle.classList.toggle('is-open', isOpen); menuToggle.setAttribute('aria-expanded', String(Boolean(isOpen))); });
  document.querySelectorAll('[data-year]').forEach((node) => { node.textContent = new Date().getFullYear(); });

  const initialFilter = new URLSearchParams(window.location.search).get('status') || 'all';
  setFilter(['all', 'active', 'building', 'planned'].includes(initialFilter) ? initialFilter : 'all', false);
  updateThemeButton();
})();
