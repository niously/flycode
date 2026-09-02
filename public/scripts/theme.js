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
    document.documentElement.setAttribute('data-theme', actualTheme);

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

  // 1. 初始化主题
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

  // 3. 点击切换逻辑：根据当前屏幕显示的实际主题做精准翻转，绝不出现“点一次没反应/点两次才切换”
  function handleToggle(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    // 获取当前屏幕上生效的主题
    const currentActiveTheme = document.documentElement.getAttribute('data-theme') || getSystemTheme();
    // 直接翻转到对立主题
    const nextTheme = (currentActiveTheme === 'dark') ? 'light' : 'dark';

    setChoice(nextTheme);

    if (navigator.vibrate) {
      try { navigator.vibrate(12); } catch (_) {}
    }
  }

  // DOM 就绪后绑定事件
  function bindButton() {
    const btn = document.querySelector('#theme-toggle');
    if (btn) {
      btn.removeEventListener('click', handleToggle);
      btn.addEventListener('click', handleToggle);
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
