/* ==========================================================================
   Flycode 智能双向主题切换引擎（修复系统深色模式锁死/切换点两次问题）
   ========================================================================== */
(function() {
  const STORAGE_KEY = 'flycode-theme-choice'; // 'light' | 'dark' | 'auto'

  function getSystemTheme() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function getSavedChoice() {
    return localStorage.getItem(STORAGE_KEY) || 'auto';
  }

  function updateDOM(actualTheme, choice) {
    // 强制设置 HTML 的 data-theme 属性（优先级最高）
    document.documentElement.setAttribute('data-theme', actualTheme);
    document.documentElement.className = `theme-${actualTheme}`;
    document.documentElement.style.colorScheme = actualTheme;

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
      const stateDesc = choice === 'auto'
        ? `跟随系统(${actualTheme === 'dark' ? '深色' : '浅色'})`
        : (actualTheme === 'dark' ? '深色' : '浅色');
      toggleBtn.setAttribute('title', `当前主题：${stateDesc} · 点击切换`);
    }
  }

  function setChoice(newChoice) {
    localStorage.setItem(STORAGE_KEY, newChoice);
    const actual = newChoice === 'auto' ? getSystemTheme() : newChoice;
    updateDOM(actual, newChoice);
  }

  // 1. 初始化主题（自执行立即可用）
  const initialChoice = getSavedChoice();
  const initialActual = initialChoice === 'auto' ? getSystemTheme() : initialChoice;
  updateDOM(initialActual, initialChoice);

  // 2. 监听系统深浅色动态变化
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      const currentChoice = getSavedChoice();
      if (currentChoice === 'auto') {
        updateDOM(e.matches ? 'dark' : 'light', 'auto');
      }
    });
  }

  // 3. 点击切换逻辑：根据当前屏幕显示的实际主题做精准翻转
  function handleToggle(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    const currentActiveTheme = document.documentElement.getAttribute('data-theme') || getSystemTheme();
    const nextTheme = (currentActiveTheme === 'dark') ? 'light' : 'dark';

    setChoice(nextTheme);

    if (navigator.vibrate) {
      try { navigator.vibrate(12); } catch (_) {}
    }
  }

  // 手机端支持 pointerdown / touchend / click 多事件捕获，确保按一下秒切
  function bindButton() {
    const btn = document.querySelector('#theme-toggle');
    if (btn) {
      btn.onclick = handleToggle;
      // 重新同步一次按钮状态
      const choice = getSavedChoice();
      const actual = choice === 'auto' ? getSystemTheme() : choice;
      updateDOM(actual, choice);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindButton);
  } else {
    bindButton();
  }
})();
