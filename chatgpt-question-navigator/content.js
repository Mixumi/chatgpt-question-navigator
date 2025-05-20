// 存储所有问题的缓存数组，包含问题文本和对应的DOM元素引用
let cachedQuestions = [];

/**
 * 注入侧边栏 iframe 到页面中
 * 创建一个固定定位的iframe元素，用于显示问题导航栏
 * 设置iframe的样式和位置，并监听加载完成事件
 */
function injectSidebarIframe() {
  // 如果已经存在侧边栏iframe，则不再重复创建
  if (document.getElementById('chatgpt-question-sidebar-iframe')) return;

  // 创建iframe元素
  const iframe = document.createElement('iframe');
  // 设置iframe的源为sidebar.html
  iframe.src = chrome.runtime.getURL('sidebar.html');
  iframe.id = 'chatgpt-question-sidebar-iframe';
  // 添加过渡动画效果
  iframe.style.transition = 'all 0.3s ease';

  // 设置iframe的样式属性
  Object.assign(iframe.style, {
    position: 'fixed',
    top: '80px',
    right: '8px',
    width: '300px',
    height: '80vh',
    zIndex: '1',
    border: 'none',
    borderRadius: '16px',
    boxShadow: '-2px 0 6px rgba(0,0,0,0.1)'
  });

  // 将iframe添加到页面中
  document.body.appendChild(iframe);

  // 监听iframe加载完成事件
  iframe.onload = () => {
    updateQuestions();
    adjustSidebar();
  };

  // 监听窗口大小变化，调整侧边栏位置
  window.addEventListener('resize', adjustSidebar);
}

/**
 * 调整侧边栏的位置和大小
 * 根据页面头部和侧边栏的位置动态调整iframe的位置和宽度
 */
function adjustSidebar() {
  const iframe = document.getElementById('chatgpt-question-sidebar-iframe');
  const pageHeader = document.getElementById('page-header');
  const sidebar = document.getElementById('sidebar');
  const threadBottomLine = document.getElementById('thread-bottom');
  const threadBottomForm = threadBottomLine?.querySelector("form");

  if (!iframe) return;

  // 获取页面头部和侧边栏的位置信息，如果元素不存在则使用默认值0
  const pageHeaderRect = pageHeader?.getBoundingClientRect() || { bottom: 0, top: 0, height: 0 };
  const sidebarRect = sidebar?.getBoundingClientRect() || { right: 0 };
  const threadBottomLineRect = threadBottomLine?.getBoundingClientRect() || { height: 0, bottom: 0 };
  const threadBottomFormRect = threadBottomForm?.getBoundingClientRect() || { width: 0 };

  // 设置iframe的位置和宽度
  iframe.style.top = pageHeaderRect.bottom + 8 + 'px';
  iframe.style.width = Math.min(
    ((window.innerWidth - sidebarRect.right - threadBottomFormRect.width) * 0.5 - 8) * 0.85,
    400
  ) + 'px';

  // 计算侧边栏高度
  iframe.style.height = window.innerHeight - (pageHeaderRect.top + pageHeaderRect.height) - (threadBottomLineRect.height + threadBottomLineRect.bottom) - 8;
}

/**
 * 将问题列表发送到iframe中
 * 通过postMessage API实现跨窗口通信
 */
function sendQuestionsToIframe() {
  const iframe = document.getElementById('chatgpt-question-sidebar-iframe');
  if (!iframe) return;

  // 只发送问题的纯文本内容
  const texts = cachedQuestions.map(q => q.text);
  iframe.contentWindow.postMessage({ type: 'chatgpt-questions', questions: texts }, '*');
}

/**
 * 从页面中提取所有用户问题
 * @returns {Array<{ text: string, element: Element }>} 返回包含问题文本和对应DOM元素的数组
 */
function extractQuestions() {
  const result = [];
  // 查找所有用户消息中的问题文本
  document.querySelectorAll('div[data-message-author-role="user"] .whitespace-pre-wrap')
    .forEach(node => {
      const text = node.textContent?.trim();
      if (text) {
        result.push({ text, element: node });
      }
    });

  return result;
}

/**
 * 更新问题缓存并发送到iframe
 * 当对话内容发生变化时调用此函数
 */
function updateQuestions() {
  cachedQuestions = extractQuestions();
  sendQuestionsToIframe();
}

/**
 * 滚动到指定索引的问题位置
 * @param {number} index 问题在缓存数组中的索引
 */
function scrollToQuestion(index) {
  const entry = cachedQuestions[index];
  const container = document.querySelector('#thread .overflow-y-auto');

  if (entry && entry.element && container) {
    // 计算目标滚动位置，考虑容器偏移和顶部间距
    const offset = entry.element.getBoundingClientRect().top
      - container.getBoundingClientRect().top
      + container.scrollTop - 60;

    // 平滑滚动到目标位置
    container.scrollTo({ top: offset, behavior: 'smooth' });
  }
}

// 监听来自iframe的消息，处理各种滚动和刷新操作
window.addEventListener('message', (event) => {
  const { type, index } = event.data;
  const container = document.querySelector('#thread .overflow-y-auto');
  if (!container) return;

  // 根据消息类型执行不同的操作
  if (type === 'scroll-top') {
    // 滚动到顶部
    container.scrollTo({ top: 0, behavior: 'smooth' });
  } else if (type === 'scroll-bottom') {
    // 滚动到底部
    container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
  } else if (type === 'scroll-to-question') {
    // 滚动到指定问题
    scrollToQuestion(index);
  } else if (type === 'refresh') {
    // 刷新问题列表
    updateQuestions();
  }
});

// 用于检测对话内容变化的哈希值
let lastHash = '';

/**
 * 监听对话内容变化
 * 使用MutationObserver监听页面DOM变化，当检测到变化时更新问题列表
 */
function observeThreadChanges() {
  const target = document.querySelector('body');
  if (!target) return;

  // 创建MutationObserver实例
  const observer = new MutationObserver(() => {
    const newList = extractQuestions();
    // 生成问题列表的哈希值用于比较
    const hash = newList.map(q => q.text).join('||');
    // 只有当问题列表发生变化时才更新
    if (hash !== lastHash) {
      lastHash = hash;
      cachedQuestions = newList;
      sendQuestionsToIframe();
    }
  });

  // 开始观察目标元素的变化
  observer.observe(target, { childList: true, subtree: true });
}

// 初始化：注入侧边栏并开始监听对话变化
injectSidebarIframe();
observeThreadChanges();
