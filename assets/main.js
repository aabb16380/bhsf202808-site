/* ============================================================
   B8 · 公共脚本
   ------------------------------------------------------------
   零依赖。提供：小工具、导航、入场动画、提示条、构建号。
   必须在其它模块之前加载。
   ============================================================ */
(function () {
  'use strict';

  var B8 = window.B8 = window.B8 || {};

  /* ---------- 选择器 ---------- */
  B8.qs = function (sel, root) { return (root || document).querySelector(sel); };
  B8.qsa = function (sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  };
  B8.on = function (el, ev, fn, opt) {
    if (el) el.addEventListener(ev, fn, opt || false);
    return el;
  };

  /* ---------- 文本 ---------- */
  B8.esc = function (s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  B8.nl2br = function (s) {
    return B8.esc(s).replace(/\r?\n/g, '<br>');
  };

  B8.trim = function (s, max) {
    s = String(s == null ? '' : s).trim();
    if (max && s.length > max) s = s.slice(0, max);
    return s;
  };

  B8.num = function (n) {
    return Number(n || 0).toLocaleString('zh-CN');
  };

  /* ---------- 时间 ---------- */
  // 去掉前导零：09 月 → 9 月
  B8.date = function (iso) {
    if (!iso) return '';
    var s = String(iso).slice(0, 10).split('-');
    if (s.length < 3) return String(iso);
    return Number(s[1]) + ' 月 ' + Number(s[2]) + ' 日';
  };

  B8.dateFull = function (iso) {
    if (!iso) return '';
    var s = String(iso).slice(0, 10).split('-');
    if (s.length < 3) return String(iso);
    return s[0] + ' 年 ' + Number(s[1]) + ' 月 ' + Number(s[2]) + ' 日';
  };

  B8.dateTime = function (iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d)) return B8.date(iso);
    var p = function (n) { return n < 10 ? '0' + n : '' + n; };
    return B8.date(iso) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  };

  B8.ago = function (iso) {
    var t = new Date(iso).getTime();
    if (isNaN(t)) return '';
    var d = Math.floor((Date.now() - t) / 1000);
    if (d < 60) return '刚刚';
    if (d < 3600) return Math.floor(d / 60) + ' 分钟前';
    if (d < 86400) return Math.floor(d / 3600) + ' 小时前';
    if (d < 86400 * 30) return Math.floor(d / 86400) + ' 天前';
    return B8.date(iso);
  };

  B8.daysLeft = function (iso) {
    var t = new Date(iso).getTime();
    if (isNaN(t)) return 0;
    return Math.ceil((t - Date.now()) / 86400000);
  };

  /* ---------- 页面内时钟 ----------
     v3.4：单机游戏按真实时间计时，切到后台也继续走（用户明确要求）。
     统一走 B8.now()，方便以后换实现；现在它就是 Date.now()。 */
  B8.now = function () { return Date.now(); };

  /* ---------- 提示条 ---------- */
  var toastEl = null, toastTimer = 0;
  B8.toast = function (msg) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      toastEl.setAttribute('role', 'status');
      toastEl.setAttribute('aria-live', 'polite');
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 2600);
  };

  /* ---------- 复制 ---------- */
  B8.copy = function (text) {
    var done = function () { B8.toast('已复制'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { B8.toast('复制失败'); });
      return;
    }
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); done(); } catch (e) { B8.toast('复制失败'); }
    document.body.removeChild(ta);
  };

  /* ---------- 页面内确认框 ----------
     所有站点统一用这个，不再用 window.confirm（浏览器会在标题栏带网址）。
     返回 Promise<boolean>；点确定 resolve(true)，取消 / Esc / 点遮罩 resolve(false)。 */
  var confirmLock = 0;

  function ensureConfirmStyle() {
    if (document.getElementById('b8-confirm-css')) return;
    var s = document.createElement('style');
    s.id = 'b8-confirm-css';
    s.textContent =
      '.b8-confirm{position:fixed;inset:0;z-index:4000;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(16,14,22,.52);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);opacity:1;transition:opacity .14s ease}' +
      '.b8-confirm.is-out{opacity:0}' +
      '.b8-confirm-card{width:min(380px,100%);max-height:calc(100vh - 36px);overflow:auto;padding:20px 18px 16px;background:var(--card,#fffdf7);color:var(--ink,#23211c);border:1px solid var(--line,#e4dcc6);border-radius:12px;box-shadow:0 26px 70px -36px rgba(0,0,0,.65);font-family:var(--sans,"PingFang SC","Microsoft YaHei",system-ui,sans-serif);text-align:left}' +
      '.b8-confirm-title{margin:0 0 8px;font-family:var(--serif,"Songti SC","SimSun",serif);font-size:18px;font-weight:700;letter-spacing:.03em;color:var(--ink,#23211c)}' +
      '.b8-confirm-msg{margin:0;white-space:pre-line;font-size:13px;line-height:1.85;color:var(--ink-2,#5b574d);overflow-wrap:anywhere}' +
      '.b8-confirm-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}' +
      '.b8-confirm-btn{min-height:38px;padding:8px 18px;font-family:inherit;font-size:13px;border:1px solid var(--line-2,#d3c7ac);border-radius:999px;background:transparent;color:var(--ink-2,#5b574d);cursor:pointer}' +
      '.b8-confirm-btn:active{transform:translateY(1px)}' +
      '.b8-confirm-btn.ok{color:#fff;background:var(--seal,#c1522f);border-color:var(--seal,#c1522f)}' +
      '.b8-confirm-btn.ok.is-danger{background:#a33228;border-color:#a33228}' +
      '.b8-confirm-btn:focus-visible{outline:2px solid var(--seal,#c1522f);outline-offset:2px}' +
      'body.b8-confirm-lock{overflow:hidden}';
    document.head.appendChild(s);
  }

  B8.confirm = function (message, opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      ensureConfirmStyle();
      confirmLock++;
      document.body.classList.add('b8-confirm-lock');

      var wrap = document.createElement('div');
      wrap.className = 'b8-confirm';
      wrap.setAttribute('role', 'dialog');
      wrap.setAttribute('aria-modal', 'true');
      wrap.innerHTML =
        '<div class="b8-confirm-card">' +
          '<h3 class="b8-confirm-title" id="b8-confirm-title">' + B8.esc(opts.title || '请确认') + '</h3>' +
          '<p class="b8-confirm-msg" id="b8-confirm-msg"></p>' +
          '<div class="b8-confirm-actions">' +
            '<button class="b8-confirm-btn cancel" type="button">' + B8.esc(opts.cancelText || '取消') + '</button>' +
            '<button class="b8-confirm-btn ok' + (opts.danger ? ' is-danger' : '') + '" type="button">' +
              B8.esc(opts.okText || '确定') + '</button>' +
          '</div>' +
        '</div>';
      wrap.setAttribute('aria-labelledby', 'b8-confirm-title');
      wrap.setAttribute('aria-describedby', 'b8-confirm-msg');
      wrap.querySelector('.b8-confirm-msg').textContent = String(message == null ? '' : message);
      document.body.appendChild(wrap);

      var lastFocus = document.activeElement;
      var closed = false;
      var okBtn = wrap.querySelector('.b8-confirm-btn.ok');
      var cancelBtn = wrap.querySelector('.b8-confirm-btn.cancel');

      function close(value) {
        if (closed) return;
        closed = true;
        document.removeEventListener('keydown', onKey, true);
        confirmLock = Math.max(0, confirmLock - 1);
        if (!confirmLock) document.body.classList.remove('b8-confirm-lock');
        wrap.classList.add('is-out');
        setTimeout(function () {
          if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
          if (lastFocus && lastFocus.focus) {
            try { lastFocus.focus({ preventScroll: true }); } catch (e) { try { lastFocus.focus(); } catch (e2) {} }
          }
        }, 140);
        resolve(!!value);
      }

      function onKey(ev) {
        if (ev.key === 'Escape') { ev.preventDefault(); close(false); }
        else if (ev.key === 'Enter') {
          ev.preventDefault();
          close(document.activeElement === cancelBtn ? false : true);
        }
      }

      B8.on(cancelBtn, 'click', function () { close(false); });
      B8.on(okBtn, 'click', function () { close(true); });
      B8.on(wrap, 'click', function (ev) { if (ev.target === wrap) close(false); });
      document.addEventListener('keydown', onKey, true);
      setTimeout(function () { try { okBtn.focus({ preventScroll: true }); } catch (e) { try { okBtn.focus(); } catch (e2) {} } }, 40);
    });
  };

  /* ---------- 主页「消息」按钮名字（超管可在控制台改） ---------- */
  var MSG_LABEL_LS = 'b8.messages.label.v2';
  // 默认就是「消息」；只有超管在控制台明确改名才显示别的。
  var MSG_LABEL_DEFAULT = '消息';
  var msgLabelPulling = false;
  var msgLabelEpoch = 0;   // 控制台保存后，旧的读取结果不能覆盖新名字

  function validMsgLabel(s) {
    if (typeof s !== 'string') return false;
    s = s.trim();
    // 允许超管自定义 1–12 个字，不再只认三个固定词。
    return s.length >= 1 && s.length <= 12 && !/[<>\r\n]/.test(s);
  }

  function cachedMsgLabel() {
    try {
      var v = localStorage.getItem(MSG_LABEL_LS);
      return validMsgLabel(v) ? v : MSG_LABEL_DEFAULT;
    } catch (e) { return MSG_LABEL_DEFAULT; }
  }

  function setMsgLabelText(el, label) {
    if (!el) return;
    // 链接里还有未读红点 <span>，只处理文字节点，别把红点删掉。
    // 所有文字节点都清掉，只留一个 label，避免旧文字叠成「消息信息课」。
    var done = false;
    for (var i = 0; i < el.childNodes.length; i++) {
      var n = el.childNodes[i];
      if (n.nodeType !== 3) continue;
      if (!done && String(n.nodeValue || '').replace(/\s+/g, '')) {
        n.nodeValue = label;
        done = true;
      } else {
        n.nodeValue = '';
      }
    }
    if (!done) el.insertBefore(document.createTextNode(label), el.firstChild);
  }

  function applyMsgLabel(label) {
    label = validMsgLabel(label) ? label : MSG_LABEL_DEFAULT;
    // 只改链接/按钮，绝不能匹配到 <html>：以前把 data-msg-label 也写在
    // documentElement 上，再被 [data-msg-label] 选中，会把文字节点插到页面最左上角。
    B8.qsa('a[data-msg-label], button[data-msg-label]').forEach(function (el) {
      setMsgLabelText(el, label);
    });
    // 兼容动态生成的主导航（没有 data 属性时也改）
    var navLink = B8.qs('.nav-msg-link');
    if (navLink) setMsgLabelText(navLink, label);
    var dirLink = B8.qs('.nav-dir-menu a[href$="messages.html"]');
    if (dirLink) dirLink.textContent = label;
    return label;
  }

  function setMsgLabel(label, persistLocal) {
    label = validMsgLabel(label) ? label : MSG_LABEL_DEFAULT;
    msgLabelEpoch++;
    if (persistLocal !== false) {
      try { localStorage.setItem(MSG_LABEL_LS, label); } catch (e) {}
    }
    applyMsgLabel(label);
    return label;
  }

  function pullMsgLabel() {
    if (msgLabelPulling) return;

    if (!B8.sb || !B8.sb.ready || !B8.sb.rpc) { applyMsgLabel(cachedMsgLabel()); return; }
    msgLabelPulling = true;
    var epoch = msgLabelEpoch;
    B8.sb.rpc('b8_site_setting_get', { p_key: 'messages_label' })
      .then(function (res) {
        if (epoch !== msgLabelEpoch) return;
        var label = res && res.label;
        if (validMsgLabel(label)) setMsgLabel(label);
        else applyMsgLabel(cachedMsgLabel());
      })
      .catch(function () {
        if (epoch === msgLabelEpoch) applyMsgLabel(cachedMsgLabel());
      })
      .then(function () { msgLabelPulling = false; });
  }

  B8.msgLabel = {
    current: cachedMsgLabel,
    apply: applyMsgLabel,
    set: setMsgLabel,
    refresh: pullMsgLabel
  };
  // 控制台用 window.B8MsgLabel 找这个接口；保留别名，旧版控制台也不会失效。
  window.B8MsgLabel = B8.msgLabel;

  /* ---------- 导航 ---------- */
  function initNav() {
    var toggle = B8.qs('#nav-toggle');
    var nav = B8.qs('#nav');
    if (!toggle || !nav) return;

    var path = String(location.pathname || '');
    var onIndex = /(^|\/)index\.html$/.test(path) || /\/$/.test(path);
    function section(id) { return onIndex ? '#' + id : 'index.html#' + id; }
    var siteName = (document.body && document.body.getAttribute('data-site')) || '';
    var msgHref = siteName === 'fun' ? 'messages.html' : section('messages');
    var fbLink = siteName === 'fun' ? '<a href="#" data-feedback>意见箱</a>' : '';
    // v3.7：八班 AI 只在 .fun 有独立页面，其它两站不出现这个入口
    var aiLink = siteName === 'fun' ? '<a href="ai.html" class="nav-ai-link">AI</a>' : '';

    nav.innerHTML =
      '<span class="nav-theme-wrap">' +
        '<button class="nav-link nav-theme" id="nav-theme" type="button" ' +
          'aria-haspopup="true" aria-expanded="false">夜间模式</button>' +
      '</span>' +
      '<a class="nav-msg-link" href="' + msgHref + '" data-msg-label>消息' +
        '<span class="nav-msg-dot" id="nav-msg-dot" hidden></span></a>' +
      '<div class="nav-dir">' +
        '<button class="nav-link nav-dir-btn" type="button" aria-expanded="false">目录</button>' +
        '<div class="nav-dir-menu">' +
          '<a href="' + section('games') + '">小游戏</a>' +
          '<a href="' + section('photos') + '">照片墙</a>' +
          '<a href="' + msgHref + '">消息 / 信息课</a>' +
          '<a href="' + section('rank') + '">排行榜</a>' +
          '<a href="' + section('vote') + '">投票</a>' +
          fbLink +
          aiLink +
          '<a href="changelog.html">更新日志</a>' +
        '</div>' +
      '</div>' +
      '<a href="board.html">棋室</a>' +
      '<a href="arcade.html">多人游戏</a>' +
      aiLink +
      fbLink +
      '<a href="changelog.html">更新日志</a>';

    // 旧的「⋯」菜单不再堆在页头；主题按钮已经进导航
    var moreWrap = B8.qs('.more-wrap');
    if (moreWrap && moreWrap.parentNode) moreWrap.parentNode.removeChild(moreWrap);

    var themeBtn = B8.qs('#nav-theme');
    function paintTheme() {
      if (window.B8Theme && window.B8Theme.paint) window.B8Theme.paint();
      if (themeBtn) {
        themeBtn.title = window.B8Theme
          ? '点击立即切换日间 / 夜间，再选「自动」或「固定」· 当前：' + window.B8Theme.label()
          : '夜间模式';
      }
    }
    paintTheme();
    document.addEventListener('b8:theme', paintTheme);

    var dir = B8.qs('.nav-dir', nav);
    var dirBtn = dir && B8.qs('.nav-dir-btn', dir);
    if (dir && dirBtn) {
      B8.on(dirBtn, 'click', function (ev) {
        ev.stopPropagation();
        var open = dir.classList.toggle('open');
        dirBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
    }

    B8.on(toggle, 'click', function () {
      var open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.setAttribute('aria-label', open ? '收起菜单' : '打开菜单');
    });

    B8.qsa('a', nav).forEach(function (a) {
      B8.on(a, 'click', function () {
        nav.classList.remove('open');
        if (dir) dir.classList.remove('open');
        if (dirBtn) dirBtn.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });

    B8.on(document, 'keydown', function (e) {
      if (e.key === 'Escape') {
        nav.classList.remove('open');
        if (dir) dir.classList.remove('open');
        if (dirBtn) dirBtn.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* ---------- 把「主导航」和「⋯ 菜单」合成一个 ----------
     页头只留一个 ⋯ 按钮：站点内导航、跨站链接、日/夜、管理入口、
     调试相关入口全在同一个面板里。原来的 ▤ 抽屉不再出现。 */
  function initMergeMenus() {
    var nav = B8.qs('#nav');
    var menu = B8.qs('#more-menu');
    if (!nav || !menu) return;

    var group = document.createElement('div');
    group.className = 'menu-group';

    // 夜间模式放菜单第一项（它原来藏在跨站链接后面）
    var theme = menu.querySelector('#theme-btn');
    if (theme && theme.parentNode === menu) {
      menu.insertBefore(theme, menu.firstChild);
    }

    var links = B8.qsa('a', nav);
    links.forEach(function (a) {
      var copy = document.createElement('a');
      copy.href = a.getAttribute('href');
      copy.textContent = a.textContent;
      var cls = a.getAttribute('class');
      if (cls) copy.className = cls;
      group.appendChild(copy);
    });

    if (group.childNodes.length) {
      if (theme && theme.parentNode === menu) {
        menu.insertBefore(group, theme.nextSibling);
      } else {
        menu.insertBefore(group, menu.firstChild);
      }
      var sep = document.createElement('span');
      sep.className = 'menu-sep';
      menu.insertBefore(sep, group.nextSibling);
    }

    document.body.classList.add('menu-merged');
  }
  /* ---------- 入场动画 ---------- */
  function initReveal() {
    var items = B8.qsa('.reveal');
    if (!items.length) return;

    if (!('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.classList.add('in'); });
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add('in');
        io.unobserve(en.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });

    items.forEach(function (el) { io.observe(el); });

    // 兜底：1.2 秒后仍在视口内的直接显示，避免动画失灵导致内容透明
    setTimeout(function () {
      items.forEach(function (el) {
        var r = el.getBoundingClientRect();
        if (r.top < window.innerHeight && r.bottom > 0) el.classList.add('in');
      });
    }, 1200);
  }

  /* ---------- 页头「更多」菜单 ---------- */
  function initMore() {
    var btn = B8.qs('#more-menu-btn');
    var menu = B8.qs('#more-menu');
    if (!btn || !menu) return;

    // 棋室 / 多人游戏的「⋯」菜单也补一个意见箱入口
    if (document.body && document.body.getAttribute('data-site') === 'fun' &&
        !menu.querySelector('[data-feedback]')) {
      var fbLink = document.createElement('a');
      fbLink.href = '#';
      fbLink.setAttribute('data-feedback', '');
      fbLink.textContent = '意见箱';
      menu.appendChild(fbLink);
    }

    function close() {
      menu.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
    }

    B8.on(btn, 'click', function (e) {
      e.stopPropagation();
      var willOpen = menu.hidden;
      menu.hidden = !willOpen;
      btn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
    });

    // 点菜单外面 / 按 Esc 收起
    B8.on(document, 'click', function (e) {
      if (menu.hidden) return;
      if (menu.contains(e.target) || e.target === btn) return;
      close();
    });
    B8.on(document, 'keydown', function (e) {
      if (e.key === 'Escape') close();
    });

    B8.qsa('a, button', menu).forEach(function (el) {
      // 夜间模式按钮是连续切换用的，点一下不能把菜单关掉
      if (el.id === 'theme-btn') return;
      B8.on(el, 'click', close);
    });
  }

  /* ---------- 年份 ---------- */
  function initYear() {
    var y = B8.qs('#year');
    if (y) y.textContent = new Date().getFullYear();
  }

  /* ---------- 版本 / TEST 标记 ---------- */
  function initBuild() {
    var ver = B8.qs('#brand-ver');
    if (ver) {
      var cfg = window.B8_CONFIG || {};
      ver.textContent = (cfg.site && cfg.site.version) || window.B8_BUILD || 'v1.0';
    }

    if (window.B8_TEST) {
      var badge = document.createElement('span');
      badge.className = 'build-test';
      badge.textContent = 'TEST';
      badge.title = '本次加载已绕过缓存';
      var host = B8.qs('.header-tools') || B8.qs('.brand-text');
      if (host) host.appendChild(badge);
      var banner = B8.qs('#build-banner');
      if (banner) banner.hidden = false;
    }
  }

  /* ---------- 外链统一 rel ---------- */
  function initLinks() {
    B8.qsa('a[target="_blank"]').forEach(function (a) {
      a.rel = 'noopener noreferrer';
    });
  }

  /* ---------- 超管控制台：只有超管才下载 ----------
     以前三个站都在首屏 document.write 里加载 console.js（17 KB），
     99% 的同学永远用不到。现在等 auth 解析完，确认是超管再补进来。 */
  var consoleLoading = false;

  function loadConsole() {
    if (consoleLoading || document.getElementById('console-js')) return;
    if (!B8.auth || !B8.auth.isSuper || !B8.auth.isSuper()) return;
    consoleLoading = true;

    var s = document.createElement('script');
    s.id = 'console-js';
    s.async = true;
    s.src = 'assets/console.js?v=' + encodeURIComponent(window.B8_BUILD || '0') + (window.B8_T || '');
    s.onerror = function () {
      consoleLoading = false;
      if (s.parentNode) s.parentNode.removeChild(s);
      if (window.console) console.warn('[b8] 控制台模块没加载上');
    };
    document.head.appendChild(s);
  }

  /* ---------- 意见箱：写建议 / 附一张图，超管在控制台看 ---------- */
  function initFeedback() {
    var modal = null;
    var fileInput = null;
    var preview = null;
    var statusEl = null;
    var submit = null;
    var bodyEl = null;
    var currentFile = null;
    var sending = false;

    function status(text, bad) {
      if (!statusEl) return;
      statusEl.textContent = text || '';
      statusEl.className = 'b8-fb-status' + (bad ? ' is-bad' : '');
    }

    function build() {
      if (modal) return;
      modal = document.createElement('div');
      modal.className = 'b8-fb-modal';
      modal.id = 'b8-fb-modal';
      modal.hidden = true;
      modal.innerHTML =
        '<div class="b8-fb-card" role="dialog" aria-modal="true" aria-labelledby="b8-fb-title">' +
          '<header><b id="b8-fb-title">意见箱</b>' +
            '<button type="button" class="b8-fb-x" data-fb-close aria-label="关闭">×</button></header>' +
          '<p class="b8-fb-note">可以提建议、报 bug、说哪里不好用；最多 1000 字，能附一张图片。</p>' +
          '<textarea id="b8-fb-body" maxlength="1000" rows="5" placeholder="想说什么？越具体越好…"></textarea>' +
          '<div class="b8-fb-file">' +
            '<label for="b8-fb-file">图片（可选）</label>' +
            '<input id="b8-fb-file" type="file" accept="image/*">' +
            '<span id="b8-fb-file-name">没有选图片</span>' +
          '</div>' +
          '<div class="b8-fb-preview" id="b8-fb-preview" hidden><img alt="图片预览"></div>' +
          '<p class="b8-fb-status" id="b8-fb-status" role="status"></p>' +
          '<footer><button type="button" class="btn ghost sm" data-fb-close>取消</button>' +
            '<button type="button" class="btn sm" id="b8-fb-submit">提交</button></footer>' +
        '</div>';
      document.body.appendChild(modal);
      fileInput = modal.querySelector('#b8-fb-file');
      preview = modal.querySelector('#b8-fb-preview');
      statusEl = modal.querySelector('#b8-fb-status');
      submit = modal.querySelector('#b8-fb-submit');
      bodyEl = modal.querySelector('#b8-fb-body');

      B8.qsa('[data-fb-close]', modal).forEach(function (b) {
        B8.on(b, 'click', close);
      });
      B8.on(modal, 'click', function (e) {
        if (e.target === modal) close();
      });
      B8.on(fileInput, 'change', function () {
        var f = fileInput.files && fileInput.files[0];
        currentFile = f || null;
        var name = modal.querySelector('#b8-fb-file-name');
        if (name) name.textContent = f ? f.name : '没有选图片';
        if (preview) {
          preview.hidden = !f;
          var img = preview.querySelector('img');
          if (img) {
            if (img.src) URL.revokeObjectURL(img.src);
            img.src = f ? URL.createObjectURL(f) : '';
          }
        }
        status('');
      });
      B8.on(submit, 'click', send);
    }

    function open() {
      if (!B8.auth || !B8.auth.isLogged || !B8.auth.isLogged()) {
        B8.toast('登录后才能写意见');
        return;
      }
      build();
      modal.hidden = false;
      status('');
      setTimeout(function () { try { bodyEl.focus(); } catch (e) {} }, 30);
    }

    function close() {
      if (!modal) return;
      modal.hidden = true;
      currentFile = null;
      if (fileInput) fileInput.value = '';
      if (preview) {
        preview.hidden = true;
        var img = preview.querySelector('img');
        if (img && img.src) { URL.revokeObjectURL(img.src); img.src = ''; }
      }
      if (bodyEl) bodyEl.value = '';
      var name = modal.querySelector('#b8-fb-file-name');
      if (name) name.textContent = '没有选图片';
      status('');
    }

    function upload(file) {
      var uploadUrl = window.B8_CONFIG && window.B8_CONFIG.photoUpload;
      if (!uploadUrl) throw new Error('图床没有配置');
      var no = (B8.auth && B8.auth.no && B8.auth.no()) || 'member';
      var ext = (String(file.name || '').match(/\.([a-z0-9]+)$/i) || [])[1] || 'jpg';
      var path = 'fb-' + no + '-' + Date.now() + '.' + ext.toLowerCase();
      var token = (B8.auth.memberToken && B8.auth.memberToken()) || (B8.auth.token && B8.auth.token()) || '';
      return fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'x-b8-token': token,
          'x-b8-path': path,
          'Content-Type': file.type || 'image/jpeg'
        },
        body: file
      }).then(function (res) {
        return res.text().then(function (text) {
          if (!res.ok) {
            var msg = 'HTTP ' + res.status;
            try { var j = JSON.parse(text); msg = j.detail || j.message || msg; } catch (e) {}
            throw new Error(msg);
          }
          var j = JSON.parse(text || '{}');
          if (!j.url) throw new Error('服务器没有返回图片地址');
          return j.url;
        });
      });
    }

    function send() {
      if (!modal || sending) return;
      var body = (bodyEl.value || '').trim();
      if (!body) { status('写点建议再提交', true); return; }
      if (currentFile) {
        if (!/^image\//.test(currentFile.type || '')) { status('只能上传图片', true); return; }
        if (currentFile.size > 10 * 1024 * 1024) { status('图片最大 10MB', true); return; }
      }
      if (!B8.sb || !B8.sb.ready) { status('数据库还没连上', true); return; }
      sending = true;
      submit.disabled = true;
      submit.textContent = '提交中…';
      status('正在提交…');
      var task = currentFile
        ? Promise.resolve().then(function () { return upload(currentFile); })
        : Promise.resolve(null);
      task.then(function (url) {
        return B8.sb.rpc('b8_feedback_add', {
          p_token: (B8.auth.memberToken && B8.auth.memberToken()) || B8.auth.token(),
          p_body: body,
          p_image: url || null
        });
      }).then(function () {
        sending = false;
        submit.disabled = false;
        submit.textContent = '提交';
        B8.toast('意见已提交，谢谢');
        close();
      }).catch(function (err) {
        sending = false;
        submit.disabled = false;
        submit.textContent = '提交';
        var msg = (err && err.message) || '提交失败';
        if (/PGRST202|does not exist|Could not find|没有找到/i.test(msg)) {
          msg = '数据库还没更新：要先执行 fix-v3.3.sql';
        }
        status(msg, true);
      });
    }

    document.addEventListener('click', function (e) {
      var el = e.target && e.target.closest ? e.target.closest('[data-feedback]') : null;
      if (!el) return;
      e.preventDefault();
      open();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modal && !modal.hidden) close();
    });
  }

  /* ---------- 封号通知：给被封的人单独一条，不用等点功能才报错 ---------- */
  var BAN_LABELS = {
    public_chat: '公屏发言',
    spectate_chat: '观战 / 对局评论',
    rank: '上榜',
    dm: '私信',
    group_chat: '群聊',
    room_chat: '房间聊天',
    lesson: '信息课发言',
    play: '开房 / 对局',
    chat: '所有聊天',
    all: '全站'
  };

  function initBanNotice() {
    if (!document.body || document.body.getAttribute('data-site') !== 'fun') return;
    var el = null;
    var busy = false;

    function labels(scopes) {
      var arr = Array.isArray(scopes) ? scopes : [];
      var out = [];
      for (var i = 0; i < arr.length; i++) out.push(BAN_LABELS[arr[i]] || arr[i]);
      return out.length ? out.join('、') : '使用网站功能';
    }

    function remove() {
      if (el && el.parentNode) el.parentNode.removeChild(el);
      el = null;
    }

    function banKey() {
      return 'b8.ban.last.' + ((B8.auth && B8.auth.no && B8.auth.no()) || '');
    }

    function showLift() {
      remove();
      el = document.createElement('div');
      el.id = 'b8-ban-banner';
      el.className = 'b8-ban-banner is-ok';
      el.setAttribute('role', 'status');
      el.innerHTML = '<b>封号已解除</b><span>你可以正常使用网站功能了。</span>' +
        '<button type="button" aria-label="关闭通知">×</button>';
      document.body.insertBefore(el, document.body.firstChild);
      var close = el.querySelector('button');
      B8.on(close, 'click', remove);
      setTimeout(function () { if (el && el.classList.contains('is-ok')) remove(); }, 10000);
    }

    function show(st) {
      if (!st || !st.banned) { remove(); return; }
      var expiry = st.expires_at ? new Date(st.expires_at) : null;
      var sig = JSON.stringify({
        s: st.scopes || [], r: st.reason || '', e: st.expires_at || ''
      });
      try { localStorage.setItem(banKey(), sig); } catch (e) {}
      var dismissed = '';
      try { dismissed = localStorage.getItem('b8.ban.dismissed') || ''; } catch (e) {}
      if (dismissed === sig) { remove(); return; }
      if (el) return;
      el = document.createElement('div');
      el.id = 'b8-ban-banner';
      el.className = 'b8-ban-banner';
      el.setAttribute('role', 'alert');
      var bits = [];
      bits.push('<b>你已被封号</b>');
      bits.push('<span>禁止：' + B8.esc(labels(st.scopes)) + '</span>');
      if (st.reason) bits.push('<span>原因：' + B8.esc(st.reason) + '</span>');
      bits.push('<span>' + (expiry && !isNaN(expiry.getTime())
        ? '到 ' + B8.esc(B8.dateTime(st.expires_at)) + ' 结束'
        : '永久封禁') + '</span>');
      bits.push('<button type="button" aria-label="关闭封号通知">×</button>');
      el.innerHTML = bits.join('');
      document.body.insertBefore(el, document.body.firstChild);
      var close = el.querySelector('button');
      B8.on(close, 'click', function () {
        try { localStorage.setItem('b8.ban.dismissed', sig); } catch (e) {}
        remove();
      });
    }

    function refresh() {
      if (busy) return;
      if (!B8.auth || !B8.auth.isLogged || !B8.auth.isLogged() ||
          !B8.sb || !B8.sb.ready || !B8.auth.token) { remove(); return; }
      busy = true;
      B8.sb.rpc('b8_ban_state', { p_token: B8.auth.token() }).then(function (st) {
        busy = false;
        var key = banKey();
        var was = '';
        try { was = localStorage.getItem(key) || ''; } catch (e) {}
        if (!st || !st.banned) {
          remove();
          if (was) {
            try { localStorage.removeItem(key); } catch (e) {}
            showLift();
          }
          return;
        }
        show(st);
      }).catch(function () {
        busy = false;
        remove();
      });
    }

    document.addEventListener('b8:auth', refresh);
    window.addEventListener('load', refresh);
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) refresh();
    });
    setInterval(refresh, 60000);
  }

  /* ---------- 破纪录即时提示：服务端返回 record=true 时立刻告诉玩家 ---------- */
  function initRecordToast() {
    function hook() {
      if (!B8.sb || !B8.sb.rpc || B8.sb.__recordHooked) return;
      var orig = B8.sb.rpc;
      B8.sb.rpc = function (fn, args) {
        var p = orig.apply(B8.sb, arguments);
        if (fn === 'b8_score_add' && p && p.then) {
          p.then(function (res) {
            if (res && res.record) {
              B8.toast('新纪录！成绩已经上榜');
              if (B8.noticeBar && B8.noticeBar.load) B8.noticeBar.load(true);
            }
          }).catch(function () {});
        }
        return p;
      };
      B8.sb.__recordHooked = true;
    }
    hook();
    window.addEventListener('load', hook);
    document.addEventListener('b8:auth', hook);
    setTimeout(hook, 800);
  }

  /* ---------- 详细活动记录：只写数据库，不写控制台 / 服务器日志 ---------- */
  function initActivity() {
    var lastKey = '';
    var lastAt = 0;
    B8.activity = function (action, detail) {
      var a = String(action || '').trim();
      var d = String(detail || '').trim();
      if (!a) return;
      if (!B8.auth || !B8.auth.isLogged || !B8.auth.isLogged()) return;
      if (!B8.sb || !B8.sb.ready || !B8.sb.rpc) return;
      var key = a + '|' + d;
      var now = Date.now();
      if (key === lastKey && now - lastAt < 1500) return;
      lastKey = key;
      lastAt = now;
      // 复用已有的上线记录 RPC，不新增函数、不写服务器日志。
      B8.sb.rpc('b8_presence_ping', {
        p_token: (B8.auth.memberToken && B8.auth.memberToken()) || B8.auth.token(),
        p_path: ('[' + a + ']' + (d ? ' ' + d : '')).slice(0, 120)
      }).catch(function () {});
    };
  }

  /* ---------- 启动 ---------- */
  function boot() {
    initNav();
    applyMsgLabel(cachedMsgLabel());
    pullMsgLabel();
    initMore();
    initReveal();
    initYear();
    initBuild();
    initLinks();
    initFeedback();
    initRecordToast();
    initActivity();
    initBanNotice();
    loadConsole();
    document.addEventListener('b8:auth', loadConsole);
  }

  // main.js 用 defer 加载时，执行到这里 readyState 已经是 interactive，
  // 但 DOMContentLoaded 还没触发，排在后面的 sb.js / auth.js 也还没执行。
  // 以前这里直接 boot()，pullMsgLabel() 会因为 B8.sb 还不存在而只读本地缓存，
  // 服务器上的按钮名永远显示不出来。必须等 DOMContentLoaded。
  if (document.readyState === 'complete') {
    boot();
  } else {
    document.addEventListener('DOMContentLoaded', boot);
  }
})();
