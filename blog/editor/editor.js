(() => {
  const root = document.documentElement;
  const metaFields = ['id', 'title', 'date', 'category', 'tags', 'summary'];
  const elements = {
    editor: document.querySelector('[data-editor]'),
    preview: document.querySelector('[data-preview]'),
    fileList: document.querySelector('[data-file-list]'),
    folderStatus: document.querySelector('[data-folder-status]'),
    saveState: document.querySelector('[data-save-state]'),
    wordCount: document.querySelector('[data-word-count]'),
    toast: document.querySelector('[data-toast]'),
    fileInput: document.querySelector('[data-file-input]'),
    imageInput: document.querySelector('[data-image-input]'),
    themeToggle: document.querySelector('[data-theme-toggle]'),
    themeColor: document.querySelector('meta[name="theme-color"]'),
  };
  const state = { folderHandle: null, postsHandle: null, imageRootHandle: null, blogImagesHandle: null, fileHandle: null, currentFilename: null, files: [] };

  const today = () => new Date().toISOString().slice(0, 10);
  const escapeHTML = (value = '') => String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
  const slugify = (value = '') => value.toLowerCase().trim().replace(/[^\w\u4e00-\u9fff]+/g, '-').replace(/^-+|-+$/g, '') || 'new-post';
  const labels = () => Object.fromEntries(metaFields.map((key) => [key, document.querySelector(`[data-meta="${key}"]`)]));
  const getMeta = () => {
    const fields = labels();
    return {
      id: fields.id?.value.trim() || '0001',
      title: fields.title?.value.trim() || '未命名文章',
      date: fields.date?.value || today(),
      category: fields.category?.value.trim() || '個人雜記',
      tags: (fields.tags?.value || '').split(',').map((tag) => tag.trim()).filter(Boolean),
      summary: fields.summary?.value.trim() || '',
    };
  };
  const setMeta = (meta = {}) => {
    const fields = labels();
    const values = { id: meta.id || '0001', title: meta.title || '', date: meta.date || today(), category: meta.category || '個人雜記', tags: Array.isArray(meta.tags) ? meta.tags.join(', ') : (meta.tags || ''), summary: meta.summary || '' };
    metaFields.forEach((key) => { if (fields[key]) fields[key].value = values[key]; });
  };

  const parseValue = (value = '') => {
    const clean = value.trim();
    if (clean.startsWith('[') && clean.endsWith(']')) return clean.slice(1, -1).split(',').map((item) => item.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
    return clean.replace(/^['"]|['"]$/g, '');
  };
  const parseDocument = (source) => {
    const normalized = String(source || '').replace(/\r\n/g, '\n');
    const match = normalized.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
    const meta = {};
    let body = normalized;
    if (match) {
      match[1].split('\n').forEach((line) => {
        const divider = line.indexOf(':');
        if (divider === -1) return;
        const key = line.slice(0, divider).trim();
        meta[key] = parseValue(line.slice(divider + 1));
      });
      body = match[2];
    }
    return { meta, body: body.trimStart() };
  };
  const quoteYaml = (value) => String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const serializeDocument = () => {
    const meta = getMeta();
    const tags = meta.tags.map((tag) => `"${quoteYaml(tag)}"`).join(', ');
    return `---\nid: ${meta.id}\ntitle: ${quoteYaml(meta.title)}\ndate: ${meta.date}\ncategory: ${quoteYaml(meta.category)}\ntags: [${tags}]\nsummary: ${quoteYaml(meta.summary)}\n---\n\n${elements.editor.value.trim()}\n`;
  };

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
    const lines = String(markdown || '').replace(/^---[\s\S]*?---\s*/, '').replace(/\r\n/g, '\n').split('\n');
    const output = [];
    let paragraph = [];
    let listItems = [];
    let listType = null;
    let codeLines = null;
    let codeLanguage = '';
    const flushParagraph = () => { if (paragraph.length) { output.push(`<p>${inlineMarkdown(paragraph.join(' '))}</p>`); paragraph = []; } };
    const flushList = () => { if (!listItems.length) return; const tag = listType === 'ordered' ? 'ol' : 'ul'; output.push(`<${tag}>${listItems.map((item) => `<li>${inlineMarkdown(item)}</li>`).join('')}</${tag}>`); listItems = []; listType = null; };
    lines.forEach((line) => {
      if (line.startsWith('```')) {
        flushParagraph(); flushList();
        if (codeLines !== null) { output.push(`<pre><code class="language-${escapeHTML(codeLanguage)}">${escapeHTML(codeLines.join('\n'))}</code></pre>`); codeLines = null; codeLanguage = ''; }
        else { codeLines = []; codeLanguage = line.slice(3).trim() || 'text'; }
        return;
      }
      if (codeLines !== null) { codeLines.push(line); return; }
      const embed = window.ExternalEmbeds?.markerPlaceholder(line);
      if (embed) {
        flushParagraph();
        flushList();
        output.push(embed);
        return;
      }
      if (!line.trim()) { flushParagraph(); flushList(); return; }
      const heading = line.match(/^(#{1,3})\s+(.+)$/);
      if (heading) { flushParagraph(); flushList(); output.push(`<h${heading[1].length}>${inlineMarkdown(heading[2].trim())}</h${heading[1].length}>`); return; }
      if (/^---+$/.test(line.trim())) { flushParagraph(); flushList(); output.push('<hr />'); return; }
      const unordered = line.match(/^\s*[-*+]\s+(.+)$/);
      const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
      if (unordered || ordered) { flushParagraph(); const nextType = ordered ? 'ordered' : 'unordered'; if (listType && listType !== nextType) flushList(); listType = nextType; listItems.push((unordered || ordered)[1]); return; }
      if (/^>\s?/.test(line)) { flushParagraph(); flushList(); output.push(`<blockquote>${inlineMarkdown(line.replace(/^>\s?/, ''))}</blockquote>`); return; }
      paragraph.push(line.trim());
    });
    if (codeLines !== null) output.push(`<pre><code class="language-${escapeHTML(codeLanguage)}">${escapeHTML(codeLines.join('\n'))}</code></pre>`);
    flushParagraph(); flushList();
    return output.join('\n');
  };

  const updatePreview = () => {
    if (!elements.preview || !elements.editor) return;
    const content = elements.editor.value.trim();
    elements.preview.innerHTML = content ? renderMarkdown(content) : '<div class="preview-empty">開始寫作後，預覽會出現在這裡。</div>';
    if (content) window.ExternalEmbeds?.hydrate(elements.preview);
    const characters = content.replace(/\s/g, '').length;
    const words = content.trim() ? content.trim().split(/\s+/).filter(Boolean).length : 0;
    if (elements.wordCount) elements.wordCount.textContent = `${words || characters} ${words ? 'words' : 'chars'}`;
  };
  const setSaveState = (message) => { if (elements.saveState) elements.saveState.textContent = message; };
  let toastTimer;
  const toast = (message) => { if (!elements.toast) return; elements.toast.textContent = message; elements.toast.classList.add('is-visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => elements.toast.classList.remove('is-visible'), 2600); };

  const resetEditor = (meta = {}, body = '') => { setMeta(meta); if (elements.editor) elements.editor.value = body; updatePreview(); setSaveState('未儲存'); };
  const loadText = (text, filename = null, fileHandle = null) => { const parsed = parseDocument(text); resetEditor(parsed.meta, parsed.body); state.currentFilename = filename; state.fileHandle = fileHandle; setSaveState(filename ? `已開啟 ${filename}` : '未儲存'); };
  const readHandle = async (handle) => { const file = await handle.getFile(); loadText(await file.text(), file.name, handle); toast(`已開啟 ${file.name}`); };

  const renderFileList = () => {
    if (!elements.fileList) return;
    if (!state.files.length) { elements.fileList.innerHTML = '<div class="folder-status">連接資料夾後，文章檔案會顯示在這裡。</div>'; return; }
    elements.fileList.innerHTML = state.files.map((file) => `<button class="file-item ${file.name === state.currentFilename ? 'active' : ''}" type="button" data-filename="${escapeHTML(file.name)}"><span class="file-number">${escapeHTML(file.id || '—')}</span><span><span class="file-name">${escapeHTML(file.name)}</span><span class="file-date">${escapeHTML(file.date || '')}</span></span></button>`).join('');
  };
  const parseFileInfo = async (name, handle) => { const file = await handle.getFile(); const parsed = parseDocument(await file.text()); return { name, handle, id: parsed.meta.id || name.slice(0, 4), date: parsed.meta.date || '' }; };
  const refreshFiles = async () => {
    if (!state.postsHandle) { renderFileList(); return; }
    const files = [];
    for await (const [name, handle] of state.postsHandle.entries()) { if (handle.kind === 'file' && name.toLowerCase().endsWith('.md')) files.push(await parseFileInfo(name, handle)); }
    state.files = files.sort((a, b) => String(a.date).localeCompare(String(b.date)) || a.name.localeCompare(b.name)).reverse();
    renderFileList();
  };

  const openFolder = async () => {
    if (!window.showDirectoryPicker) { toast('目前瀏覽器不支援資料夾存取，請用開啟或下載功能。'); return; }
    try {
      state.folderHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
      state.postsHandle = await state.folderHandle.getDirectoryHandle('posts', { create: true });
      state.imageRootHandle = await state.folderHandle.getDirectoryHandle('img', { create: true });
      state.blogImagesHandle = await state.imageRootHandle.getDirectoryHandle('blog', { create: true });
      if (elements.folderStatus) elements.folderStatus.innerHTML = `<strong>${escapeHTML(state.folderHandle.name)}</strong><br />已連接，可直接讀寫 posts/`;
      await refreshFiles();
      toast('Blog 資料夾已連接');
    } catch (error) { if (error?.name !== 'AbortError') toast('無法連接資料夾，請確認瀏覽器權限。'); }
  };

  const openPicker = async () => {
    if (window.showOpenFilePicker) {
      try { const [handle] = await window.showOpenFilePicker({ types: [{ description: 'Markdown', accept: { 'text/markdown': ['.md'] } }], multiple: false }); await readHandle(handle); renderFileList(); return; } catch (error) { if (error?.name === 'AbortError') return; }
    }
    elements.fileInput?.click();
  };
  elements.fileInput?.addEventListener('change', async (event) => { const file = event.target.files?.[0]; if (!file) return; loadText(await file.text(), file.name, null); toast(`已讀取 ${file.name}；儲存時會下載新檔案`); event.target.value = ''; });
  document.querySelector('[data-image]')?.addEventListener('click', () => { if (!state.blogImagesHandle) { toast('請先連接 Blog 資料夾，才能寫入圖片。'); return; } elements.imageInput?.click(); });
  elements.imageInput?.addEventListener('change', async (event) => { const files = [...(event.target.files || [])]; if (files.length) await uploadImages(files); event.target.value = ''; });

  const embedPanel = document.querySelector('[data-embed-panel]');
  const embedProvider = document.querySelector('[data-embed-provider]');
  const embedURL = document.querySelector('[data-embed-url-input]');
  const closeEmbedPanel = () => { if (embedPanel) embedPanel.hidden = true; };
  document.querySelector('[data-embed-toggle]')?.addEventListener('click', () => { if (embedPanel) embedPanel.hidden = !embedPanel.hidden; if (!embedPanel?.hidden) embedURL?.focus(); });
  document.querySelector('[data-embed-close]')?.addEventListener('click', closeEmbedPanel);
  document.querySelector('[data-insert-embed]')?.addEventListener('click', () => {
    const url = embedURL?.value.trim() || '';
    if (!url) { toast('請貼上公開內容網址。'); embedURL?.focus(); return; }
    const detected = window.ExternalEmbeds?.detect(url);
    if (!detected || detected.provider === 'link') { toast('這個網址目前沒有支援的嵌入格式，仍可用外部連結 fallback。'); }
    const keyword = embedProvider?.value && embedProvider.value !== 'auto' ? embedProvider.value : 'embed';
    insertAtCursor(`\n{{< ${keyword} ${url} >}}\n`);
    if (embedURL) embedURL.value = '';
    if (embedProvider) embedProvider.value = 'auto';
    closeEmbedPanel();
  });

  const filenameForCurrent = () => state.currentFilename || `${getMeta().id}-${slugify(getMeta().title)}.md`;
  const writeFile = async (handle, content) => { const writable = await handle.createWritable(); await writable.write(content); await writable.close(); };
  const safeImageName = (name) => { const original = String(name || 'image.png'); const extension = original.includes('.') ? `.${original.split('.').pop().toLowerCase().replace(/[^a-z0-9]/g, '') || 'png'}` : '.png'; const stem = original.replace(/\.[^.]+$/, '').normalize('NFKD').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'image'; return `${stem}${extension}`; };
  const insertAtCursor = (text) => { const textarea = elements.editor; if (!textarea) return; const start = textarea.selectionStart; const end = textarea.selectionEnd; textarea.setRangeText(text, start, end, 'end'); textarea.focus(); updatePreview(); };
  const uploadImages = async (files) => {
    if (!state.blogImagesHandle) { toast('請先連接 Blog 資料夾，才能寫入 img/blog/。'); return; }
    const articleId = getMeta().id || '0001';
    const imageDirectory = await state.blogImagesHandle.getDirectoryHandle(articleId, { create: true });
    const inserted = [];
    for (const file of files) {
      let filename = safeImageName(file.name);
      let imageHandle;
      try { imageHandle = await imageDirectory.getFileHandle(filename); filename = `${filename.replace(/\.[^.]+$/, '')}-${Date.now()}${filename.match(/\.[^.]+$/)?.[0] || '.png'}`; } catch { /* filename is available */ }
      imageHandle = imageHandle || await imageDirectory.getFileHandle(filename, { create: true });
      await writeFile(imageHandle, await file.arrayBuffer());
      inserted.push(`![${file.name}](../../img/blog/${articleId}/${filename})`);
    }
    if (inserted.length) { insertAtCursor(`\n${inserted.join('\n')}\n`); toast(`已上傳 ${inserted.length} 張圖片到 img/blog/${articleId}/`); }
  };
  const download = (filename, content, type = 'text/markdown') => { const blob = new Blob([content], { type: `${type};charset=utf-8` }); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); };

  const saveFile = async () => {
    const content = serializeDocument();
    const filename = filenameForCurrent();
    try {
      if (state.fileHandle) { await writeFile(state.fileHandle, content); state.currentFilename = state.fileHandle.name; setSaveState(`已儲存 ${state.currentFilename}`); toast(`已寫入 ${state.currentFilename}`); await refreshFiles(); return; }
      if (state.postsHandle) {
        const handle = await state.postsHandle.getFileHandle(filename, { create: true });
        await writeFile(handle, content); state.fileHandle = handle; state.currentFilename = filename; setSaveState(`已儲存 ${filename}`); toast(`已寫入 posts/${filename}`); await refreshFiles(); return;
      }
      download(filename, content); state.currentFilename = filename; setSaveState(`已下載 ${filename}`); toast(`已下載 ${filename}，請放入 blog/posts/`);
    } catch (error) { toast('儲存失敗，請確認資料夾權限。'); }
  };

  const categoryKey = (category = '') => ({ '技術與工具': 'tech', '地震／氣象': 'earth-weather', '專案紀錄': 'project', '個人雜記': 'notes' }[category] || slugify(category));
  const buildIndex = async () => {
    if (!state.postsHandle) { toast('請先連接 Blog 資料夾，再更新 articles.js。'); return; }
    await refreshFiles();
    const articles = [];
    for (const item of state.files) {
      const file = await item.handle.getFile();
      const parsed = parseDocument(await file.text());
      const meta = parsed.meta;
      const body = parsed.body;
      articles.push({ id: String(meta.id || item.id), slug: slugify(meta.title || item.name.replace(/\.md$/i, '')), title: meta.title || item.name, excerpt: meta.summary || body.split('\n').find((line) => line.trim()) || '', date: meta.date || item.date, dateLabel: String(meta.date || item.date).replace(/-/g, '.'), category: meta.category || '未分類', categoryKey: categoryKey(meta.category || '未分類'), tags: Array.isArray(meta.tags) ? meta.tags : [], readingTime: `${Math.max(1, Math.ceil(body.replace(/\s/g, '').length / 450))} min read`, file: `./posts/${item.name}`, accent: 'orange', featured: articles.length === 0 });
    }
    const categories = [...new Map(articles.map((article) => [article.categoryKey, { key: article.categoryKey, label: article.category }])).values()];
    const content = `window.BLOG_ARTICLES = ${JSON.stringify(articles, null, 2)};\n\nwindow.BLOG_CATEGORIES = ${JSON.stringify([{ key: 'all', label: '全部文章' }, ...categories], null, 2)};\n`;
    try { const handle = await state.folderHandle.getFileHandle('articles.js', { create: true }); await writeFile(handle, content); toast('articles.js 已更新'); } catch (error) { toast('更新 articles.js 失敗。'); }
  };

  const saveDraft = () => { localStorage.setItem('blog-editor-draft', JSON.stringify({ meta: getMeta(), body: elements.editor.value, filename: state.currentFilename, savedAt: new Date().toISOString() })); setSaveState('草稿已保存'); toast('草稿已保存到此瀏覽器'); };
  const loadDraftIfAvailable = () => { try { const draft = JSON.parse(localStorage.getItem('blog-editor-draft')); if (draft?.body || draft?.meta?.title) { resetEditor(draft.meta, draft.body); state.currentFilename = draft.filename || null; setSaveState('已載入瀏覽器草稿'); } } catch { /* ignore invalid draft */ } };

  const newArticle = () => { state.fileHandle = null; state.currentFilename = null; const id = String(Math.max(0, ...state.files.map((item) => Number.parseInt(item.id, 10) || 0)) + 1).padStart(4, '0'); resetEditor({ id, date: today(), category: '專案紀錄', tags: [], summary: '' }, ''); toast(`已建立新文章 ${id}`); renderFileList(); };
  const applyFormat = (format) => {
    const textarea = elements.editor; if (!textarea) return;
    const start = textarea.selectionStart; const end = textarea.selectionEnd; const selected = textarea.value.slice(start, end) || '文字';
    const wrappers = { bold: ['**', '**'], italic: ['*', '*'], heading: ['## ', ''], quote: ['> ', ''], code: ['`', '`'], list: ['- ', ''] };
    const [before, after] = wrappers[format] || ['', ''];
    textarea.setRangeText(`${before}${selected}${after}`, start, end, 'select'); textarea.focus(); updatePreview();
  };

  elements.editor?.addEventListener('input', updatePreview);
  metaFields.forEach((key) => document.querySelector(`[data-meta="${key}"]`)?.addEventListener('input', updatePreview));
  elements.editor?.addEventListener('keydown', (event) => { if (event.key === 'Tab') { event.preventDefault(); const start = elements.editor.selectionStart; elements.editor.setRangeText('  ', start, start, 'end'); updatePreview(); } if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); saveFile(); } });
  document.querySelectorAll('[data-format]').forEach((button) => button.addEventListener('click', () => applyFormat(button.dataset.format)));
  document.querySelector('[data-new]')?.addEventListener('click', newArticle);
  document.querySelector('[data-open-folder]')?.addEventListener('click', openFolder);
  document.querySelector('[data-open-file]')?.addEventListener('click', openPicker);
  document.querySelector('[data-refresh]')?.addEventListener('click', refreshFiles);
  document.querySelector('[data-save-file]')?.addEventListener('click', saveFile);
  document.querySelector('[data-download]')?.addEventListener('click', () => download(filenameForCurrent(), serializeDocument()));
  document.querySelector('[data-save-index]')?.addEventListener('click', buildIndex);
  document.querySelector('[data-save-draft]')?.addEventListener('click', saveDraft);
  elements.fileList?.addEventListener('click', async (event) => { const button = event.target.closest('[data-filename]'); if (!button || !state.postsHandle) return; const item = state.files.find((file) => file.name === button.dataset.filename); if (item) { await readHandle(item.handle); renderFileList(); } });

  elements.themeToggle?.addEventListener('click', () => { const nextTheme = root.dataset.theme === 'dark' ? 'light' : 'dark'; root.dataset.theme = nextTheme; localStorage.setItem('site-theme', nextTheme); updateThemeButton(); });
  const updateThemeButton = () => { const isDark = root.dataset.theme === 'dark'; elements.themeToggle?.setAttribute('aria-pressed', String(isDark)); elements.themeToggle?.setAttribute('aria-label', isDark ? '切換淺色模式' : '切換深色模式'); elements.themeColor?.setAttribute('content', isDark ? '#111111' : '#fffaf5'); };

  setMeta({ id: '0004', date: today(), category: '專案紀錄', tags: [], summary: '' });
  updatePreview();
  updateThemeButton();
  loadDraftIfAvailable();
})();
