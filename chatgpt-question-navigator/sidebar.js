/**
 * 监听来自父窗口的消息
 * 主要用于接收问题列表数据并更新侧边栏
 */

function applySystemTheme() {
  const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
}

// 初始化时设置一次
applySystemTheme();

// 监听系统主题变化
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applySystemTheme);


const toggleVisibilityButton = document.getElementById('toggle-visibility');
let isSidebarCollapsed = false;

function updateToggleVisibilityButton(collapsed) {
  if (!toggleVisibilityButton) return;
  isSidebarCollapsed = collapsed;
  toggleVisibilityButton.dataset.collapsed = collapsed ? 'true' : 'false';
  toggleVisibilityButton.setAttribute('aria-expanded', String(!collapsed));
}

if (toggleVisibilityButton) {
  toggleVisibilityButton.addEventListener('click', () => {
    updateToggleVisibilityButton(!isSidebarCollapsed);
    window.parent.postMessage({ type: 'toggle-sidebar-visibility' }, '*');
  });
}

updateToggleVisibilityButton(false);


window.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'chatgpt-questions') {
    const list = document.getElementById('question-list');
    list.innerHTML = '';

    data.questions.forEach((question, idx) => {
      const li = document.createElement('li');
      const previewText = question.length > 50 ? question.substring(0, 50) + '...' : question;
      li.textContent = `${idx + 1}. ${previewText}`;
      li.title = question;
      li.onclick = () => {
        window.parent.postMessage({ 
          type: 'scroll-to-question', 
          index: idx,
          question: question
        }, '*');
      };
      list.appendChild(li);
    });
  } else if (data.type === 'sidebar-visibility-changed') {
    updateToggleVisibilityButton(Boolean(data.collapsed));
  }
});

/**
 * 置顶按钮点击事件处理
 */
document.getElementById('top').onclick = () => {
  window.parent.postMessage({ type: 'scroll-top' }, '*');
};

/**
 * 置底按钮点击事件处理
 */
document.getElementById('bottom').onclick = () => {
  window.parent.postMessage({ type: 'scroll-bottom' }, '*');
};

/**
 * 刷新按钮点击事件处理
 * 通知父窗口重新提取并发送问题列表
 */
document.getElementById('refresh').onclick = () => {
  window.parent.postMessage({ type: 'refresh' }, '*');
};
