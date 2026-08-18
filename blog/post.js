(() => {
  const root = document.documentElement;
  const themeToggle = document.querySelector('[data-theme-toggle]');
  const menuToggle = document.querySelector('[data-menu-toggle]');
  const mobileMenu = document.querySelector('[data-mobile-menu]');
  const themeColor = document.querySelector('meta[name="theme-color"]');
  const articles = Array.isArray(window.BLOG_ARTICLES) ? [...window.BLOG_ARTICLES].sort((a, b) => b.date.localeCompare(a.date)) : [];
  const postId = new URLSearchParams(window.location.search).get('post') || articles[0]?.id;
  const article = articles.find((item) => item.id === postId) || articles[0];

  const escapeHTML = (value = '') => String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
  const slugify = (value) => value.toLowerCase().trim().replace(/[^\w\u4e00-\u9fff\- ]+/g, '').replace(/\s+/g, '-');

  const inlineMarkdown = (value) => {
    let html = escapeHTML(value);
    html = html.replace(/!\[([^\]]*)\]\(([^\s)]+)(?:\s+["']([^"']+)["'])?\)/g, (_match, alt, src, title) => `<img src="${src}" alt="${alt}" loading="lazy"${title ? ` title="${title}"` : ''} />`);
    html = html.replace(/\[([^\]]+)\]\(([^\s)]+)\)/g, '<a href="$2">$1</a>');
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    html = html.replace(/_([^_]+)_/g, '<em>$1</em>');
    return html;
  };

  const renderMarkdown = (markdown) => {
    const source = markdown.replace(/^---[\s\S]*?---\s*/, '').replace(/\r\n/g, '\n');
    const lines = source.split('\n');
    const output = [];
    const headings = [];
    let paragraph = [];
    let listItems = [];
    let listType = null;
    let codeLines = [];
    let codeLanguage = '';

    const flushParagraph = () => {
      if (paragraph.length) {
        output.push(`<p>${inlineMarkdown(paragraph.join(' '))}</p>`);
        paragraph = [];
      }
    };
    const flushList = () => {
      if (!listItems.length) return;
      const tag = listType === 'ordered' ? 'ol' : 'ul';
      output.push(`<${tag}>${listItems.map((item) => `<li>${inlineMarkdown(item)}</li>`).join('')}</${tag}>`);
      listItems = [];
      listType = null;
    };

    lines.forEach((line) => {
      if (line.startsWith('```')) {
        flushParagraph();
        flushList();
        if (codeLines.length) {
          output.push(`<pre><code class="language-${escapeHTML(codeLanguage)}">${escapeHTML(codeLines.join('\n'))}</code></pre>`);
          codeLines = [];
          codeLanguage = '';
        } else {
          codeLanguage = line.slice(3).trim() || 'text';
          codeLines = ['__OPEN__'];
        }
        return;
      }
      if (codeLines.length) {
        if (codeLines[0] === '__OPEN__') codeLines[0] = line;
        else codeLines.push(line);
        return;
      }
      if (!line.trim()) {
        flushParagraph();
        flushList();
        return;
      }
      const heading = line.match(/^(#{1,3})\s+(.+)$/);
      if (heading) {
        flushParagraph();
        flushList();
        const level = heading[1].length;
        const text = heading[2].trim();
        const id = slugify(text);
        headings.push({ level, text, id });
        output.push(`<h${level} id="${id}">${inlineMarkdown(text)}</h${level}>`);
        return;
      }
      if (/^---+$/.test(line.trim())) {
        flushParagraph();
        flushList();
        output.push('<hr />');
        return;
      }
      const unordered = line.match(/^\s*[-*+]\s+(.+)$/);
      const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
      if (unordered || ordered) {
        flushParagraph();
        const nextType = ordered ? 'ordered' : 'unordered';
        if (listType && listType !== nextType) flushList();
        listType = nextType;
        listItems.push((unordered || ordered)[1]);
        return;
      }
      if (/^>\s?/.test(line)) {
        flushParagraph();
        flushList();
        output.push(`<blockquote>${inlineMarkdown(line.replace(/^>\s?/, ''))}</blockquote>`);
        return;
      }
      paragraph.push(line.trim());
    });

    if (codeLines.length) output.push(`<pre><code class="language-${escapeHTML(codeLanguage)}">${escapeHTML(codeLines.slice(1).join('\n'))}</code></pre>`);
    flushParagraph();
    flushList();
    return { html: output.join('\n'), headings };
  };

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

  const renderHeader = () => {
    const header = document.querySelector('[data-article-header]');
    if (!header || !article) return;
    document.title = `${article.title}｜Blog｜你的名字／工作室`;
    document.querySelector('meta[name="description"]')?.setAttribute('content', article.excerpt);
    header.innerHTML = `<div class="article-meta post-meta"><span class="category">${escapeHTML(article.category)}</span><span class="meta-bullet">/</span><span>${escapeHTML(article.dateLabel)}</span><span class="meta-bullet">/</span><span>${escapeHTML(article.readingTime)}</span></div><h1>${escapeHTML(article.title)}</h1><p>${escapeHTML(article.excerpt)}</p><div class="article-tags">${article.tags.map((tag) => `<a href="./?tag=${encodeURIComponent(tag)}">#${escapeHTML(tag)}</a>`).join('')}</div>`;
  };

  const renderPagination = () => {
    const pagination = document.querySelector('[data-article-pagination]');
    if (!pagination || !article) return;
    const currentIndex = articles.findIndex((item) => item.id === article.id);
    const newer = articles[currentIndex - 1];
    const older = articles[currentIndex + 1];
    pagination.innerHTML = `${older ? `<a class="pagination-card pagination-older" href="./post.html?post=${encodeURIComponent(older.id)}"><span>較早文章</span><strong>${escapeHTML(older.title)}</strong><b>←</b></a>` : '<span></span>'}${newer ? `<a class="pagination-card pagination-newer" href="./post.html?post=${encodeURIComponent(newer.id)}"><span>較新文章</span><strong>${escapeHTML(newer.title)}</strong><b>→</b></a>` : '<span></span>'}`;
  };

  const renderToc = (headings) => {
    const toc = document.querySelector('[data-article-toc]');
    if (!toc) return;
    const visibleHeadings = headings.filter((heading) => heading.level >= 2);
    toc.innerHTML = visibleHeadings.length ? visibleHeadings.map((heading) => `<a class="toc-level-${heading.level}" href="#${heading.id}">${escapeHTML(heading.text)}</a>`).join('') : '<span>本文沒有段落標題</span>';
  };

  const renderError = (message) => {
    const body = document.querySelector('[data-article-body]');
    if (body) body.innerHTML = `<div class="article-error"><strong>文章目前無法載入</strong><p>${escapeHTML(message)}</p><a class="button button-ghost" href="./">回到文章列表</a></div>`;
  };

  const loadArticle = async () => {
    if (!article) return renderError('找不到這篇文章。');
    renderHeader();
    renderPagination();
    try {
      const response = await fetch(article.file);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const markdown = await response.text();
      const rendered = renderMarkdown(markdown);
      const body = document.querySelector('[data-article-body]');
      if (body) body.innerHTML = rendered.html;
      renderToc(rendered.headings);
    } catch (error) {
      renderError('請使用本地伺服器預覽 Markdown 文章，或確認文章檔案路徑是否正確。');
    }
  };

  window.addEventListener('scroll', () => {
    const progress = document.querySelector('[data-reading-progress]');
    if (!progress) return;
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    progress.style.transform = `scaleX(${scrollable > 0 ? window.scrollY / scrollable : 0})`;
  }, { passive: true });

  document.querySelectorAll('.footer-bottom span:first-child').forEach((node) => { node.textContent = `© ${new Date().getFullYear()} 你的名字／工作室`; });
  updateThemeButton();
  loadArticle();
})();
