(() => {
  const SCRIPT_URLS = {
    threads: 'https://www.threads.com/embed.js',
    instagram: 'https://www.instagram.com/embed.js',
    twitter: 'https://platform.twitter.com/widgets.js',
    tiktok: 'https://www.tiktok.com/embed.js',
    reddit: 'https://embed.reddit.com/widgets.js',
  };
  const loadedScripts = new Map();
  const allowedProtocols = new Set(['http:', 'https:']);

  const escapeHTML = (value = '') => String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
  const safeURL = (value = '') => {
    try {
      const url = new URL(String(value).trim());
      return allowedProtocols.has(url.protocol) ? url : null;
    } catch { return null; }
  };
  const normalizedHost = (url) => url.hostname.toLowerCase().replace(/^www\./, '');
  const idFromPath = (path, pattern) => path.match(pattern)?.[1] || '';

  const detect = (value) => {
    const url = safeURL(value);
    if (!url) return { provider: 'link', url: '#' };
    const host = normalizedHost(url);
    const path = url.pathname;
    if ((host === 'threads.com' || host === 'threads.net') && /\/post\//.test(path)) return { provider: 'threads', url: url.href };
    if (host === 'instagram.com' && /\/(p|reel|tv)\//.test(path)) return { provider: 'instagram', url: url.href };
    if ((host === 'twitter.com' || host === 'x.com') && /\/status\/\d+/.test(path)) return { provider: 'twitter', url: url.href };
    if (host === 'youtube.com' || host === 'youtu.be') {
      const id = host === 'youtu.be' ? path.slice(1).split('/')[0] : (url.searchParams.get('v') || idFromPath(path, /\/(?:shorts|embed)\/([^/?]+)/));
      if (id) return { provider: 'youtube', id, url: url.href };
    }
    if (host === 'vimeo.com' || host === 'player.vimeo.com') {
      const id = idFromPath(path, /\/(?:video\/)?(\d+)/);
      if (id) return { provider: 'vimeo', id, url: url.href };
    }
    if (host === 'open.spotify.com') {
      const match = path.match(/^\/(track|album|playlist|episode|show)\/([^/?]+)/);
      if (match) return { provider: 'spotify', type: match[1], id: match[2], url: url.href };
    }
    if (host === 'soundcloud.com' || host === 'on.soundcloud.com') return { provider: 'soundcloud', url: url.href };
    if (host === 'codepen.io') {
      const match = path.match(/^\/([^/]+)\/(?:pen|full|details)\/([^/?]+)/);
      if (match) return { provider: 'codepen', user: match[1], id: match[2], url: url.href };
    }
    if (host === 'gist.github.com') {
      const parts = path.split('/').filter(Boolean);
      const id = parts[parts.length - 1];
      if (id && /^[a-z0-9]+$/i.test(id)) return { provider: 'gist', user: parts.length > 1 ? parts[0] : '', id, url: url.href };
    }
    if (host === 'reddit.com' && /\/comments\//.test(path)) return { provider: 'reddit', url: url.href };
    if (host === 'tiktok.com' && /\/video\/\d+/.test(path)) return { provider: 'tiktok', url: url.href };
    return { provider: 'link', url: url.href };
  };

  const providerLabel = { threads: 'Threads', instagram: 'Instagram', twitter: 'X / Twitter', youtube: 'YouTube', vimeo: 'Vimeo', spotify: 'Spotify', soundcloud: 'SoundCloud', codepen: 'CodePen', gist: 'GitHub Gist', reddit: 'Reddit', tiktok: 'TikTok', link: 'External link' };
  const createFrame = (embed, child) => {
    const frame = document.createElement('div');
    frame.className = `external-embed-frame external-embed-${embed.provider}`;
    frame.dataset.provider = embed.provider;
    const heading = document.createElement('div');
    heading.className = 'external-embed-label';
    heading.innerHTML = `<span><i></i>${escapeHTML(providerLabel[embed.provider] || 'External content')}</span><a href="${escapeHTML(embed.url)}" target="_blank" rel="noreferrer">在原平台開啟 ↗</a>`;
    frame.append(heading, child);
    return frame;
  };
  const iframe = (src, title, className = '') => {
    const node = document.createElement('iframe');
    node.className = className;
    node.src = src;
    node.title = title;
    node.loading = 'lazy';
    node.referrerPolicy = 'strict-origin-when-cross-origin';
    node.allow = 'autoplay; encrypted-media; picture-in-picture; web-share';
    node.allowFullscreen = true;
    return node;
  };
  const linkFallback = (embed) => {
    const card = document.createElement('a');
    card.className = 'external-embed-fallback';
    card.href = embed.url;
    card.target = '_blank';
    card.rel = 'noreferrer';
    card.innerHTML = `<span>EXTERNAL CONTENT</span><strong>在${escapeHTML(providerLabel[embed.provider] || '原平台')}查看 ↗</strong><small>此平台未提供可直接嵌入的安全格式，點擊後開啟原始內容。</small>`;
    return card;
  };
  const nativeBlockquote = (embed) => {
    const block = document.createElement('blockquote');
    block.className = embed.provider === 'twitter' ? 'twitter-tweet' : embed.provider === 'instagram' ? 'instagram-media' : embed.provider === 'tiktok' ? 'tiktok-embed' : embed.provider === 'reddit' ? 'reddit-embed-bq' : 'text-post-media';
    block.style.cssText = 'margin:0; min-width:270px; width:100%;';
    const anchor = document.createElement('a');
    anchor.href = embed.url;
    anchor.target = '_blank';
    anchor.rel = 'noreferrer';
    anchor.textContent = `在${providerLabel[embed.provider]}查看`;
    block.append(anchor);
    if (embed.provider === 'threads') block.dataset.textPostPermalink = embed.url;
    if (embed.provider === 'instagram') block.dataset.instgrmPermalink = `${embed.url}?utm_source=ig_embed&utm_campaign=loading`;
    if (embed.provider === 'tiktok') { block.dataset.videoId = embed.url.match(/\/video\/(\d+)/)?.[1] || ''; block.setAttribute('cite', embed.url); }
    if (embed.provider === 'reddit') { block.dataset.embedHeight = '500'; block.style.height = '500px'; }
    return block;
  };
  const createEmbed = (embed) => {
    switch (embed.provider) {
      case 'youtube': return iframe(`https://www.youtube-nocookie.com/embed/${encodeURIComponent(embed.id)}?rel=0`, 'YouTube video', 'embed-iframe embed-youtube');
      case 'vimeo': return iframe(`https://player.vimeo.com/video/${encodeURIComponent(embed.id)}`, 'Vimeo video', 'embed-iframe embed-vimeo');
      case 'spotify': return iframe(`https://open.spotify.com/embed/${encodeURIComponent(embed.type)}/${encodeURIComponent(embed.id)}?utm_source=generator`, 'Spotify player', 'embed-iframe embed-spotify');
      case 'soundcloud': return iframe(`https://w.soundcloud.com/player/?url=${encodeURIComponent(embed.url)}&color=%23e8875b&auto_play=false&hide_related=true&show_comments=false`, 'SoundCloud player', 'embed-iframe embed-soundcloud');
      case 'codepen': return iframe(`https://codepen.io/${encodeURIComponent(embed.user)}/embed/${encodeURIComponent(embed.id)}?default-tab=result`, 'CodePen demo', 'embed-iframe embed-codepen');
      case 'gist': return iframe(`https://gist.github.com/${embed.user ? `${encodeURIComponent(embed.user)}/` : ''}${encodeURIComponent(embed.id)}.pibb`, 'GitHub Gist', 'embed-iframe embed-gist');
      case 'threads': case 'instagram': case 'twitter': case 'tiktok': case 'reddit': return nativeBlockquote(embed);
      default: return linkFallback(embed);
    }
  };
  const loadScript = (provider) => {
    if (!SCRIPT_URLS[provider]) return Promise.resolve();
    if (loadedScripts.has(provider)) return loadedScripts.get(provider);
    const promise = new Promise((resolve) => {
      const existing = document.querySelector(`script[data-external-embed="${provider}"]`);
      if (existing) { resolve(); return; }
      const script = document.createElement('script');
      script.async = true;
      script.src = SCRIPT_URLS[provider];
      script.dataset.externalEmbed = provider;
      script.onload = () => resolve();
      script.onerror = () => resolve();
      document.head.appendChild(script);
    });
    loadedScripts.set(provider, promise);
    return promise;
  };
  const hydrate = async (container) => {
    if (!container) return;
    const nodes = [...container.querySelectorAll('[data-embed-url]')];
    for (const node of nodes) {
      const embed = detect(node.dataset.embedUrl || '');
      const frame = createFrame(embed, createEmbed(embed));
      node.replaceWith(frame);
      if (SCRIPT_URLS[embed.provider]) {
        await loadScript(embed.provider);
        if (embed.provider === 'instagram' && window.instgrm?.Embeds?.process) window.instgrm.Embeds.process(frame);
        if (embed.provider === 'twitter' && window.twttr?.widgets?.load) window.twttr.widgets.load(frame);
        if (embed.provider === 'reddit') window.dispatchEvent(new Event('load'));
      }
    }
  };
  const parseMarker = (line) => {
    const match = String(line || '').trim().match(/^\{\{<\s*(?:(embed)\s+)?(threads|instagram|twitter|x|youtube|vimeo|spotify|soundcloud|codepen|gist|reddit|tiktok)?\s*(https?:\/\/[^>\s]+)\s*>\}\}$/i);
    if (!match) return null;
    return { url: match[3], keyword: (match[2] || '').toLowerCase() };
  };
  const markerPlaceholder = (line) => {
    const marker = parseMarker(line);
    if (!marker) return null;
    const node = `<div class="external-embed-placeholder" data-embed-url="${escapeHTML(marker.url)}"><span>Loading ${escapeHTML(marker.keyword || 'external content')}…</span></div>`;
    return node;
  };

  window.ExternalEmbeds = { detect, hydrate, parseMarker, markerPlaceholder, providerLabel };
})();
