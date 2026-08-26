window.TEAM_MEMBERS = [
  {
    number: '01',
    avatar: './images/1.jpg',
    name: 'walbcglgh1113',
    role: '創辦人 • 起草雛形',
    state: 'Founder',
    bio: '負責團隊方向、網站架構與主要開發工作，同時是社群帳號的主要負責人',
    skills: ['Direction', 'Web', 'Developer', 'Social'],
  },
  {
    number: '02',
    avatar: './images/2.jpg',
    name: '404.lost.0807',
    role: '核心成員',
    state: 'Member',
    bio: '負責後端開發與處理團隊事物，這網頁我寫的(⁠・⁠∀⁠・⁠)',
    skills: ['Building', 'Research', 'Database', 'Developer'],
  },
];

(() => {
  const escapeHTML = (value = '') => String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
  const list = document.querySelector('[data-member-list]');
  if (!list) return;
  list.innerHTML = window.TEAM_MEMBERS.map((member, index) => {
    const isImage = member.avatar.startsWith('http') || member.avatar.startsWith('/') || member.avatar.startsWith('./');
    const avatarContent = isImage 
        ? `<img src="${escapeHTML(member.avatar)}" alt="${escapeHTML(member.name)}" />` 
        : escapeHTML(member.avatar);

    return `<article class="member-card ${index === 1 ? 'member-two' : ''}"><div class="member-card-head"><span class="member-number">${escapeHTML(member.number)}</span><span class="member-state">${escapeHTML(member.state)}</span></div><div class="member-avatar" aria-hidden="true">${avatarContent}</div><h3>${escapeHTML(member.name)}</h3><span class="member-role">${escapeHTML(member.role)}</span><p class="member-bio">${escapeHTML(member.bio)}</p><div class="member-skills">${member.skills.map((skill) => `<span class="member-skill">${escapeHTML(skill)}</span>`).join('')}</div></article>`;
  }).join('');
})();

