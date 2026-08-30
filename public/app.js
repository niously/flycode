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
const originalSubmitText = '提交提案 <span aria-hidden="true">↗</span>';
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

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[character]));
}

function formatDate(value, withYear = false) {
  if (!value) return '开放中';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('zh-CN', {
    year: withYear ? 'numeric' : undefined,
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

function formatDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(date);
}

function currentPhase() {
  return state.public?.currentPhase || state.admin?.currentPhase;
}

async function api(path, options = {}) {
  const headers = {
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    'X-Visitor-Id': state.visitorId,
    ...(options.headers || {})
  };
  const response = await fetch(path, { ...options, headers });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `请求失败（${response.status}）`);
  return payload;
}

async function loadPublic(showError = true) {
  try {
    state.public = await api('/api/state');
    renderPublic();
    if (state.adminKey && (!state.admin || !els.adminModal.hidden)) await loadAdmin(false);
  } catch (error) {
    if (showError) showToast(error.message, true);
  }
}

async function loadAdmin(showError = true) {
  if (!state.adminKey) return false;
  try {
    state.admin = await api('/api/admin/state', { headers: { 'X-Admin-Key': state.adminKey } });
    renderAdmin();
    return true;
  } catch (error) {
    state.admin = null;
    sessionStorage.removeItem('flycode-admin-key');
    state.adminKey = '';
    if (showError) setMessage(els.adminLoginMessage, error.message, true);
    return false;
  }
}

function renderPublic() {
  const data = state.public;
  if (!data) return;
  const phase = data.currentPhase;
  const proposals = data.proposals || [];
  const phaseNumber = String(phase?.number || 1).padStart(2, '0');
  const isVoting = phase?.status === 'voting';
  const chosen = phase?.chosenProposalId ? proposals.find((item) => item.id === phase.chosenProposalId) : null;

  els.roundNumber.textContent = `ROUND ${phaseNumber}`;
  els.roundStatus.textContent = statusText[phase?.status] || phase?.status || '准备中';
  els.roundTrackFill.style.width = `${phaseProgress(phase?.status)}%`;
  els.boardPhaseId.textContent = `${phaseNumber} / ${String(data.phases?.length || 1).padStart(2, '0')}`;
  els.currentQuestion.textContent = phase?.question || '下一步想让 Flycode 做什么？';
  els.currentPhaseDescription.textContent = isVoting
    ? '候选提案已经整理好，请选出你认为最值得先做的一个。'
    : phase?.status === 'execution'
      ? '这一轮已经做出决定，接下来会把选择变成真实的改变。'
      : '提出一个具体的功能、内容或发展方向，告诉我们为什么它值得优先考虑。';
  els.phaseDeadline.textContent = phase?.deadline ? formatDate(phase.deadline) : '开放中';
  els.phaseState.textContent = statusText[phase?.status] || '准备中';
  els.statProposals.textContent = data.stats?.proposalCount ?? proposals.length;
  els.statParticipants.textContent = data.stats?.participantCount ?? 0;
  els.statRounds.textContent = data.stats?.completedRounds || 1;
  els.proposalCountLabel.textContent = `${proposals.length} 个公开提案`;
  els.listModeLabel.textContent = isVoting ? '投票阶段已开启' : '按最新提交排序';
  els.lastSync.textContent = `最近更新 ${new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit' }).format(new Date())}`;

  renderProposals(proposals, isVoting, phase);
  renderDecision(chosen, phase);
  renderTimeline(data.updates || []);
  updateSubmissionAvailability(phase);
}

function phaseProgress(status) {
  return { submitting: 25, voting: 52, execution: 78, archived: 100 }[status] || 15;
}

function updateSubmissionAvailability(phase) {
  const open = phase?.status === 'submitting';
  const inputs = els.proposalForm.querySelectorAll('input:not(.honeypot), textarea');
  inputs.forEach((input) => { input.disabled = !open; });
  els.proposalSubmit.disabled = !open;
  if (!open) {
    els.proposalSubmit.innerHTML = `${escapeHtml(statusText[phase?.status] || '本轮已关闭')} <span aria-hidden="true">·</span>`;
  } else {
    els.proposalSubmit.innerHTML = originalSubmitText;
  }
}

function updateCharCounters() {
  const titleLength = els.proposalTitle.value.length;
  const descLength = els.proposalDescription.value.length;
  els.titleCounter.textContent = `${titleLength}/80`;
  els.descriptionCounter.textContent = `${descLength}/1200${descLength < 10 ? ' · 至少 10 个字' : ''}`;
  els.descriptionCounter.style.color = descLength < 10 ? 'var(--coral)' : '';
}

function saveDraft() {
  const draft = {
    title: els.proposalTitle.value,
    description: els.proposalDescription.value,
    author: document.querySelector('#proposal-author').value,
    link: document.querySelector('#proposal-link').value,
    savedAt: Date.now()
  };
  if (draft.title || draft.description) {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  }
}

function loadDraft() {
  const saved = localStorage.getItem(DRAFT_KEY);
  if (!saved) return;
  try {
    const draft = JSON.parse(saved);
    const age = Date.now() - draft.savedAt;
    if (age > 7 * 24 * 60 * 60 * 1000) {
      localStorage.removeItem(DRAFT_KEY);
      return;
    }
    if (draft.title || draft.description) {
      els.proposalTitle.value = draft.title || '';
      els.proposalDescription.value = draft.description || '';
      document.querySelector('#proposal-author').value = draft.author || '';
      document.querySelector('#proposal-link').value = draft.link || '';
      updateCharCounters();
      showToast('已恢复上次未提交的草稿');
    }
  } catch {
    localStorage.removeItem(DRAFT_KEY);
  }
}

function clearDraft() {
  localStorage.removeItem(DRAFT_KEY);
}

function updateBatchActionsState() {
  const pendingCount = selectedProposals.pending.size;
  const rejectedCount = selectedProposals.rejected.size;
  if (els.batchApprove) els.batchApprove.disabled = pendingCount === 0;
  if (els.batchReject) els.batchReject.disabled = pendingCount === 0;
  if (els.batchDeletePending) els.batchDeletePending.disabled = pendingCount === 0;
  if (els.batchRereview) els.batchRereview.disabled = rejectedCount === 0;
  if (els.batchDeleteRejected) els.batchDeleteRejected.disabled = rejectedCount === 0;
  if (els.selectAllPending) els.selectAllPending.checked = pendingCount > 0 && pendingCount === els.adminProposals.querySelectorAll('.proposal-checkbox').length;
  if (els.selectAllRejected) els.selectAllRejected.checked = rejectedCount > 0 && rejectedCount === els.rejectedProposals.querySelectorAll('.proposal-checkbox').length;
}

async function batchReviewAction(action, ids, message) {
  if (!ids.length) return;
  if (!window.confirm(`确定要${message} ${ids.length} 个提案吗？`)) return;
  try {
    await api('/api/admin/proposals/batch', {
      method: 'POST',
      headers: { 'X-Admin-Key': state.adminKey },
      body: JSON.stringify({ ids, action })
    });
    selectedProposals.pending.clear();
    selectedProposals.rejected.clear();
    showToast(`已${message} ${ids.length} 个提案。`);
    await loadAdmin(false);
    state.public = await api('/api/state');
    renderPublic();
  } catch (error) {
    showToast(error.message, true);
  }
}

function renderReviewList(container, proposals, type) {
  if (!proposals.length) {
    container.innerHTML = '<p class="admin-empty review-empty">这里暂时没有提案。</p>';
    return;
  }
  container.innerHTML = proposals.map((proposal, index) => `
    <article class="admin-proposal-row review-proposal-row">
      ${type === 'pending' || type === 'rejected' ? `<label class="review-check"><input type="checkbox" class="proposal-checkbox" data-type="${type}" data-id="${escapeHtml(proposal.id)}" ${selectedProposals[type].has(proposal.id) ? 'checked' : ''}><span class="sr-only">选择 ${escapeHtml(proposal.title)}</span></label>` : '<span class="review-check-spacer" aria-hidden="true"></span>'}
      <div class="review-proposal-content">
        <div class="review-proposal-topline"><span class="proposal-number">${String(index + 1).padStart(2, '0')}</span><span class="review-status ${type}">${statusText[type]}</span></div>
        <h4>${escapeHtml(proposal.title)}</h4>
        <p>${escapeHtml(proposal.description)}</p>
        <div class="proposal-meta"><span>${escapeHtml(proposal.author || '匿名参与者')}</span><span>${formatDateTime(proposal.createdAt)}</span></div>
      </div>
      ${type === 'pending' ? '<div class="admin-row-actions"><button class="small-button approve" type="button" data-review-id="' + escapeHtml(proposal.id) + '" data-review-status="approved">通过</button><button class="small-button reject" type="button" data-review-id="' + escapeHtml(proposal.id) + '" data-review-status="rejected">不采用</button></div>' : ''}
    </article>`).join('');
}

function renderAdminProposals(proposals) {
  const pending = proposals.filter((proposal) => proposal.status === 'pending');
  const approved = proposals.filter((proposal) => proposal.status === 'approved');
  const rejected = proposals.filter((proposal) => proposal.status === 'rejected');
  const pendingIds = new Set(pending.map((proposal) => proposal.id));
  const rejectedIds = new Set(rejected.map((proposal) => proposal.id));
  selectedProposals.pending.forEach((id) => {
    if (!pendingIds.has(id)) selectedProposals.pending.delete(id);
  });
  selectedProposals.rejected.forEach((id) => {
    if (!rejectedIds.has(id)) selectedProposals.rejected.delete(id);
  });
  els.pendingCount.textContent = `${pending.length} 条待处理`;
  if (els.pendingTabCount) els.pendingTabCount.textContent = pending.length;
  if (els.approvedTabCount) els.approvedTabCount.textContent = approved.length;
  if (els.rejectedTabCount) els.rejectedTabCount.textContent = rejected.length;
  renderReviewList(els.adminProposals, pending, 'pending');
  renderReviewList(els.approvedProposals, approved, 'approved');
  renderReviewList(els.rejectedProposals, rejected, 'rejected');
  updateBatchActionsState();
}

function renderProposals(proposals, isVoting, phase) {
  els.proposalList.innerHTML = '';
  els.proposalEmpty.hidden = proposals.length > 0;
  if (!proposals.length) return;

  const candidateIds = new Set(state.public?.voting?.candidateIds || phase?.candidates || []);
  const alreadyVoted = Boolean(state.public?.voting?.hasVoted || localStorage.getItem(`flycode-voted-${phase.id}`));
  proposals.forEach((proposal, index) => {
    const card = document.createElement('article');
    const candidate = isVoting && candidateIds.has(proposal.id);
    card.className = 'proposal-card';
    card.innerHTML = `
      <div class="proposal-number">${String(index + 1).padStart(2, '0')}</div>
      <div>
        <h3>${escapeHtml(proposal.title)}</h3>
        <p>${escapeHtml(proposal.description)}</p>
        ${proposal.link ? `<a class="proposal-link" href="${escapeHtml(proposal.link)}" target="_blank" rel="noreferrer">查看参考链接 ↗</a>` : ''}
        <div class="proposal-meta"><span class="proposal-status ${candidate ? 'active' : ''}">${candidate ? '本轮候选' : '已公开'}</span><span>由 ${escapeHtml(proposal.author || '匿名参与者')} 提出</span><span>${formatDateTime(proposal.createdAt)}</span></div>
      </div>
      <div class="proposal-vote">
        <span class="vote-count">${proposal.voteCount || 0} 票</span>
        ${candidate ? `<button class="vote-button" type="button" data-vote-id="${escapeHtml(proposal.id)}" ${alreadyVoted ? 'disabled' : ''}>${alreadyVoted ? '本轮已投票' : '投给它'}</button>` : ''}
      </div>`;
    els.proposalList.appendChild(card);
  });
}

function renderDecision(chosen, phase) {
  if (!chosen || !phase?.decidedAt) {
    els.decisionSection.hidden = true;
    els.decisionStrip.innerHTML = '';
    return;
  }
  els.decisionSection.hidden = false;
  els.decisionStrip.innerHTML = `
    <div class="decision-item">
      <div class="proposal-number">${String(phase.number).padStart(2, '0')}</div>
      <div><h3>${escapeHtml(chosen.title)}</h3><p>${escapeHtml(phase.decisionNote || '本轮决定已公布，项目进入执行阶段。')}</p></div>
      <span class="decision-badge">已进入执行</span>
    </div>`;
}

function renderTimeline(updates) {
  if (!updates.length) {
    els.timelineList.innerHTML = '<p class="admin-empty">还没有成长记录。</p>';
    return;
  }
  els.timelineList.innerHTML = updates.map((update) => `
    <article class="timeline-entry">
      <time class="timeline-date">${formatDateTime(update.createdAt)}</time>
      <div><h3>${escapeHtml(update.title)}</h3><p>${escapeHtml(update.body)}</p></div>
    </article>`).join('');
}

function renderAdmin() {
  const data = state.admin;
  if (!data) return;
  els.adminLoginView.hidden = true;
  els.adminDashboard.hidden = false;
  const allProposals = data.allProposals || [];
  const pending = allProposals.filter((proposal) => proposal.status === 'pending');
  const approved = allProposals.filter((proposal) => proposal.status === 'approved');
  const rejected = allProposals.filter((proposal) => proposal.status === 'rejected');
  const phase = data.currentPhase;
  els.adminSummary.innerHTML = `
    <div class="admin-summary-item"><strong>${allProposals.length}</strong><span>全部提案</span></div>
    <div class="admin-summary-item"><strong>${pending.length}</strong><span>待审核</span></div>
    <div class="admin-summary-item"><strong>${data.stats?.participantCount || 0}</strong><span>投票参与者</span></div>`;
  els.adminCurrentStatus.textContent = statusText[phase?.status] || '';
  renderAdminProposals(allProposals);
  renderPhaseActions(phase, data);
}

function renderPhaseActions(phase, data) {
  if (!phase) return;
  const approved = (data.allProposals || []).filter((proposal) => proposal.phaseId === phase.id && proposal.status === 'approved');
  const candidateIds = data.voting?.candidateIds || phase.candidates || [];
  const candidates = data.decisionCandidates?.length
    ? data.decisionCandidates
    : candidateIds.length
      ? approved.filter((proposal) => candidateIds.includes(proposal.id))
      : approved;
  els.phaseActions.innerHTML = '';
  els.decisionForm.hidden = true;
  if (phase.status === 'submitting') {
    els.phaseActions.innerHTML = `<button class="phase-action" type="button" data-phase-status="voting" ${approved.length ? '' : 'disabled'}>审核完成，开启投票</button><span class="admin-empty">${approved.length ? `已有 ${approved.length} 个通过的提案` : '至少通过一个提案后才能开启投票'}</span>`;
  } else if (phase.status === 'voting') {
    els.phaseActions.innerHTML = candidates.length
      ? '<span class="admin-empty">投票进行中。选择一个候选提案并公布决定。</span><button class="phase-action secondary" type="button" data-withdraw-voting>撤回投票，重新审核</button>'
      : '<span class="admin-empty error">当前没有可决定的候选提案，请刷新工作台并检查已公开提案。</span>';
    els.decisionForm.hidden = candidates.length === 0;
    els.decisionProposal.innerHTML = candidates.length
      ? candidates.map((proposal) => `<option value="${escapeHtml(proposal.id)}">${escapeHtml(proposal.title)}（${proposal.voteCount || 0} 票）</option>`).join('')
      : '<option value="">暂无可选提案</option>';
  } else if (phase.status === 'execution') {
    els.phaseActions.innerHTML = '<span class="admin-empty">本轮已进入执行阶段。完成后可以归档并开启下一轮。</span><button class="phase-action secondary" type="button" data-phase-status="archived">归档本轮</button>';
  } else {
    els.phaseActions.innerHTML = '<span class="admin-empty">本轮已归档。可以在下方创建新的阶段。</span>';
  }
}

function setMessage(element, message, isError = false) {
  element.textContent = message || '';
  element.classList.toggle('error', isError);
}

function showToast(message, isError = false) {
  const toast = document.createElement('div');
  toast.className = `toast${isError ? ' error' : ''}`;
  toast.textContent = message;
  els.toastStack.appendChild(toast);
  window.setTimeout(() => toast.remove(), 4200);
}

function openAdmin() {
  els.adminModal.hidden = false;
  document.body.style.overflow = 'hidden';
  if (state.adminKey) {
    loadAdmin(false).then((ok) => {
      if (!ok) {
        els.adminLoginView.hidden = false;
        els.adminDashboard.hidden = true;
        els.adminKey.focus();
      }
    });
  } else {
    els.adminLoginView.hidden = false;
    els.adminDashboard.hidden = true;
    window.setTimeout(() => els.adminKey.focus(), 50);
  }
}

function closeAdmin() {
  els.adminModal.hidden = true;
  document.body.style.overflow = '';
}

async function handleProposalSubmit(event) {
  event.preventDefault();
  if (!state.public?.currentPhase || state.public.currentPhase.status !== 'submitting') {
    return showToast('当前阶段已经关闭提案提交。', true);
  }
  const formData = new FormData(els.proposalForm);
  const payload = Object.fromEntries(formData.entries());
  
  setMessage(els.proposalMessage, '正在提交...');
  els.proposalSubmit.disabled = true;
  els.proposalSubmit.innerHTML = '提交中... <span aria-hidden="true">⏳</span>';
  
  try {
    state.public = await api('/api/proposals', { method: 'POST', body: JSON.stringify(payload) });
    els.proposalForm.reset();
    clearDraft();
    updateCharCounters();
    setMessage(els.proposalMessage, '✓ 已收到你的提案！审核通过后会出现在公开列表中。');
    showToast('提案已提交，感谢参与。');
    renderPublic();
    if (state.adminKey) await loadAdmin(false);
    window.setTimeout(() => {
      els.proposalMessage.textContent = '';
    }, 8000);
  } catch (error) {
    setMessage(els.proposalMessage, error.message, true);
  } finally {
    updateSubmissionAvailability(currentPhase());
  }
}

async function handleVote(proposalId) {
  const phase = currentPhase();
  if (!phase) return;
  try {
    state.public = await api('/api/votes', { method: 'POST', body: JSON.stringify({ proposalId, visitorId: state.visitorId }) });
    localStorage.setItem(`flycode-voted-${phase.id}`, '1');
    showToast('投票已记录。');
    renderPublic();
    if (state.adminKey) await loadAdmin(false);
  } catch (error) {
    showToast(error.message, true);
    await loadPublic(false);
  }
}

async function refreshAdmin() {
  if (!state.adminKey || !els.adminRefresh) return;
  els.adminRefresh.disabled = true;
  try {
    if (await loadAdmin(true)) {
      await loadPublic(false);
      showToast('工作台已刷新。');
    }
  } finally {
    els.adminRefresh.disabled = false;
  }
}

async function reviewProposal(proposalId, status) {
  try {
    state.admin = await api('/api/admin/proposals/review', {
      method: 'POST',
      headers: { 'X-Admin-Key': state.adminKey },
      body: JSON.stringify({ proposalId, status })
    });
    state.public = await api('/api/state');
    renderPublic();
    renderAdmin();
    showToast(status === 'approved' ? '提案已通过并公开。' : '提案已标记为不采用。');
  } catch (error) {
    showToast(error.message, true);
  }
}

async function changePhaseStatus(status) {
  try {
    state.admin = await api('/api/admin/phase/status', {
      method: 'POST',
      headers: { 'X-Admin-Key': state.adminKey },
      body: JSON.stringify({ status })
    });
    state.public = await api('/api/state');
    renderPublic();
    renderAdmin();
    showToast(`阶段状态已更新为：${statusText[status]}`);
  } catch (error) {
    showToast(error.message, true);
  }
}

async function withdrawVoting() {
  if (!window.confirm('确定撤回本轮投票吗？当前候选提案会回到待审核，已经产生的票数会清零。')) return;
  try {
    state.admin = await api('/api/admin/phase/withdraw-voting', {
      method: 'POST',
      headers: { 'X-Admin-Key': state.adminKey },
      body: JSON.stringify({})
    });
    state.public = await api('/api/state');
    renderPublic();
    renderAdmin();
    showToast('投票已撤回，候选提案回到待审核。');
  } catch (error) {
    showToast(error.message, true);
  }
}

async function publishDecision() {
  const proposalId = els.decisionProposal.value;
  if (!proposalId) return showToast('请先选择一个提案。', true);
  els.decisionSubmit.disabled = true;
  try {
    state.admin = await api('/api/admin/decision', {
      method: 'POST',
      headers: { 'X-Admin-Key': state.adminKey },
      body: JSON.stringify({ proposalId, note: els.decisionNote.value })
    });
    state.public = await api('/api/state');
    els.decisionNote.value = '';
    renderPublic();
    renderAdmin();
    showToast('本轮决定已公布。');
  } catch (error) {
    showToast(error.message, true);
  } finally {
    els.decisionSubmit.disabled = false;
  }
}

async function publishUpdate(event) {
  event.preventDefault();
  try {
    state.admin = await api('/api/admin/updates', {
      method: 'POST',
      headers: { 'X-Admin-Key': state.adminKey },
      body: JSON.stringify({ title: els.updateTitle.value, body: els.updateBody.value })
    });
    state.public = await api('/api/state');
    els.updateForm.reset();
    setMessage(els.updateMessage, '进展已发布。');
    renderPublic();
    renderAdmin();
  } catch (error) {
    setMessage(els.updateMessage, error.message, true);
  }
}

async function createPhase(event) {
  event.preventDefault();
  try {
    state.admin = await api('/api/admin/phases', {
      method: 'POST',
      headers: { 'X-Admin-Key': state.adminKey },
      body: JSON.stringify({
        title: els.phaseTitle.value,
        question: els.phaseQuestion.value,
        deadline: els.phaseDeadlineInput.value
      })
    });
    state.public = await api('/api/state');
    els.phaseForm.reset();
    setMessage(els.phaseMessage, '新阶段已经开启。');
    renderPublic();
    renderAdmin();
  } catch (error) {
    setMessage(els.phaseMessage, error.message, true);
  }
}

function exportProjectData() {
  api('/api/admin/export', { headers: { 'X-Admin-Key': state.adminKey } }).then((data) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `flycode-export-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('项目数据已导出。');
  }).catch((error) => showToast(error.message, true));
}

els.proposalForm.addEventListener('submit', handleProposalSubmit);
els.proposalTitle.addEventListener('input', () => {
  updateCharCounters();
  saveDraft();
});
els.proposalDescription.addEventListener('input', () => {
  updateCharCounters();
  saveDraft();
});
document.querySelector('#proposal-author').addEventListener('input', saveDraft);
document.querySelector('#proposal-link').addEventListener('input', saveDraft);
els.proposalList.addEventListener('click', (event) => {
  const button = event.target.closest('[data-vote-id]');
  if (button) handleVote(button.dataset.voteId);
});
els.adminProposals.addEventListener('click', (event) => {
  const checkbox = event.target.closest('.proposal-checkbox');
  if (checkbox) {
    const type = checkbox.dataset.type;
    const id = checkbox.dataset.id;
    if (checkbox.checked) selectedProposals[type].add(id);
    else selectedProposals[type].delete(id);
    updateBatchActionsState();
    return;
  }
  const button = event.target.closest('[data-review-id]');
  if (button) reviewProposal(button.dataset.reviewId, button.dataset.reviewStatus);
});
els.rejectedProposals.addEventListener('click', (event) => {
  const checkbox = event.target.closest('.proposal-checkbox');
  if (!checkbox) return;
  const id = checkbox.dataset.id;
  if (checkbox.checked) selectedProposals.rejected.add(id);
  else selectedProposals.rejected.delete(id);
  updateBatchActionsState();
});

els.phaseActions.addEventListener('click', (event) => {
  const withdrawButton = event.target.closest('[data-withdraw-voting]');
  if (withdrawButton) {
    withdrawVoting();
    return;
  }
  const button = event.target.closest('[data-phase-status]');
  if (button) changePhaseStatus(button.dataset.phaseStatus);
});

function selectAllIn(type, checkbox) {
  const container = type === 'pending' ? els.adminProposals : els.rejectedProposals;
  const inputs = container.querySelectorAll('.proposal-checkbox');
  inputs.forEach((input) => {
    input.checked = checkbox.checked;
    if (checkbox.checked) selectedProposals[type].add(input.dataset.id);
    else selectedProposals[type].delete(input.dataset.id);
  });
  updateBatchActionsState();
}
els.selectAllPending?.addEventListener('change', () => selectAllIn('pending', els.selectAllPending));
els.selectAllRejected?.addEventListener('change', () => selectAllIn('rejected', els.selectAllRejected));
els.batchApprove?.addEventListener('click', () => batchReviewAction('approve', Array.from(selectedProposals.pending), '通过'));
els.batchReject?.addEventListener('click', () => batchReviewAction('reject', Array.from(selectedProposals.pending), '不采用'));
els.batchDeletePending?.addEventListener('click', () => batchReviewAction('delete', Array.from(selectedProposals.pending), '永久删除'));
els.batchRereview?.addEventListener('click', () => batchReviewAction('rereview', Array.from(selectedProposals.rejected), '重新审查'));
els.batchDeleteRejected?.addEventListener('click', () => batchReviewAction('delete', Array.from(selectedProposals.rejected), '永久删除'));
document.querySelectorAll('[data-review-tab]').forEach((tab) => {
  tab.addEventListener('click', () => {
    const target = tab.dataset.reviewTab;
    document.querySelectorAll('[data-review-tab]').forEach((item) => item.classList.toggle('active', item === tab));
    document.querySelectorAll('[data-review-pane]').forEach((pane) => {
      const active = pane.dataset.reviewPane === target;
      pane.classList.toggle('active', active);
      pane.hidden = !active;
    });
  });
});
els.decisionSubmit.addEventListener('click', publishDecision);
els.updateForm.addEventListener('submit', publishUpdate);
els.phaseForm.addEventListener('submit', createPhase);
els.adminOpen.addEventListener('click', openAdmin);
els.adminClose.addEventListener('click', closeAdmin);
els.adminModal.addEventListener('click', (event) => {
  if (event.target === els.adminModal) closeAdmin();
});
els.adminLoginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
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
els.adminLogout.addEventListener('click', () => {
  state.adminKey = '';
  state.admin = null;
  sessionStorage.removeItem('flycode-admin-key');
  els.adminLoginView.hidden = false;
  els.adminDashboard.hidden = true;
  els.adminKey.value = '';
  els.adminKey.focus();
});
els.exportData.addEventListener('click', exportProjectData);
els.adminRefresh?.addEventListener('click', refreshAdmin);
document.addEventListener('click', (event) => {
  const target = event.target.closest('[data-scroll-to]');
  if (!target) return;
  const targetId = target.dataset.scrollTo;
  const element = document.getElementById(targetId);
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
});

document.querySelector('#join-button')?.addEventListener('click', () => {
  document.getElementById('submit-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !els.adminModal.hidden) closeAdmin();
});

loadDraft();
loadPublic();
window.setInterval(() => loadPublic(false), 15000);
