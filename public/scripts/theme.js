/* ==========================================================================
   Flycode 三态主题引擎：浅色 → 深色 → 跟随系统 → 浅色…
   配合 CSS 的 @media (prefers-color-scheme) 深色分支，彻底解决
   系统深色模式下浏览器强制深色干预导致的"锁死"问题。
   ========================================================================== */
(function() {
  const STORAGE_KEY = 'flycode-theme-choice'; // 'light' | 'dark' | 'auto'

  function getSystemTheme() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function getSavedChoice() {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      return (v === 'light' || v === 'dark' || v === 'auto') ? v : 'auto';
    } catch (_) { return 'auto'; }
  }

  // 关键：切换到 light 时显式写 data-theme="light"，
  // CSS 中 @media 分支带 :not([data-theme="light"]) 即失效，
  // 浏览器强制深色滤镜也随之退出。
  function updateDOM(actualTheme, choice) {
    const html = document.documentElement;

    if (actualTheme === 'dark') {
      html.setAttribute('data-theme', 'dark');
    } else {
      html.setAttribute('data-theme', 'light');
    }
    html.style.colorScheme = actualTheme;

    const sunIcon = document.querySelector('#theme-icon-sun');
    const moonIcon = document.querySelector('#theme-icon-moon');
    const toggleBtn = document.querySelector('#theme-toggle');

    if (sunIcon && moonIcon) {
      if (actualTheme === 'dark') {
        sunIcon.style.display = 'block';
        moonIcon.style.display = 'none';
      } else {
        sunIcon.style.display = 'none';
        moonIcon.style.display = 'block';
      }
    }

    if (toggleBtn) {
      const modeName = choice === 'auto'
        ? `跟随系统（${actualTheme === 'dark' ? '深色' : '浅色'}）`
        : (actualTheme === 'dark' ? '深色' : '浅色');
      toggleBtn.setAttribute('title', `当前：${modeName} · 点击切换`);
      toggleBtn.setAttribute('aria-label', `当前主题：${modeName}，点击切换`);
    }
  }

  function applyChoice(choice) {
    try { localStorage.setItem(STORAGE_KEY, choice); } catch (_) {}
    const actual = choice === 'auto' ? getSystemTheme() : choice;
    updateDOM(actual, choice);
  }

  // Toast 提示
  function toast(msg) {
    const stack = document.querySelector('#toast-stack');
    if (!stack) return;
    const el = document.createElement('div');
    el.className = 'theme-toast';
    el.textContent = msg;
    stack.appendChild(el);
    setTimeout(() => el.remove(), 1600);
  }

  // 初始化
  updateDOM(
    getSavedChoice() === 'auto' ? getSystemTheme() : getSavedChoice(),
    getSavedChoice()
  );

  // 跟随系统模式时响应系统切换
  if (window.matchMedia) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e) => {
      if (getSavedChoice() === 'auto') {
        updateDOM(e.matches ? 'dark' : 'light', 'auto');
      }
    };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq.addListener) mq.addListener(onChange);
  }

  // 点击循环：light → dark → auto → light
  function handleToggle(e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }

    const current = getSavedChoice();
    let next, tip;
    if (current === 'light') {
      next = 'dark';   tip = '已切换到深色模式';
    } else if (current === 'dark') {
      next = 'auto';   tip = '已切换为跟随系统';
    } else {
      next = 'light';  tip = '已切换到浅色模式';
    }

    applyChoice(next);
    toast(tip);

    if (navigator.vibrate) { try { navigator.vibrate(12); } catch (_) {} }
  }

  function bindButton() {
    const btn = document.querySelector('#theme-toggle');
    if (!btn) return;
    // 使用 addEventListener 捕获阶段，优先级最高
    btn.addEventListener('click', handleToggle, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindButton);
  } else {
    bindButton();
  }
})();
