const state = {
  public: null,
  admin: null,
  adminKey: sessionStorage.getItem('flycode-admin-key') || '',
  visitorId: localStorage.getItem('flycode-visitor-id') || createVisitorId()
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
    ...(options.headers || {})
  };
  if (state.adminKey) {
    headers['x-flycode-admin-key'] = state.adminKey;
  }
  const res = await fetch(path, { credentials: 'same-origin', ...options, headers });
  const data = await res.json().catch(() => ({ ok: false, error: '网络返回异常' }));
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
  const res = await api(`/api/state?visitor_id=${encodeURIComponent(state.visitorId)}`);
  if (!res.ok) {
    if (els.lastSync && showFeedback) els.lastSync.textContent = '已同步 · 离线模式';
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

  const currentPhase = data.current_phase || {};
  if (els.roundNumber) els.roundNumber.textContent = `第 ${String(currentPhase.id || 1).padStart(2, '0')} 轮`;
  if (els.roundStatus) els.roundStatus.textContent = statusText[currentPhase.status] || currentPhase.status || '进行中';
  if (els.boardPhaseId) els.boardPhaseId.textContent = `${String(currentPhase.id || 1).padStart(2, '0')} / ${String(data.summary?.total_rounds || 1).padStart(2, '0')}`;
  if (els.currentQuestion) els.currentQuestion.textContent = currentPhase.question || '你希望它先做什么？';
  if (els.currentPhaseDescription) els.currentPhaseDescription.textContent = currentPhase.title || '提出一个具体想法，告诉我们为什么它值得优先考虑。';
  if (els.phaseDeadline) els.phaseDeadline.textContent = currentPhase.deadline ? formatDate(currentPhase.deadline) : '开放中';
  if (els.phaseState) els.phaseState.textContent = statusText[currentPhase.status] || currentPhase.status || '提案收集中';

  if (els.roundTrackFill) {
    const progressMap = { submitting: '33%', voting: '66%', execution: '100%', archived: '100%' };
    els.roundTrackFill.style.width = progressMap[currentPhase.status] || '33%';
  }

  if (els.statProposals) els.statProposals.textContent = data.summary?.total_proposals ?? (data.proposals || []).length;
  if (els.statParticipants) els.statParticipants.textContent = data.summary?.total_participants ?? 0;
  if (els.statRounds) els.statRounds.textContent = data.summary?.total_rounds ?? 1;

  renderProposals(data.proposals || [], currentPhase.status);
  renderDecision(currentPhase);
  renderTimeline(data.timeline || []);
}

function renderProposals(proposals, phaseStatus) {
  if (!els.proposalList) return;
  const isVoting = phaseStatus === 'voting';
  if (els.proposalCountLabel) els.proposalCountLabel.textContent = `${proposals.length} 个公开提案`;
  if (els.listModeLabel) els.listModeLabel.textContent = isVoting ? '按投票热度排序' : '按最新提交排序';

  if (proposals.length === 0) {
    els.proposalList.innerHTML = '';
    if (els.proposalEmpty) els.proposalEmpty.hidden = false;
    return;
  }

  if (els.proposalEmpty) els.proposalEmpty.hidden = true;
  els.proposalList.innerHTML = proposals.map((p, idx) => {
    const voted = Boolean(p.user_has_voted);
    const voteBtn = isVoting
      ? `<div class="proposal-vote">
          <button class="vote-btn ${voted ? 'active' : ''}" type="button" data-vote-id="${escapeHtml(p.id)}">
            <span aria-hidden="true">${voted ? '✓' : '▲'}</span>
            <span>${p.votes || 0}</span>
          </button>
        </div>`
      : `<div class="proposal-vote"><span class="proposal-index">#${String(idx + 1).padStart(2, '0')}</span></div>`;

    const linkHtml = p.link ? `<a class="proposal-link-pill" href="${escapeHtml(p.link)}" target="_blank" rel="noopener noreferrer">参考链接 ↗</a>` : '';

    return `<article class="proposal-card" data-card-id="${escapeHtml(p.id)}">
      <span class="proposal-index">0${idx + 1}</span>
      <div class="proposal-body">
        <h3>${escapeHtml(p.title)}</h3>
        <p>${escapeHtml(p.description)}</p>
        <div class="proposal-meta">
          <span class="proposal-author">${escapeHtml(p.author || '匿名共创者')}</span>
          <span>${formatRelative(p.created_at)}</span>
          ${linkHtml}
        </div>
      </div>
      ${voteBtn}
    </article>`;
  }).join('');
}

function renderDecision(phase) {
  if (!els.decisionSection || !els.decisionStrip) return;
  if (!phase.decision && phase.status !== 'execution' && phase.status !== 'archived') {
    els.decisionSection.hidden = true;
    return;
  }
  els.decisionSection.hidden = false;
  els.decisionStrip.innerHTML = `<div class="decision-item">
    <div class="decision-badge">EXECUTING</div>
    <div class="decision-content">
      <h3>${escapeHtml(phase.decision_title || phase.title || '本轮执行目标')}</h3>
      <p>${escapeHtml(phase.decision_note || phase.question || '正在全力研发落地中。')}</p>
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
      <time class="timeline-date">${formatDate(entry.created_at)}</time>
      <div class="timeline-body">
        <h3>${escapeHtml(entry.title)}</h3>
        <p>${escapeHtml(entry.body)}</p>
      </div>
    </article>
  `).join('');
}

els.proposalList?.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-vote-id]');
  if (!btn) return;
  const id = btn.dataset.voteId;
  btn.disabled = true;

  createRipple(e, btn);

  const res = await api('/api/vote', {
    method: 'POST',
    body: JSON.stringify({ proposal_id: id, visitor_id: state.visitorId })
  });
  if (res.ok) {
    spawnVoteFlyParticle(e.clientX, e.clientY);
    showToast(res.message || '投票已记录！');
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
if (cursorGlow) {
  window.addEventListener('mousemove', (e) => {
    cursorGlow.style.left = `${e.clientX}px`;
    cursorGlow.style.top = `${e.clientY}px`;
  });
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

async function loadAdmin(showFeedback = true) {
  const res = await api('/api/admin/state');
  if (!res.ok) return false;
  state.admin = res;
  renderAdmin();
  return true;
}

function renderAdmin() {
  if (!state.admin) return;
  els.adminLoginView.hidden = true;
  els.adminDashboard.hidden = false;

  const sum = state.admin.summary || {};
  if (els.adminSummary) {
    els.adminSummary.innerHTML = `
      <div class="admin-summary-item"><strong>${sum.pending || 0}</strong><span>待审核</span></div>
      <div class="admin-summary-item"><strong>${sum.approved || 0}</strong><span>已公开</span></div>
      <div class="admin-summary-item"><strong>${sum.rejected || 0}</strong><span>未采用</span></div>
      <div class="admin-summary-item"><strong>${sum.votes || 0}</strong><span>总投票</span></div>
    `;
  }

  renderReviewList('pending', state.admin.pending_proposals || []);
  renderReviewList('approved', state.admin.approved_proposals || []);
  renderReviewList('rejected', state.admin.rejected_proposals || []);

  if (els.pendingTabCount) els.pendingTabCount.textContent = (state.admin.pending_proposals || []).length;
  if (els.approvedTabCount) els.approvedTabCount.textContent = (state.admin.approved_proposals || []).length;
  if (els.rejectedTabCount) els.rejectedTabCount.textContent = (state.admin.rejected_proposals || []).length;
}

function renderReviewList(tab, list) {
  const container = tab === 'pending' ? els.adminProposals : (tab === 'approved' ? els.approvedProposals : els.rejectedProposals);
  if (!container) return;

  if (list.length === 0) {
    container.innerHTML = '<p class="admin-empty">这里没有提案。</p>';
    return;
  }

  container.innerHTML = list.map(p => `
    <div class="admin-proposal-row review-proposal-row" data-row-id="${escapeHtml(p.id)}">
      <input type="checkbox" class="proposal-checkbox" data-tab="${tab}" data-id="${escapeHtml(p.id)}">
      <div>
        <div class="review-proposal-topline">
          <span class="review-status ${p.status}">${statusText[p.status] || p.status}</span>
          <strong>${escapeHtml(p.title)}</strong>
        </div>
        <p class="proposal-desc">${escapeHtml(p.description)}</p>
      </div>
      <div class="admin-row-actions">
        ${tab === 'pending' ? `
          <button class="small-button approve" type="button" data-action="approve" data-id="${escapeHtml(p.id)}">通过</button>
          <button class="small-button reject" type="button" data-action="reject" data-id="${escapeHtml(p.id)}">不采用</button>
        ` : (tab === 'rejected' ? `
          <button class="small-button approve" type="button" data-action="approve" data-id="${escapeHtml(p.id)}">重新通过</button>
        ` : `
          <button class="small-button reject" type="button" data-action="reject" data-id="${escapeHtml(p.id)}">下架</button>
        `)}
        <button class="small-button danger" type="button" data-action="delete" data-id="${escapeHtml(p.id)}">删除</button>
      </div>
    </div>
  `).join('');
}

document.addEventListener('click', async (e) => {
  const btn = e.target.closest('.admin-row-actions button');
  if (!btn) return;
  const action = btn.dataset.action;
  const id = btn.dataset.id;
  if (!action || !id) return;

  let res;
  if (action === 'approve') {
    res = await api('/api/admin/proposals/moderate', { method: 'POST', body: JSON.stringify({ ids: [id], action: 'approve' }) });
  } else if (action === 'reject') {
    res = await api('/api/admin/proposals/moderate', { method: 'POST', body: JSON.stringify({ ids: [id], action: 'reject' }) });
  } else if (action === 'delete') {
    if (!confirm('确定永久删除这条提案吗？')) return;
    res = await api('/api/admin/proposals/moderate', { method: 'POST', body: JSON.stringify({ ids: [id], action: 'delete' }) });
  }

  if (res?.ok) {
    showToast('操作已完成。');
    await loadAdmin(false);
    await loadPublic(false);
  } else {
    showToast(res?.error || '操作失败', 'error');
  }
});

function openAdmin() {
  if (els.adminModal) els.adminModal.hidden = false;
  if (state.adminKey) loadAdmin(false);
}
function closeAdmin() {
  if (els.adminModal) els.adminModal.hidden = true;
}

els.adminOpen?.addEventListener('click', openAdmin);
els.adminClose?.addEventListener('click', closeAdmin);
els.adminModal?.addEventListener('click', (e) => { if (e.target === els.adminModal) closeAdmin(); });

els.adminLoginForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const key = els.adminKey.value.trim();
  if (!key) return setMessage(els.adminLoginMessage, '请输入管理密钥。', true);
  state.adminKey = key;
  const ok = await loadAdmin(false);
  if (ok) {
    sessionStorage.setItem('flycode-admin-key', key);
    setMessage(els.adminLoginMessage, '');
    showToast('已进入项目工作台。');
  } else {
    state.adminKey = '';
    setMessage(els.adminLoginMessage, '管理密钥不正确。', true);
  }
});

els.adminLogout?.addEventListener('click', () => {
  state.adminKey = '';
  state.admin = null;
  sessionStorage.removeItem('flycode-admin-key');
  els.adminLoginView.hidden = false;
  els.adminDashboard.hidden = true;
  els.adminKey.value = '';
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

function init3DTilt(element, maxTilt = 8) {
  if (!element) return;
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
window.setInterval(() => loadPublic(false), 15000);

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
