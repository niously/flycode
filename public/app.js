const state = {
  public: null,
  admin: null,
  adminKey: localStorage.getItem('flycode-admin-key') || '',
  visitorId: localStorage.getItem('flycode-visitor-id') || createVisitorId(),
  allProposals: [],
  currentFilterTag: '',
  openComments: new Set(),
  commentsCache: new Map()
};

localStorage.setItem('flycode-visitor-id', state.visitorId);

const els = {
  roundNumber: document.querySelector('#round-number'),
  roundStatus: document.querySelector('#round-status'),
  roundTrackFill: document.querySelector('#round-track-fill'),
  boardPhaseId: document.querySelector('#board-phase-id'),
  currentQuestion: document.querySelector('#current-question'),
  currentPhaseDescription: document.querySelector('#current-phase-description'),
  phaseDeadline: document.querySelector('#phase-deadline'),
  phaseState: document.querySelector('#phase-state'),
  statProposals: document.querySelector('#stat-proposals'),
  statParticipants: document.querySelector('#stat-participants'),
  statRounds: document.querySelector('#stat-rounds'),
  proposalCountLabel: document.querySelector('#proposal-count-label'),
  listModeLabel: document.querySelector('#list-mode-label'),
  tagFilterBar: document.querySelector('#tag-filter-bar'),
  proposalList: document.querySelector('#proposal-list'),
  proposalEmpty: document.querySelector('#proposal-empty'),
  decisionSection: document.querySelector('#decision-section'),
  decisionStrip: document.querySelector('#decision-strip'),
  timelineList: document.querySelector('#timeline-list'),
  lastSync: document.querySelector('#last-sync'),
  proposalForm: document.querySelector('#proposal-form'),
  proposalTitle: document.querySelector('#proposal-title'),
  proposalDescription: document.querySelector('#proposal-description'),
  titleCounter: document.querySelector('#title-counter'),
  descriptionCounter: document.querySelector('#description-counter'),
  proposalSubmit: document.querySelector('#proposal-submit'),
  proposalMessage: document.querySelector('#proposal-message'),
  adminModal: document.querySelector('#admin-modal'),
  adminOpen: document.querySelector('#admin-open'),
  adminClose: document.querySelector('#admin-close'),
  adminLoginView: document.querySelector('#admin-login-view'),
  adminDashboard: document.querySelector('#admin-dashboard'),
  adminLoginForm: document.querySelector('#admin-login-form'),
  adminKey: document.querySelector('#admin-key'),
  adminLoginMessage: document.querySelector('#admin-login-message'),
  adminSummary: document.querySelector('#admin-summary'),
  pendingCount: document.querySelector('#pending-count'),
  adminProposals: document.querySelector('#admin-proposals'),
  approvedProposals: document.querySelector('#approved-proposals'),
  rejectedProposals: document.querySelector('#rejected-proposals'),
  pendingTabCount: document.querySelector('#pending-tab-count'),
  approvedTabCount: document.querySelector('#approved-tab-count'),
  rejectedTabCount: document.querySelector('#rejected-tab-count'),
  adminRefresh: document.querySelector('#admin-refresh'),
  selectAllPending: document.querySelector('#select-all-pending'),
  selectAllRejected: document.querySelector('#select-all-rejected'),
  batchApprove: document.querySelector('#batch-approve'),
  batchReject: document.querySelector('#batch-reject'),
  batchDeletePending: document.querySelector('#batch-delete-pending'),
  batchRereview: document.querySelector('#batch-rereview'),
  batchDeleteRejected: document.querySelector('#batch-delete-rejected'),
  adminCurrentStatus: document.querySelector('#admin-current-status'),
  phaseActions: document.querySelector('#phase-actions'),
  decisionForm: document.querySelector('#decision-form'),
  decisionProposal: document.querySelector('#decision-proposal'),
  decisionNote: document.querySelector('#decision-note'),
  decisionSubmit: document.querySelector('#decision-submit'),
  updateForm: document.querySelector('#update-form'),
  updateTitle: document.querySelector('#update-title'),
  updateBody: document.querySelector('#update-body'),
  updateMessage: document.querySelector('#update-message'),
  phaseForm: document.querySelector('#phase-form'),
  phaseTitle: document.querySelector('#phase-title'),
  phaseQuestion: document.querySelector('#phase-question'),
  phaseDeadlineInput: document.querySelector('#phase-deadline-input'),
  phaseMessage: document.querySelector('#phase-message'),
  exportData: document.querySelector('#export-data'),
  adminLogout: document.querySelector('#admin-logout'),
  communityOpen: document.querySelector('#community-open'),
  communityModal: document.querySelector('#community-modal'),
  communityClose: document.querySelector('#community-close'),
  toastStack: document.querySelector('#toast-stack')
};

const DRAFT_KEY = 'flycode-proposal-draft';
const originalSubmitText = '<span class="btn-sparkle">✦</span> 提交提案 <span aria-hidden="true">↗</span>';
const selectedProposals = {
  pending: new Set(),
  rejected: new Set()
};

const statusText = {
  submitting: '提案收集中',
  voting: '投票进行中',
  execution: '执行中',
  archived: '已归档',
  pending: '审核中',
  approved: '已公开',
  rejected: '未采用'
};

function createVisitorId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `visitor-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function escapeHtml(str = '') {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatDate(iso) {
  if (!iso) return '待定';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

function formatRelative(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins} 分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  return `${days} 天前`;
}

function showToast(message, type = 'info') {
  if (!els.toastStack) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  els.toastStack.appendChild(toast);
  window.setTimeout(() => {
    toast.remove();
  }, 3200);
}

function setMessage(target, text, isError = false) {
  if (!target) return;
  target.textContent = text;
  target.className = `form-message ${isError ? 'error' : (text ? 'success' : '')}`;
}

async function api(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'X-Visitor-Id': state.visitorId,
    ...(options.headers || {})
  };
  if (state.adminKey && !headers['X-Admin-Key'] && !headers['x-admin-key']) {
    headers['X-Admin-Key'] = state.adminKey;
  }
  const res = await fetch(path, { credentials: 'same-origin', ...options, headers });
  const data = await res.json().catch(() => ({ error: '网络返回异常' }));
  data.ok = res.ok;
  data.status = res.status;
  if (!res.ok && !data.error) {
    data.error = `HTTP ${res.status}`;
  }
  return data;
}

function updateCounters() {
  if (els.titleCounter && els.proposalTitle) {
    els.titleCounter.textContent = `${els.proposalTitle.value.length}/80`;
  }
  if (els.descriptionCounter && els.proposalDescription) {
    const len = els.proposalDescription.value.length;
    els.descriptionCounter.textContent = `${len}/1200 · 至少 10 个字`;
  }
}

function saveDraft() {
  if (!els.proposalTitle || !els.proposalDescription) return;
  const draft = {
    title: els.proposalTitle.value,
    description: els.proposalDescription.value,
    author: document.querySelector('#proposal-author')?.value || '',
    link: document.querySelector('#proposal-link')?.value || ''
  };
  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

function loadDraft() {
  const raw = localStorage.getItem(DRAFT_KEY);
  if (!raw) return;
  try {
    const draft = JSON.parse(raw);
    if (els.proposalTitle && draft.title) els.proposalTitle.value = draft.title;
    if (els.proposalDescription && draft.description) els.proposalDescription.value = draft.description;
    const authorEl = document.querySelector('#proposal-author');
    if (authorEl && draft.author) authorEl.value = draft.author;
    const linkEl = document.querySelector('#proposal-link');
    if (linkEl && draft.link) linkEl.value = draft.link;
    updateCounters();
  } catch {}
}

function clearDraft() {
  localStorage.removeItem(DRAFT_KEY);
  if (els.proposalForm) els.proposalForm.reset();
  updateCounters();
}

async function loadPublic(showFeedback = true) {
  const res = await api('/api/state');
  if (!res.ok) {
    if (els.lastSync && showFeedback) els.lastSync.textContent = '连接中断，重试中...';
    return;
  }
  state.public = res;
  renderPublic();
  if (els.lastSync) {
    els.lastSync.textContent = `已同步 · ${new Date().toLocaleTimeString('zh-CN', { hour12: false })}`;
  }
}

function renderPublic() {
  const data = state.public;
  if (!data) return;

  const currentPhase = data.currentPhase || {};
  const phaseNumber = String(currentPhase.number || 1).padStart(2, '0');
  if (els.roundNumber) els.roundNumber.textContent = `第 ${phaseNumber} 轮`;
  if (els.roundStatus) els.roundStatus.textContent = statusText[currentPhase.status] || currentPhase.status || '进行中';
  if (els.boardPhaseId) els.boardPhaseId.textContent = `${phaseNumber} / ${String(data.phases?.length || 1).padStart(2, '0')}`;
  if (els.currentQuestion) els.currentQuestion.textContent = currentPhase.question || '你希望它先做什么？';
  if (els.currentPhaseDescription) els.currentPhaseDescription.textContent = currentPhase.title || '提出一个具体想法，告诉我们为什么它值得优先考虑。';
  if (els.phaseDeadline) els.phaseDeadline.textContent = currentPhase.deadline ? formatDate(currentPhase.deadline) : '开放中';
  if (els.phaseState) els.phaseState.textContent = statusText[currentPhase.status] || currentPhase.status || '提案收集中';

  if (els.roundTrackFill) {
    const progressMap = { submitting: '33%', voting: '66%', execution: '100%', archived: '100%' };
    els.roundTrackFill.style.width = progressMap[currentPhase.status] || '33%';
  }

  if (els.statProposals) els.statProposals.textContent = data.stats?.proposalCount ?? (data.proposals || []).length;
  if (els.statParticipants) els.statParticipants.textContent = data.stats?.participantCount ?? 0;
  if (els.statRounds) els.statRounds.textContent = currentPhase.number || data.phases?.length || 1;

  state.allProposals = data.proposals || [];
  filterProposals(state.currentFilterTag);
  loadTagFilters();

  renderDecision(currentPhase, data.proposals || []);
  renderTimeline(data.updates || []);
}

function filterProposals(tag) {
  const currentPhase = state.public?.currentPhase || {};
  if (!tag) {
    renderProposals(state.allProposals, currentPhase.status, currentPhase);
  } else {
    const filtered = state.allProposals.filter(p => p.tags && Array.isArray(p.tags) && p.tags.includes(tag));
    renderProposals(filtered, currentPhase.status, currentPhase);
  }
}

async function loadTagFilters() {
  if (!els.tagFilterBar) return;
  try {
    const res = await api('/api/proposals/tags');
    if (res.ok && Array.isArray(res.tags)) {
      const activeTag = state.currentFilterTag;
      const tagsHtml = res.tags.map(t => `
        <button class="filter-tag ${activeTag === t.name ? 'active' : ''}" data-tag="${escapeHtml(t.name)}" type="button">
          ${escapeHtml(t.name)}
          <span class="tag-count">(${t.count})</span>
        </button>
      `).join('');

      els.tagFilterBar.innerHTML = `
        <button class="filter-tag ${!activeTag ? 'active' : ''}" data-tag="" type="button">全部</button>
        ${tagsHtml}
      `;

      els.tagFilterBar.querySelectorAll('.filter-tag').forEach(btn => {
        btn.addEventListener('click', handleTagFilter);
      });
    }
  } catch (err) {
    console.error('加载标签失败:', err);
  }
}

function handleTagFilter(e) {
  const btn = e.currentTarget;
  const tag = btn.dataset.tag || '';
  if (els.tagFilterBar) {
    els.tagFilterBar.querySelectorAll('.filter-tag').forEach(b => b.classList.remove('active'));
  }
  btn.classList.add('active');
  state.currentFilterTag = tag;
  filterProposals(tag);
}

function getAvatarColor(str = '') {
  const colors = ['#07c160', '#10aeff', '#fa9d3b', '#fa5151', '#7c3aed', '#db2777', '#f59e0b', '#6366f1'];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function spawnWxFloatHeart(x, y) {
  const emojis = ['❤️', '💖', '✨', '👍', '🔥'];
  const p = document.createElement('div');
  p.className = 'wx-float-heart';
  p.textContent = emojis[Math.floor(Math.random() * emojis.length)];
  p.style.left = `${x}px`;
  p.style.top = `${y}px`;
  document.body.appendChild(p);
  setTimeout(() => p.remove(), 900);
}

function renderProposals(proposals, phaseStatus, phase) {
  if (!els.proposalList) return;
  
  // 保存当前打开评论区的输入框状态
  const inputStates = {};
  els.proposalList.querySelectorAll('.wx-comment-section').forEach(section => {
    const proposalId = section.dataset.sectionProposal;
    const nameInput = section.querySelector('.wx-name-input');
    const textInput = section.querySelector('.wx-text-input');
    if (proposalId && (nameInput || textInput)) {
      inputStates[proposalId] = {
        name: nameInput?.value || '',
        text: textInput?.value || '',
        nameFocused: nameInput === document.activeElement,
        textFocused: textInput === document.activeElement
      };
    }
  });
  
  const isVoting = phaseStatus === 'voting';
  if (els.proposalCountLabel) els.proposalCountLabel.textContent = `${proposals.length} 个公开提案`;
  if (els.listModeLabel) els.listModeLabel.textContent = isVoting ? '按投票热度排序' : '按最新提交排序';

  if (proposals.length === 0) {
    els.proposalList.innerHTML = '';
    if (els.proposalEmpty) els.proposalEmpty.hidden = false;
    return;
  }

  if (els.proposalEmpty) els.proposalEmpty.hidden = true;
  const candidateIds = new Set(state.public?.voting?.candidateIds || phase?.candidates || []);
  const alreadyVoted = Boolean(state.public?.voting?.hasVoted);
  
  els.proposalList.innerHTML = proposals.map((p, idx) => {
    const candidate = isVoting && candidateIds.has(p.id);
    const voteBtn = candidate
      ? `<div class="proposal-vote">
          <button class="vote-btn ${alreadyVoted ? 'active' : ''}" type="button" data-vote-id="${escapeHtml(p.id)}" ${alreadyVoted ? 'disabled' : ''}>
            <span aria-hidden="true">${alreadyVoted ? '✓' : '▲'}</span>
            <span>${p.voteCount || 0}</span>
          </button>
        </div>`
      : `<div class="proposal-vote"><span class="proposal-index">#${String(idx + 1).padStart(2, '0')}</span><span class="vote-count">${p.voteCount || 0} 票</span></div>`;

    const linkHtml = p.link ? `<a class="proposal-link-pill" href="${escapeHtml(p.link)}" target="_blank" rel="noopener noreferrer">参考链接 ↗</a>` : '';

    const tagsHtml = (p.tags && p.tags.length > 0)
      ? `<div class="proposal-tags">${p.tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>`
      : '';

    const isOpen = state.openComments.has(p.id);
    const cachedComments = state.commentsCache.get(p.id) || [];

    // 微信朋友圈评论气泡内容
    let wxSectionHtml = '';
    if (isOpen) {
      const likesRow = (p.likeCount && p.likeCount > 0)
        ? `<div class="wx-likes-row"><span class="wx-heart-mini">❤️</span> <span>${p.likeCount} 人觉得很赞</span></div>`
        : '';

      const commentsHtml = cachedComments.length > 0
        ? cachedComments.map(c => {
            const author = c.author || '匿名共创者';
            const initial = author.slice(0, 1).toUpperCase();
            const avatarBg = getAvatarColor(author);
            const deleteBtn = state.adminKey 
              ? `<button class="wx-delete-comment-btn" type="button" data-delete-comment="${escapeHtml(c.id)}" data-comment-proposal="${escapeHtml(p.id)}" title="删除评论">×</button>`
              : '';
            return `
              <div class="wx-comment-item" data-comment-id="${escapeHtml(c.id)}">
                <div class="wx-avatar" style="background:${avatarBg}">${escapeHtml(initial)}</div>
                <div class="wx-comment-body">
                  <span class="wx-comment-author">${escapeHtml(author)}:</span>
                  <span class="wx-comment-text">${escapeHtml(c.content)}</span>
                  <span class="wx-comment-time">${formatRelative(c.createdAt)}</span>
                </div>
                ${deleteBtn}
              </div>
            `;
          }).join('')
        : '<p style="color:var(--ink-muted);font-size:0.8rem;margin:0.25rem 0;">还没有评论，来抢沙发吧~</p>';

      wxSectionHtml = `
        <div class="wx-comment-section" data-section-proposal="${escapeHtml(p.id)}">
          <div class="wx-bubble-arrow"></div>
          ${likesRow}
          <div class="wx-comments-list">${commentsHtml}</div>
          <div class="wx-input-box">
            <div class="wx-input-row">
              <input class="field-input wx-name-input" type="text" placeholder="昵称" maxlength="20" value="${escapeHtml(localStorage.getItem('flycode-user-nickname') || '')}">
              <textarea class="field-input wx-text-input" placeholder="评论..." maxlength="500" rows="1"></textarea>
              <button class="wx-send-btn" type="button" data-send-comment="${escapeHtml(p.id)}">发送</button>
            </div>
          </div>
        </div>
      `;
    }

    return `<article class="proposal-card" data-card-id="${escapeHtml(p.id)}">
      <span class="proposal-index">${String(idx + 1).padStart(2, '0')}</span>
      <div class="proposal-body">
        <h3>${escapeHtml(p.title)}</h3>
        <p>${escapeHtml(p.description)}</p>
        <div class="proposal-meta">
          <span class="proposal-author">${escapeHtml(p.author || '匿名共创者')}</span>
          <span>${formatRelative(p.createdAt)}</span>
          ${linkHtml}
        </div>
        <div class="proposal-actions">
          <button class="wx-action-btn like-btn ${p.liked ? 'liked' : ''}" data-proposal-id="${escapeHtml(p.id)}" type="button" aria-label="点赞">
            <svg class="like-icon" viewBox="0 0 24 24" width="15" height="15">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
            </svg>
            <span class="like-count">${p.likeCount || 0}</span>
          </button>
          <button class="wx-action-btn comment-btn ${isOpen ? 'active' : ''}" data-toggle-comment="${escapeHtml(p.id)}" type="button" aria-label="评论">
            <svg class="comment-icon" viewBox="0 0 24 24" width="15" height="15">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
            </svg>
            <span class="comment-count">${p.commentCount || 0}</span>
          </button>
          ${tagsHtml}
        </div>
        ${wxSectionHtml}
      </div>
      ${voteBtn}
    </article>`;
  }).join('');

  els.proposalList.querySelectorAll('.like-btn').forEach(btn => {
    btn.addEventListener('click', handleLikeClick);
  });

  els.proposalList.querySelectorAll('[data-toggle-comment]').forEach(btn => {
    btn.addEventListener('click', handleToggleComment);
  });

  els.proposalList.querySelectorAll('[data-send-comment]').forEach(btn => {
    btn.addEventListener('click', handleSendComment);
  });

  els.proposalList.querySelectorAll('.wx-name-input').forEach(nameInput => {
    let isComposing = false;
    
    nameInput.addEventListener('compositionstart', () => {
      isComposing = true;
    });
    
    nameInput.addEventListener('compositionend', () => {
      isComposing = false;
      saveNickname();
    });
    
    nameInput.addEventListener('input', () => {
      if (!isComposing) {
        saveNickname();
      }
    });
    
    function saveNickname() {
      const val = nameInput.value.trim();
      if (val) {
        localStorage.setItem('flycode-user-nickname', val);
      } else {
        localStorage.removeItem('flycode-user-nickname');
      }
    }
  });

  els.proposalList.querySelectorAll('.wx-text-input').forEach(input => {
    // Bug修复 #9: textarea自动扩展高度
    function autoResize() {
      input.style.height = 'auto';
      input.style.height = input.scrollHeight + 'px';
    }
    
    input.addEventListener('input', autoResize);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const btn = input.closest('.wx-input-box')?.querySelector('[data-send-comment]');
        if (btn) btn.click();
      }
    });
    
    // 初始化高度
    autoResize();
  });

  els.proposalList.querySelectorAll('[data-delete-comment]').forEach(deleteBtn => {
    deleteBtn.addEventListener('click', handleDeleteComment);
  });
  
  // Bug修复 #6: 渲染后恢复输入框的值和焦点
  Object.keys(inputStates).forEach(proposalId => {
    const section = els.proposalList.querySelector(`.wx-comment-section[data-section-proposal="${proposalId}"]`);
    if (section) {
      const nameInput = section.querySelector('.wx-name-input');
      const textInput = section.querySelector('.wx-text-input');
      if (nameInput && inputStates[proposalId].name) {
        nameInput.value = inputStates[proposalId].name;
      }
      if (textInput && inputStates[proposalId].text) {
        textInput.value = inputStates[proposalId].text;
      }
      // 恢复焦点和光标位置
      if (inputStates[proposalId].nameFocused && nameInput) {
        nameInput.focus();
      }
      if (inputStates[proposalId].textFocused && textInput) {
        textInput.focus();
      }
    }
  });
}

function renderDecision(phase, proposals) {
  if (!els.decisionSection || !els.decisionStrip) return;
  const chosen = phase?.chosenProposalId ? proposals.find((item) => item.id === phase.chosenProposalId) : null;
  if (!chosen || !phase?.decidedAt) {
    els.decisionSection.hidden = true;
    els.decisionStrip.innerHTML = '';
    return;
  }
  els.decisionSection.hidden = false;
  els.decisionStrip.innerHTML = `<div class="decision-item">
    <div class="decision-badge">已进入执行</div>
    <div class="decision-content">
      <h3>${escapeHtml(chosen.title)}</h3>
      <p>${escapeHtml(phase.decisionNote || '本轮决定已公布，项目进入执行阶段。')}</p>
    </div>
  </div>`;
}

function renderTimeline(timeline) {
  if (!els.timelineList) return;
  if (timeline.length === 0) {
    els.timelineList.innerHTML = '<p class="admin-empty">还没有成长记录。每一轮决策与新功能发布都会沉淀在这里。</p>';
    return;
  }
  els.timelineList.innerHTML = timeline.map(entry => `
    <article class="timeline-entry">
      <time class="timeline-date">${formatDate(entry.createdAt)}</time>
      <div class="timeline-body">
        <h3>${escapeHtml(entry.title)}</h3>
        <p>${escapeHtml(entry.body)}</p>
      </div>
    </article>
  `).join('');
}

async function handleLikeClick(event) {
  const btn = event.currentTarget;
  const proposalId = btn.dataset.proposalId;
  if (!proposalId) return;

  try {
    btn.disabled = true;
    const res = await api('/api/likes', {
      method: 'POST',
      body: JSON.stringify({ proposalId })
    });

    if (res.ok) {
      if (res.action === 'liked') {
        btn.classList.add('liked');
        spawnWxFloatHeart(event.clientX, event.clientY);
      } else {
        btn.classList.remove('liked');
      }

      const countSpan = btn.querySelector('.like-count');
      if (countSpan) countSpan.textContent = res.likeCount ?? 0;

      // 更新本地缓存的提案数据
      const cached = state.allProposals.find(p => p.id === proposalId);
      if (cached) {
        cached.liked = res.action === 'liked';
        cached.likeCount = res.likeCount ?? 0;
      }

      // 如果当前评论区展开着，同步刷新点赞栏
      const currentPhase = state.public?.currentPhase || {};
      if (state.openComments.has(proposalId)) {
        filterProposals(state.currentFilterTag);
      }
    } else {
      showToast(res.error || '点赞失败', 'error');
    }
  } catch (err) {
    console.error('点赞失败:', err);
    showToast('网络错误，请稍后重试', 'error');
  } finally {
    btn.disabled = false;
  }
}

async function handleToggleComment(event) {
  const btn = event.currentTarget;
  const proposalId = btn.dataset.toggleComment;
  if (!proposalId) return;

  if (state.openComments.has(proposalId)) {
    state.openComments.delete(proposalId);
    filterProposals(state.currentFilterTag);
  } else {
    state.openComments.add(proposalId);
    // 先加载评论数据
    try {
      const res = await api(`/api/comments?proposalId=${encodeURIComponent(proposalId)}`);
      if (res.ok) {
        state.commentsCache.set(proposalId, res.comments || []);
      }
    } catch (err) {
      console.error('加载评论失败:', err);
    }
    filterProposals(state.currentFilterTag);
    // 聚焦输入框
    setTimeout(() => {
      const section = document.querySelector(`.wx-comment-section[data-section-proposal="${proposalId}"]`);
      section?.querySelector('.wx-text-input')?.focus();
    }, 50);
  }
}

async function handleSendComment(event) {
  const btn = event.currentTarget;
  const proposalId = btn.dataset.sendComment;
  if (!proposalId) return;

  const inputBox = btn.closest('.wx-input-box');
  const nameInput = inputBox?.querySelector('.wx-name-input');
  const textInput = inputBox?.querySelector('.wx-text-input');

  const author = nameInput?.value.trim() || '匿名共创者';
  const content = textInput?.value.trim();

  if (!content) {
    showToast('请输入评论内容', 'error');
    textInput?.focus();
    return;
  }

  if (content.length > 500) {
    showToast('评论内容不能超过 500 字', 'error');
    return;
  }

  // 自动填充/更新上次输入的昵称（如果用户清空了，则清除保存的昵称）
  if (nameInput) {
    const val = nameInput.value.trim();
    if (val) {
      localStorage.setItem('flycode-user-nickname', val);
    } else {
      localStorage.removeItem('flycode-user-nickname');
    }
  }

  btn.disabled = true;
  try {
    const res = await api('/api/comments', {
      method: 'POST',
      body: JSON.stringify({ proposalId, author, content })
    });

    if (res.ok) {
      showToast('评论已发送！');
      // Bug修复 #1: 清空输入框
      if (textInput) {
        textInput.value = '';
        // Bug修复 #10: 重置textarea高度
        textInput.style.height = 'auto';
      }
      // 重新拉取该提案评论并更新缓存
      const commentRes = await api(`/api/comments?proposalId=${encodeURIComponent(proposalId)}`);
      if (commentRes.ok) {
        state.commentsCache.set(proposalId, commentRes.comments || []);
      }
      // 更新提案卡片评论计数
      const cached = state.allProposals.find(p => p.id === proposalId);
      if (cached) {
        cached.commentCount = (cached.commentCount || 0) + 1;
      }
      filterProposals(state.currentFilterTag);
      spawnWxFloatHeart(event.clientX, event.clientY);
    } else {
      showToast(res.error || '评论发送失败', 'error');
    }
  } catch (err) {
    console.error('发送评论失败:', err);
    showToast('网络错误，请稍后重试', 'error');
  } finally {
    btn.disabled = false;
  }
}

async function handleDeleteComment(event) {
  const btn = event.currentTarget;
  const commentId = btn.dataset.deleteComment;
  const proposalId = btn.dataset.commentProposal;
  if (!commentId || !proposalId || !state.adminKey) return;

  if (!confirm('确认删除这条评论？')) return;

  btn.disabled = true;
  try {
    const res = await api(`/api/admin/comments/${commentId}`, {
      method: 'DELETE',
      headers: { 'X-Admin-Key': state.adminKey }
    });

    if (res.ok) {
      showToast('评论已删除');
      // 重新拉取该提案评论并更新缓存
      const commentRes = await api(`/api/comments?proposalId=${encodeURIComponent(proposalId)}`);
      if (commentRes.ok) {
        state.commentsCache.set(proposalId, commentRes.comments || []);
      }
      // 更新提案卡片评论计数
      const cached = state.allProposals.find(p => p.id === proposalId);
      if (cached && cached.commentCount > 0) {
        cached.commentCount = cached.commentCount - 1;
      }
      filterProposals(state.currentFilterTag);
    } else {
      showToast(res.error || '删除失败', 'error');
    }
  } catch (err) {
    console.error('删除评论失败:', err);
    showToast('网络错误，请稍后重试', 'error');
  } finally {
    btn.disabled = false;
  }
}

els.proposalList?.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-vote-id]');
  if (!btn || btn.disabled) return;
  const id = btn.dataset.voteId;
  btn.disabled = true;
  createRipple(e, btn);
  const res = await api('/api/votes', {
    method: 'POST',
    body: JSON.stringify({ proposalId: id, visitorId: state.visitorId })
  });
  if (res.ok) {
    spawnVoteFlyParticle(e.clientX, e.clientY);
    showToast('投票已记录！');
    await loadPublic(false);
  } else {
    showToast(res.error || '投票失败', 'error');
    btn.disabled = false;
  }
});

function createRipple(event, element) {
  const circle = document.createElement('span');
  const diameter = Math.max(element.clientWidth, element.clientHeight);
  const radius = diameter / 2;
  const rect = element.getBoundingClientRect();
  circle.style.width = circle.style.height = `${diameter}px`;
  circle.style.left = `${event.clientX - rect.left - radius}px`;
  circle.style.top = `${event.clientY - rect.top - radius}px`;
  circle.classList.add('btn-ripple');
  element.appendChild(circle);
  setTimeout(() => circle.remove(), 600);
}

function spawnVoteFlyParticle(x, y) {
  const p = document.createElement('div');
  p.className = 'vote-fly-particle';
  p.textContent = '+1 ✦';
  p.style.left = `${x}px`;
  p.style.top = `${y}px`;
  document.body.appendChild(p);
  setTimeout(() => p.remove(), 900);
}

const cursorGlow = document.querySelector('#cursor-glow');
// 仅桌面端启用光标聚光灯：手机点击会触发"模拟 mousemove"把光斑定死在点击处，
// 且之后没有事件再移动它，看起来就像有鼠标一直留在那里。触屏设备彻底禁用。
const hasFinePointer = window.matchMedia && window.matchMedia('(pointer: fine)').matches;
const hasTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
if (cursorGlow && hasFinePointer && !hasTouch) {
  window.addEventListener('mousemove', (e) => {
    cursorGlow.style.left = `${e.clientX}px`;
    cursorGlow.style.top = `${e.clientY}px`;
  });
} else if (cursorGlow) {
  cursorGlow.style.display = 'none';
}

els.proposalForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (document.querySelector('#proposal-website')?.value) return;
  const title = els.proposalTitle.value.trim();
  const description = els.proposalDescription.value.trim();
  const author = document.querySelector('#proposal-author')?.value.trim() || '';
  const link = document.querySelector('#proposal-link')?.value.trim() || '';

  if (title.length < 2) return setMessage(els.proposalMessage, '标题至少需要 2 个字。', true);
  if (description.length < 10) return setMessage(els.proposalMessage, '描述至少需要 10 个字。', true);

  els.proposalSubmit.disabled = true;
  els.proposalSubmit.innerHTML = '正在提交...';

  const res = await api('/api/proposals', {
    method: 'POST',
    body: JSON.stringify({ title, description, author, link, visitor_id: state.visitorId })
  });

  els.proposalSubmit.disabled = false;
  els.proposalSubmit.innerHTML = originalSubmitText;

  if (res.ok) {
    clearDraft();
    setMessage(els.proposalMessage, '提案提交成功！将在审核通过后公开展示。');
    showToast('提案已成功提交！');
  } else {
    setMessage(els.proposalMessage, res.error || '提交失败，请重试。', true);
  }
});

els.proposalTitle?.addEventListener('input', () => { updateCounters(); saveDraft(); });
els.proposalDescription?.addEventListener('input', () => { updateCounters(); saveDraft(); });

function reviewLocked() {
  const status = state.admin?.currentPhase?.status;
  return status === 'voting' || status === 'execution';
}

function resetAdminSession(message, showFeedback) {
  state.admin = null;
  state.adminKey = '';
  localStorage.removeItem('flycode-admin-key');
  selectedProposals.pending.clear();
  selectedProposals.rejected.clear();
  if (els.adminLoginView) els.adminLoginView.hidden = false;
  if (els.adminDashboard) els.adminDashboard.hidden = true;
  if (showFeedback) setMessage(els.adminLoginMessage, message, true);
}

async function loadAdmin(showFeedback = true) {
  if (!state.adminKey) return false;
  const res = await api('/api/admin/state', { headers: { 'X-Admin-Key': state.adminKey } });
  if (!res.ok) {
    if (res.status === 401) {
      resetAdminSession(res.error || '管理密钥不正确。', showFeedback);
    } else if (showFeedback) {
      showToast(res.error || '工作台暂时无法刷新。', 'error');
    }
    return false;
  }
  state.admin = res;
  renderAdmin();
  return true;
}

function renderAdmin() {
  if (!state.admin) return;
  els.adminLoginView.hidden = true;
  els.adminDashboard.hidden = false;

  const allProposals = state.admin.allProposals || [];
  const pending = allProposals.filter((proposal) => proposal.status === 'pending');
  const approved = allProposals.filter((proposal) => proposal.status === 'approved');
  const rejected = allProposals.filter((proposal) => proposal.status === 'rejected');
  const phase = state.admin.currentPhase;

  if (els.adminSummary) {
    els.adminSummary.innerHTML = `
      <div class="admin-summary-item"><strong>${allProposals.length}</strong><span>全部提案</span></div>
      <div class="admin-summary-item"><strong>${pending.length}</strong><span>待审核</span></div>
      <div class="admin-summary-item"><strong>${approved.length}</strong><span>已公开</span></div>
    `;
  }
  if (els.adminCurrentStatus) els.adminCurrentStatus.textContent = statusText[phase?.status] || '';
  if (els.pendingCount) els.pendingCount.textContent = `${pending.length} 条待处理`;
  if (els.pendingTabCount) els.pendingTabCount.textContent = pending.length;
  if (els.approvedTabCount) els.approvedTabCount.textContent = approved.length;
  if (els.rejectedTabCount) els.rejectedTabCount.textContent = rejected.length;

  renderReviewList(els.adminProposals, pending, 'pending');
  renderReviewList(els.approvedProposals, approved, 'approved');
  renderReviewList(els.rejectedProposals, rejected, 'rejected');
  renderPhaseActions(phase, state.admin);
}

function renderReviewList(container, proposals, type) {
  if (!container) return;
  const selectable = type === 'pending' || type === 'rejected';
  const locked = reviewLocked();
  if (selectable) {
    const visibleIds = new Set(proposals.map((proposal) => proposal.id));
    selectedProposals[type] = new Set([...selectedProposals[type]].filter((id) => visibleIds.has(id)));
  }
  if (!proposals.length) {
    container.innerHTML = '<p class="admin-empty">这里暂时没有提案。</p>';
    if (selectable) {
      selectedProposals[type].clear();
      updateBatchButtons();
    }
    return;
  }
  container.innerHTML = proposals.map((proposal) => {
    const metaBits = [
      escapeHtml(proposal.author || '匿名共创者'),
      formatRelative(proposal.createdAt)
    ];
    if (proposal.voteCount) metaBits.push(`${proposal.voteCount} 票`);
    const linkHtml = proposal.link
      ? `<a class="proposal-link-pill" href="${escapeHtml(proposal.link)}" target="_blank" rel="noopener noreferrer">参考链接 ↗</a>`
      : '';
    let actions = '';
    if (!locked) {
      if (type === 'pending') {
        actions = `
          <button class="small-button approve" type="button" data-review-id="${escapeHtml(proposal.id)}" data-review-status="approved">通过</button>
          <button class="small-button reject" type="button" data-review-id="${escapeHtml(proposal.id)}" data-review-status="rejected">不采用</button>
          <button class="small-button danger" type="button" data-delete-id="${escapeHtml(proposal.id)}" data-delete-type="pending">删除</button>`;
      } else if (type === 'rejected') {
        actions = `
          <button class="small-button approve" type="button" data-review-id="${escapeHtml(proposal.id)}" data-review-status="pending">重新审查</button>
          <button class="small-button danger" type="button" data-delete-id="${escapeHtml(proposal.id)}" data-delete-type="rejected">删除</button>`;
      } else if (type === 'approved') {
        actions = `
          <button class="small-button reject" type="button" data-review-id="${escapeHtml(proposal.id)}" data-review-status="pending">撤回公开</button>
          <button class="small-button danger" type="button" data-review-id="${escapeHtml(proposal.id)}" data-review-status="rejected">不采用</button>`;
      }
    }
    const availableTags = ['功能', '内容', '设计', '体验', '技术', '运营', '其他'];
    const currentTags = Array.isArray(proposal.tags) ? proposal.tags : [];
    const tagOptions = availableTags.map(t => `
      <label><input type="checkbox" value="${t}" ${currentTags.includes(t) ? 'checked' : ''}> ${t}</label>
    `).join('');

    const tagSelectorHtml = `
      <div class="admin-tag-selector" data-proposal-id="${escapeHtml(proposal.id)}">
        <label class="tag-label">标签分类（最多3个）：</label>
        <div class="tag-checkboxes">
          ${tagOptions}
        </div>
        <div>
          <button class="small-button secondary" type="button" data-save-tags="${escapeHtml(proposal.id)}">保存标签</button>
        </div>
      </div>
    `;

    return `
    <div class="admin-proposal-row review-proposal-row" data-row-id="${escapeHtml(proposal.id)}">
      ${selectable
        ? `<label class="review-check"><input type="checkbox" class="proposal-checkbox" data-type="${type}" data-id="${escapeHtml(proposal.id)}"${selectedProposals[type].has(proposal.id) ? ' checked' : ''}${locked ? ' disabled' : ''}><span class="sr-only">选择 ${escapeHtml(proposal.title)}</span></label>`
        : '<span class="review-check-spacer" aria-hidden="true"></span>'}
      <div>
        <div class="review-proposal-topline">
          <span class="review-status ${proposal.status}">${statusText[proposal.status] || proposal.status}</span>
          <strong>${escapeHtml(proposal.title)}</strong>
        </div>
        <p class="proposal-desc">${escapeHtml(proposal.description)}</p>
        <p class="review-meta">${metaBits.join(' · ')}${linkHtml}</p>
        ${tagSelectorHtml}
      </div>
      <div class="admin-row-actions">${actions}</div>
    </div>`;
  }).join('');
  if (selectable) updateBatchButtons();
}

function selectedIds(type) {
  return [...selectedProposals[type]];
}

function updateBatchButtons() {
  const locked = reviewLocked();
  const pendingCount = selectedProposals.pending.size;
  const rejectedCount = selectedProposals.rejected.size;
  if (els.batchApprove) els.batchApprove.disabled = locked || pendingCount === 0;
  if (els.batchReject) els.batchReject.disabled = locked || pendingCount === 0;
  if (els.batchDeletePending) els.batchDeletePending.disabled = locked || pendingCount === 0;
  if (els.batchRereview) els.batchRereview.disabled = locked || rejectedCount === 0;
  if (els.batchDeleteRejected) els.batchDeleteRejected.disabled = locked || rejectedCount === 0;
  if (els.selectAllPending) els.selectAllPending.disabled = locked;
  if (els.selectAllRejected) els.selectAllRejected.disabled = locked;

  const pendingBoxes = document.querySelectorAll('.proposal-checkbox[data-type="pending"]');
  if (els.selectAllPending) {
    els.selectAllPending.checked = pendingBoxes.length > 0 && pendingCount === pendingBoxes.length;
    els.selectAllPending.indeterminate = pendingCount > 0 && pendingCount < pendingBoxes.length;
  }
  const rejectedBoxes = document.querySelectorAll('.proposal-checkbox[data-type="rejected"]');
  if (els.selectAllRejected) {
    els.selectAllRejected.checked = rejectedBoxes.length > 0 && rejectedCount === rejectedBoxes.length;
    els.selectAllRejected.indeterminate = rejectedCount > 0 && rejectedCount < rejectedBoxes.length;
  }
}

async function runBatch(action, type, idsOverride) {
  if (reviewLocked() && action !== 'rereview') {
    return showToast('本轮投票或执行已经开始，不能再修改提案。', 'error');
  }
  const ids = idsOverride || selectedIds(type);
  if (!ids.length) return showToast('请先勾选要处理的提案。', 'error');
  const isSingle = Boolean(idsOverride) && ids.length === 1;
  const confirmText = isSingle
    ? {
        approve: '确定通过这条提案吗？通过后会在访客页面公开。',
        reject: '确定把这条提案标记为不采用吗？',
        rereview: '确定把这条未采用提案重新放回待审核吗？',
        delete: '确定永久删除这条提案吗？删除后无法恢复。'
      }
    : {
        approve: `确定批量通过这 ${ids.length} 条提案吗？通过后会在访客页面公开。`,
        reject: `确定把这 ${ids.length} 条提案标记为不采用吗？`,
        rereview: `确定把这 ${ids.length} 条未采用提案重新放回待审核吗？`,
        delete: `确定永久删除这 ${ids.length} 条提案吗？删除后无法恢复。`
      };
  if (!confirm(confirmText[action] || '确定执行这项操作吗？')) return;
  const res = await api('/api/admin/proposals/batch', {
    method: 'POST',
    headers: { 'X-Admin-Key': state.adminKey },
    body: JSON.stringify({ ids, action })
  });
  if (res.ok) {
    ids.forEach((id) => selectedProposals[type]?.delete(id));
    const doneText = isSingle
      ? {
          approve: '提案已通过并公开。',
          reject: '提案已标记为不采用。',
          rereview: '提案已回到待审核。',
          delete: '提案已删除。'
        }
      : {
          approve: '已批量通过并公开。',
          reject: '已批量标记为不采用。',
          rereview: '已批量放回待审核。',
          delete: '已批量删除。'
        };
    showToast(doneText[action] || '操作完成。');
    await loadAdmin(false);
    await loadPublic(false);
  } else {
    showToast(res.error || '操作失败', 'error');
  }
}

function renderPhaseActions(phase, data) {
  if (!els.phaseActions || !phase) return;
  const approved = (data.allProposals || []).filter((proposal) => proposal.phaseId === phase.id && proposal.status === 'approved');
  const candidateIds = data.voting?.candidateIds || phase.candidates || [];
  const candidates = data.decisionCandidates?.length
    ? data.decisionCandidates
    : candidateIds.length
      ? approved.filter((proposal) => candidateIds.includes(proposal.id))
      : approved;
  els.phaseActions.innerHTML = '';
  if (els.decisionForm) els.decisionForm.hidden = true;
  if (phase.status === 'submitting') {
    els.phaseActions.innerHTML = `<button class="phase-action" type="button" data-phase-status="voting" ${approved.length ? '' : 'disabled'}>审核完成，开启投票</button><span class="admin-empty">${approved.length ? `已有 ${approved.length} 个通过的提案` : '至少通过一个提案后才能开启投票'}</span>`;
  } else if (phase.status === 'voting') {
    els.phaseActions.innerHTML = candidates.length
      ? '<span class="admin-empty">投票进行中。选择一个候选提案并公布决定。</span><button class="phase-action secondary" type="button" data-withdraw-voting>撤回投票，重新审核</button>'
      : '<span class="admin-empty error">当前没有可决定的候选提案，请刷新工作台并检查已公开提案。</span>';
    if (els.decisionForm) els.decisionForm.hidden = candidates.length === 0;
    if (els.decisionProposal) {
      els.decisionProposal.innerHTML = candidates.length
        ? candidates.map((proposal) => `<option value="${escapeHtml(proposal.id)}">${escapeHtml(proposal.title)}（${proposal.voteCount || 0} 票）</option>`).join('')
        : '<option value="">暂无可选提案</option>';
    }
  } else if (phase.status === 'execution') {
    els.phaseActions.innerHTML = '<span class="admin-empty">本轮已进入执行阶段。完成后可以归档并开启下一轮。</span><button class="phase-action secondary" type="button" data-phase-status="archived">归档本轮</button>';
  } else {
    els.phaseActions.innerHTML = '<span class="admin-empty">本轮已归档。可以在下方创建新的阶段。</span>';
  }
}

document.addEventListener('click', async (e) => {
  const saveTagsBtn = e.target.closest('[data-save-tags]');
  if (saveTagsBtn) {
    const proposalId = saveTagsBtn.dataset.saveTags;
    const container = document.querySelector(`.admin-tag-selector[data-proposal-id="${proposalId}"]`);
    if (!container) return;
    const checkboxes = container.querySelectorAll('.tag-checkboxes input:checked');
    const tags = Array.from(checkboxes).map(cb => cb.value);

    if (tags.length > 3) {
      showToast('最多只能选择 3 个标签', 'error');
      return;
    }

    saveTagsBtn.disabled = true;
    try {
      const res = await api(`/api/admin/proposals/${encodeURIComponent(proposalId)}/tags`, {
        method: 'PATCH',
        headers: { 'X-Admin-Key': state.adminKey },
        body: JSON.stringify({ tags })
      });
      if (res.ok) {
        showToast('标签保存成功！');
        await loadAdmin(false);
        await loadPublic(false);
      } else {
        showToast(res.error || '保存失败', 'error');
      }
    } catch (err) {
      console.error('保存标签失败:', err);
      showToast('网络错误，请稍后重试', 'error');
    } finally {
      saveTagsBtn.disabled = false;
    }
    return;
  }

  // Bug修复 #5: 标签checkbox点击时限制最多3个
  const tagCheckbox = e.target.closest('.tag-checkboxes input[type="checkbox"]');
  if (tagCheckbox) {
    const container = tagCheckbox.closest('.admin-tag-selector');
    if (container) {
      const checked = container.querySelectorAll('.tag-checkboxes input:checked');
      const unchecked = container.querySelectorAll('.tag-checkboxes input:not(:checked)');
      if (checked.length >= 3) {
        unchecked.forEach(cb => cb.disabled = true);
      } else {
        unchecked.forEach(cb => cb.disabled = false);
      }
    }
  }

  const deleteBtn = e.target.closest('[data-delete-id]');
  if (deleteBtn) {
    await runBatch('delete', deleteBtn.dataset.deleteType, [deleteBtn.dataset.deleteId]);
    return;
  }

  const reviewBtn = e.target.closest('[data-review-id]');
  if (reviewBtn) {
    const proposalId = reviewBtn.dataset.reviewId;
    const status = reviewBtn.dataset.reviewStatus;
    const res = await api('/api/admin/proposals/review', {
      method: 'POST',
      headers: { 'X-Admin-Key': state.adminKey },
      body: JSON.stringify({ proposalId, status })
    });
    if (res.ok) {
      showToast(status === 'approved' ? '提案已通过并公开。' : status === 'pending' ? '提案已回到待审核。' : '提案已标记为不采用。');
      await loadAdmin(false);
      await loadPublic(false);
    } else {
      showToast(res.error || '操作失败', 'error');
    }
    return;
  }

  const phaseBtn = e.target.closest('[data-phase-status]');
  if (phaseBtn) {
    const res = await api('/api/admin/phase/status', {
      method: 'POST',
      headers: { 'X-Admin-Key': state.adminKey },
      body: JSON.stringify({ status: phaseBtn.dataset.phaseStatus })
    });
    if (res.ok) {
      showToast(`阶段状态已更新为：${statusText[phaseBtn.dataset.phaseStatus]}`);
      await loadAdmin(false);
      await loadPublic(false);
    } else {
      showToast(res.error || '操作失败', 'error');
    }
    return;
  }

  const withdrawBtn = e.target.closest('[data-withdraw-voting]');
  if (withdrawBtn) {
    if (!confirm('确定撤回本轮投票吗？当前候选提案会回到待审核，已经产生的票数会清零。')) return;
    const res = await api('/api/admin/phase/withdraw-voting', {
      method: 'POST',
      headers: { 'X-Admin-Key': state.adminKey },
      body: JSON.stringify({})
    });
    if (res.ok) {
      showToast('投票已撤回，候选提案回到待审核。');
      await loadAdmin(false);
      await loadPublic(false);
    } else {
      showToast(res.error || '操作失败', 'error');
    }
  }
});

function openCommunity() {
  if (!els.communityModal) return;
  els.communityModal.hidden = false;
  document.body.style.overflow = 'hidden';
  els.communityClose?.focus();
}

function closeCommunity() {
  if (!els.communityModal) return;
  els.communityModal.hidden = true;
  document.body.style.overflow = '';
}

els.communityOpen?.addEventListener('click', openCommunity);
els.communityClose?.addEventListener('click', closeCommunity);
els.communityModal?.addEventListener('click', (e) => {
  if (e.target === els.communityModal) closeCommunity();
});

document.addEventListener('click', async (e) => {
  const copyButton = e.target.closest('[data-copy-group]');
  if (!copyButton) return;
  const number = copyButton.dataset.copyGroup;
  if (!number) return;
  const originalText = copyButton.textContent;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(number);
    } else {
      const input = document.createElement('textarea');
      input.value = number;
      input.setAttribute('readonly', '');
      input.style.position = 'fixed';
      input.style.opacity = '0';
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      input.remove();
    }
    copyButton.textContent = '已复制';
    showToast('群号已复制。');
    window.setTimeout(() => { copyButton.textContent = originalText; }, 1800);
  } catch {
    showToast(`复制失败，请手动输入：${number}`, 'error');
  }
});

function openAdmin() {
  if (els.adminModal) els.adminModal.hidden = false;
  document.body.style.overflow = 'hidden';
  if (state.adminKey) loadAdmin(false);
  else els.adminKey?.focus();
}
function closeAdmin() {
  if (els.adminModal) els.adminModal.hidden = true;
  document.body.style.overflow = '';
}

els.adminOpen?.addEventListener('click', openAdmin);
els.adminClose?.addEventListener('click', closeAdmin);
els.adminModal?.addEventListener('click', (e) => { if (e.target === els.adminModal) closeAdmin(); });

els.adminLoginForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const key = els.adminKey.value.trim();
  if (!key) return setMessage(els.adminLoginMessage, '请输入管理密钥。', true);
  state.adminKey = key;
  const ok = await loadAdmin(true);
  if (ok) {
    localStorage.setItem('flycode-admin-key', key);
    setMessage(els.adminLoginMessage, '');
    showToast('已进入项目工作台。');
    // Bug修复 #2: 登录后刷新提案列表，让删除按钮立即显示
    filterProposals(state.currentFilterTag);
  } else {
    state.adminKey = '';
  }
});

els.adminLogout?.addEventListener('click', () => {
  resetAdminSession('', false);
  if (els.adminKey) els.adminKey.value = '';
  showToast('已退出工作台。');
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (els.communityModal && !els.communityModal.hidden) closeCommunity();
  if (els.adminModal && !els.adminModal.hidden) closeAdmin();
});

els.adminRefresh?.addEventListener('click', async () => {
  if (!state.adminKey) return;
  els.adminRefresh.disabled = true;
  try {
    if (await loadAdmin(true)) {
      await loadPublic(false);
      showToast('工作台已刷新。');
    }
  } finally {
    els.adminRefresh.disabled = false;
  }
});

els.decisionSubmit?.addEventListener('click', async () => {
  const proposalId = els.decisionProposal?.value;
  if (!proposalId) return showToast('请先选择一个提案。', 'error');
  els.decisionSubmit.disabled = true;
  try {
    const res = await api('/api/admin/decision', {
      method: 'POST',
      headers: { 'X-Admin-Key': state.adminKey },
      body: JSON.stringify({ proposalId, note: els.decisionNote?.value || '' })
    });
    if (res.ok) {
      if (els.decisionNote) els.decisionNote.value = '';
      showToast('本轮决定已公布。');
      await loadAdmin(false);
      await loadPublic(false);
    } else {
      showToast(res.error || '公布失败', 'error');
    }
  } finally {
    els.decisionSubmit.disabled = false;
  }
});

els.updateForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const res = await api('/api/admin/updates', {
    method: 'POST',
    headers: { 'X-Admin-Key': state.adminKey },
    body: JSON.stringify({ title: els.updateTitle?.value || '', body: els.updateBody?.value || '' })
  });
  if (res.ok) {
    els.updateForm.reset();
    setMessage(els.updateMessage, '进展已发布。');
    await loadAdmin(false);
    await loadPublic(false);
  } else {
    setMessage(els.updateMessage, res.error || '发布失败', true);
  }
});

els.phaseForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const res = await api('/api/admin/phases', {
    method: 'POST',
    headers: { 'X-Admin-Key': state.adminKey },
    body: JSON.stringify({
      title: els.phaseTitle?.value || '',
      question: els.phaseQuestion?.value || '',
      deadline: els.phaseDeadlineInput?.value || ''
    })
  });
  if (res.ok) {
    els.phaseForm.reset();
    setMessage(els.phaseMessage, '新阶段已经开启。');
    await loadAdmin(false);
    await loadPublic(false);
  } else {
    setMessage(els.phaseMessage, res.error || '创建失败', true);
  }
});

els.exportData?.addEventListener('click', async () => {
  const res = await api('/api/admin/backup', { headers: { 'X-Admin-Key': state.adminKey } });
  if (!res.ok) return showToast(res.error || '导出失败', 'error');
  const blob = new Blob([JSON.stringify(res, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `flycode-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
  showToast('项目数据已导出。');
});

document.querySelectorAll('.review-tab').forEach(tabBtn => {
  tabBtn.addEventListener('click', () => {
    document.querySelectorAll('.review-tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.review-pane').forEach(p => { p.hidden = true; p.classList.remove('active'); });
    tabBtn.classList.add('active');
    const pane = document.querySelector(`.review-pane[data-review-pane="${tabBtn.dataset.reviewTab}"]`);
    if (pane) { pane.hidden = false; pane.classList.add('active'); }
  });
});

document.addEventListener('change', (e) => {
  const box = e.target.closest('.proposal-checkbox');
  if (!box) return;
  const type = box.dataset.type;
  const id = box.dataset.id;
  if (!selectedProposals[type] || !id) return;
  if (box.checked) selectedProposals[type].add(id);
  else selectedProposals[type].delete(id);
  updateBatchButtons();
});

function bindSelectAll(checkbox, type) {
  checkbox?.addEventListener('change', () => {
    const boxes = document.querySelectorAll(`.proposal-checkbox[data-type="${type}"]`);
    selectedProposals[type].clear();
    boxes.forEach((box) => {
      box.checked = checkbox.checked;
      if (checkbox.checked) selectedProposals[type].add(box.dataset.id);
    });
    updateBatchButtons();
  });
}
bindSelectAll(els.selectAllPending, 'pending');
bindSelectAll(els.selectAllRejected, 'rejected');

els.batchApprove?.addEventListener('click', () => runBatch('approve', 'pending'));
els.batchReject?.addEventListener('click', () => runBatch('reject', 'pending'));
els.batchDeletePending?.addEventListener('click', () => runBatch('delete', 'pending'));
els.batchRereview?.addEventListener('click', () => runBatch('rereview', 'rejected'));
els.batchDeleteRejected?.addEventListener('click', () => runBatch('delete', 'rejected'));

function init3DTilt(element, maxTilt = 8) {
  if (!element) return;
  // 手机触控屏幕禁用鼠标倾斜，避免手滑滚动时看板歪斜变形
  if ('ontouchstart' in window || navigator.maxTouchPoints > 0) return;

  element.addEventListener('mousemove', (e) => {
    const rect = element.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = ((y - centerY) / centerY) * -maxTilt;
    const rotateY = ((x - centerX) / centerX) * maxTilt;
    element.style.transform = `perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) translateZ(6px)`;
  });
  element.addEventListener('mouseleave', () => {
    element.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateZ(0px)';
  });
}
const mainBoard = document.querySelector('#main-question-board');
if (mainBoard) init3DTilt(mainBoard, 6);

loadDraft();
loadPublic();
// Bug修复 #4: 页面加载时如果localStorage有adminKey，自动尝试登录
if (state.adminKey) {
  loadAdmin(false);
}

// Bug修复 #7: 智能自动刷新 - 避免用户输入时刷新
let lastInteractionTime = Date.now();

// 监听用户交互，更新最后交互时间
['input', 'focus', 'click'].forEach(eventType => {
  document.addEventListener(eventType, (e) => {
    if (e.target.classList.contains('wx-name-input') || 
        e.target.classList.contains('wx-text-input')) {
      lastInteractionTime = Date.now();
    }
  }, true);
});

window.setInterval(() => {
  // 如果用户最近5秒内有交互，跳过刷新
  const timeSinceLastInteraction = Date.now() - lastInteractionTime;
  if (timeSinceLastInteraction < 5000) {
    console.log('用户最近有交互，跳过自动刷新');
    return;
  }
  
  // 检查是否有焦点在输入框
  const activeElement = document.activeElement;
  const isTyping = activeElement && (
    activeElement.classList.contains('wx-name-input') || 
    activeElement.classList.contains('wx-text-input')
  );
  
  if (!isTyping) {
    loadPublic(false);
  }
}, 15000);

document.addEventListener('click', (e) => {
  const trigger = e.target.closest('[data-scroll-to]');
  if (!trigger) return;
  e.preventDefault();
  const targetId = trigger.dataset.scrollTo;
  const targetEl = document.getElementById(targetId);
  if (targetEl) {
    targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
});

// Bug修复 #8: 导航栏激活状态根据滚动位置动态更新
function updateNavActiveState() {
  const sections = [
    { id: 'overview', link: document.querySelector('a[href="#overview"]') },
    { id: 'participate', link: document.querySelector('a[href="#participate"]') },
    { id: 'timeline', link: document.querySelector('a[href="#timeline"]') },
    { id: 'community', link: document.querySelector('a[href="#community"]') }
  ];
  
  let currentSection = 'overview';
  const scrollPos = window.scrollY + 100;
  
  sections.forEach(section => {
    const el = document.getElementById(section.id);
    if (el && scrollPos >= el.offsetTop) {
      currentSection = section.id;
    }
  });
  
  sections.forEach(section => {
    if (section.link) {
      if (section.id === currentSection) {
        section.link.classList.add('active');
      } else {
        section.link.classList.remove('active');
      }
    }
  });
}

// 监听滚动和导航点击
window.addEventListener('scroll', updateNavActiveState);
document.querySelectorAll('.nav-link[href^="#"]').forEach(link => {
  link.addEventListener('click', () => {
    setTimeout(updateNavActiveState, 100);
  });
});

// 页面加载时初始化
updateNavActiveState();
