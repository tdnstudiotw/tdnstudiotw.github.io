(() => {
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

  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (event) => {
      const target = document.querySelector(link.getAttribute('href'));
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  document.querySelectorAll('.footer-bottom span:first-child').forEach((node) => {
    node.textContent = `© ${new Date().getFullYear()} TDN Studio`;
  });

  // 動態渲染最近筆記
  const renderRecentNotes = () => {
    const container = document.querySelector('[data-recent-notes]');
    if (!container || !window.BLOG_ARTICLES) return;

    // 依日期排序，取前三篇
    const recent = [...window.BLOG_ARTICLES]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 3);

    container.innerHTML = recent
      .map(
        (article) => `
        <a class="note-row" href="../blog/post.html?id=${article.id}">
          <span class="note-date">${article.dateLabel}</span>
          <span class="note-title">${article.title}</span>
          <span class="note-tag">${article.category.toUpperCase()}</span>
          <span class="note-arrow">↗</span>
        </a>`
      )
      .join('');
  };

  renderRecentNotes();
  updateThemeButton();
})();
