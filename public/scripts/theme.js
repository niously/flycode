/* ==========================================================================
   三态主题切换引擎：浅色 → 深色 → 跟随系统 → 浅色
   手机端与桌面端完全兼容
   ========================================================================== */
const themeToggleBtn = document.querySelector('#theme-toggle');
const themeIconSun = document.querySelector('#theme-icon-sun');
const themeIconMoon = document.querySelector('#theme-icon-moon');

function getSystemTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(userChoice) {
  // userChoice 可能是 'light', 'dark', 或 'auto'
  const actualTheme = (userChoice === 'auto') ? getSystemTheme() : userChoice;
  
  document.documentElement.setAttribute('data-theme', actualTheme);
  localStorage.setItem('flycode-theme-choice', userChoice);
  
  // 更新按钮图标与提示
  if (themeIconSun && themeIconMoon) {
    if (actualTheme === 'dark') {
      themeIconSun.style.display = 'block';
      themeIconMoon.style.display = 'none';
    } else {
      themeIconSun.style.display = 'none';
      themeIconMoon.style.display = 'block';
    }
  }
  
  // 更新按钮 title 提示
  if (themeToggleBtn) {
    const titles = {
      'light': '当前：浅色模式 · 点击切换到深色',
      'dark': '当前：深色模式 · 点击切换到跟随系统',
      'auto': `当前：跟随系统（${actualTheme === 'dark' ? '深色' : '浅色'}）· 点击切换到浅色`
    };
    themeToggleBtn.title = titles[userChoice] || '切换主题';
  }
}

// 初始化：优先读取用户选择，否则默认跟随系统
const savedChoice = localStorage.getItem('flycode-theme-choice') || 'auto';
applyTheme(savedChoice);

// 监听系统主题变化（当用户选择 auto 时实时跟随）
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  const currentChoice = localStorage.getItem('flycode-theme-choice');
  if (currentChoice === 'auto' || !currentChoice) {
    applyTheme('auto');
  }
});

// 点击切换按钮：浅色 → 深色 → 跟随系统 → 浅色
themeToggleBtn?.addEventListener('click', (e) => {
  e.preventDefault();
  e.stopPropagation();
  
  const currentChoice = localStorage.getItem('flycode-theme-choice') || 'auto';
  let nextChoice;
  
  if (currentChoice === 'light') {
    nextChoice = 'dark';
  } else if (currentChoice === 'dark') {
    nextChoice = 'auto';
  } else {
    nextChoice = 'light';
  }
  
  applyTheme(nextChoice);
  
  // 手机端触觉反馈
  if (navigator.vibrate) {
    navigator.vibrate(10);
  }
});
