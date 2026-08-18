window.TEAM_MEMBERS = [
  {
    number: '01',
    initials: 'A',
    name: '成員一',
    role: 'Core / Direction',
    state: 'CORE MEMBER',
    bio: '負責團隊方向、網站架構與內容系統，喜歡把模糊的想法整理成可以開始的下一步。',
    skills: ['Direction', 'Web', 'Systems'],
  },
  {
    number: '02',
    initials: 'B',
    name: '成員二',
    role: 'Core / Building',
    state: 'CORE MEMBER',
    bio: '負責專案實作、工具與資料觀察，喜歡從實際使用與反覆測試中讓東西變得更清楚。',
    skills: ['Building', 'Tools', 'Research'],
  },
];

(() => {
  const escapeHTML = (value = '') => String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
  const list = document.querySelector('[data-member-list]');
  if (!list) return;
  list.innerHTML = window.TEAM_MEMBERS.map((member, index) => `<article class="member-card ${index === 1 ? 'member-two' : ''}"><div class="member-card-head"><span class="member-number">${escapeHTML(member.number)}</span><span class="member-state">${escapeHTML(member.state)}</span></div><div class="member-avatar" aria-hidden="true">${escapeHTML(member.initials)}</div><h3>${escapeHTML(member.name)}</h3><span class="member-role">${escapeHTML(member.role)}</span><p class="member-bio">${escapeHTML(member.bio)}</p><div class="member-skills">${member.skills.map((skill) => `<span class="member-skill">${escapeHTML(skill)}</span>`).join('')}</div></article>`).join('');
})();
