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

  renderProposals(data.proposals || [], currentPhase.status, currentPhase);
  renderDecision(currentPhase, data.proposals || []);
  renderTimeline(data.updates || []);
}

function renderProposals(proposals, phaseStatus, phase) {
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
      </div>
      ${voteBtn}
    </article>`;
  }).join('');
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
  sessionStorage.removeItem('flycode-admin-key');
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
    sessionStorage.setItem('flycode-admin-key', key);
    setMessage(els.adminLoginMessage, '');
    showToast('已进入项目工作台。');
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
  if (e.key === 'Escape' && els.adminModal && !els.adminModal.hidden) closeAdmin();
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
