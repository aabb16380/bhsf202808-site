/* ============================================================
   八班树洞 · 时光胶囊
   ------------------------------------------------------------
   封存中的胶囊只拿到 body = null。这个文件里有一条铁律：
   在未开启分支绝不读取 item.body，也绝不把正文写进属性。
   开启时间按本地日期的零点发送，避免“6 月 9 日”在 UTC 里
   变成 6 月 8 日。
   ============================================================ */
(function () {
  'use strict';

  var B8 = window.B8;
  if (!B8) return;

  var wall = B8.qs('#capsule-wall');
  var form = B8.qs('#capsule-form');
  var titleEl = B8.qs('#cap-title');
  var bodyEl = B8.qs('#cap-body');
  var dateEl = B8.qs('#cap-date');
  var anonEl = B8.qs('#cap-anon');
  var submit = B8.qs('#cap-submit');
  var countEl = B8.qs('#cap-count');
  var statusEl = B8.qs('#cap-status');
  var demoNote = B8.qs('#capsule-demo-note');
  var statEl = B8.qs('#stat-capsules');
  var wallMeta = B8.qs('#cap-wall-meta');

  if (!wall || !form) return;

  var PREFERRED_DATE = '2028-06-09';
  var items = [];
  var isDemo = false;
  var isAdmin = false;
  var submitting = false;

  function h(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }

  function tagEl(text, extra) {
    return h('span', 'tag' + (extra ? ' ' + extra : ''), text);
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function closest(el, sel) {
    while (el && el.nodeType === 1) {
      if (el.matches && el.matches(sel)) return el;
      el = el.parentNode;
    }
    return null;
  }

  function errMessage(err) {
    return (err && err.message) ? err.message : '请求失败，请稍后再试';
  }

  function setStatus(msg, kind) {
    if (!statusEl) return;
    statusEl.textContent = msg || '';
    statusEl.className = 'form-status' + (kind ? ' ' + kind : '');
  }

  function fail(err) {
    var msg = errMessage(err);
    setStatus(msg, 'err');
    B8.toast(msg);
  }

  function pad2(n) {
    return n < 10 ? '0' + n : String(n);
  }

  function ymd(d) {
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  /** 默认打开日期：今天 + 10 天 */
  function defaultOpenDate() {
    var d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() + 10);
    return ymd(d);
  }

  function applyDefaultDate() {
    if (!dateEl) return;
    // 用户已经改过就别动
    if (dateEl.getAttribute('data-touched') === '1') return;
    dateEl.value = defaultOpenDate();
    dateEl.min = ymd(new Date());
  }

  // 输入框给的是“哪一天”，不是某个 UTC 时刻；按本地零点解释。
  function parseLocalDate(s) {
    var p = String(s || '').split('-');
    if (p.length !== 3) return null;
    var y = Number(p[0]);
    var m = Number(p[1]);
    var d = Number(p[2]);
    if (!y || !m || !d) return null;
    var dt = new Date(y, m - 1, d, 0, 0, 0, 0);
    if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
    return dt;
  }

  function localDateLabel(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return B8.date(String(iso || '').slice(0, 10));
    return d.getFullYear() + ' 年 ' + (d.getMonth() + 1) + ' 月 ' + d.getDate() + ' 日';
  }

  function daysUntil(iso) {
    var t = new Date(iso).getTime();
    if (isNaN(t)) return 0;
    return Math.max(0, Math.ceil((t - Date.now()) / 86400000));
  }

  function isOpened(item) {
    // is_open 为真也不够，必须确实拿到了正文，才进入开启分支。
    return !!(item && item.is_open && item.body !== null && item.body !== undefined);
  }

  function syncCount() {
    if (!bodyEl || !countEl) return;
    var n = bodyEl.value.length;
    countEl.textContent = String(n);
    var wrap = countEl.parentNode;
    if (wrap) {
      if (n >= 3600) wrap.classList.add('near');
      else wrap.classList.remove('near');
    }
  }

  function setDateBounds() {
    if (!dateEl) return;
    var tomorrow = new Date();
    tomorrow.setHours(0, 0, 0, 0);
    tomorrow.setDate(tomorrow.getDate() + 1);
    dateEl.min = ymd(tomorrow);
    if (!dateEl.value || dateEl.value < dateEl.min) dateEl.value = dateEl.min;
  }

  function resetDate() {
    if (!dateEl) return;
    setDateBounds();
    dateEl.value = PREFERRED_DATE >= dateEl.min ? PREFERRED_DATE : dateEl.min;
  }

  function updateStats() {
    if (statEl) statEl.textContent = B8.num(items.length);
    if (!wallMeta) return;
    var open = 0;
    for (var i = 0; i < items.length; i++) if (isOpened(items[i])) open++;
    var sealed = items.length - open;
    if (!items.length) {
      wallMeta.textContent = '等着被打开的信。';
    } else {
      wallMeta.textContent = '封存中 ' + B8.num(sealed) + ' 封 · 已开启 ' + B8.num(open) + ' 封';
    }
  }

  function miniAct(text, action, extra) {
    var n = h('span', 'mini-act' + (extra ? ' ' + extra : ''), text);
    n.setAttribute('role', 'button');
    n.setAttribute('tabindex', '0');
    n.setAttribute('data-act', action);
    return n;
  }

  /* ---------- 一封胶囊 ---------- */
  function buildCard(item) {
    var opened = isOpened(item);
    var card = h('article', 'capsule-card ' + (opened ? 'is-open' : 'is-sealed'));
    card.setAttribute('data-id', String(item.id));

    var head = h('div', 'capsule-head');
    var stamp = h('span', 'capsule-stamp', opened ? '启' : '封');
    stamp.setAttribute('aria-hidden', 'true');
    head.appendChild(stamp);

    var headMain = h('div', 'capsule-head-main');
    var title = h('h3', 'capsule-title', item.title || '无题');
    headMain.appendChild(title);

    if (opened) {
      var meta = h('p', 'capsule-meta',
        '开启于 ' + localDateLabel(item.open_at) + ' · ' + (item.nick || '匿名'));
      headMain.appendChild(meta);
    } else {
      var days = (item.days_left === null || item.days_left === undefined)
        ? daysUntil(item.open_at)
        : Number(item.days_left);
      if (!isFinite(days) || days < 0) days = 0;
      var status = days > 0
        ? '封存中 · 还有 ' + B8.num(days) + ' 天'
        : '封存中 · 还有不到 1 天';
      headMain.appendChild(h('p', 'capsule-status', status));
    }

    head.appendChild(headMain);

    var tools = h('div', 'capsule-tools');
    if (isDemo) tools.appendChild(tagEl('示例', 'plain'));
    if (isAdmin) tools.appendChild(miniAct('隐藏', 'hide', 'is-danger'));
    if (tools.childNodes.length) head.appendChild(tools);

    card.appendChild(head);

    // 关键：未开启分支到这里就结束了。下面的 body 只在确实开启时创建。
    if (opened) {
      var body = h('div', 'capsule-body');
      body.textContent = item.body;
      card.appendChild(body);
    }

    return card;
  }

  function findItem(id) {
    for (var i = 0; i < items.length; i++) {
      if (String(items[i].id) === String(id)) return items[i];
    }
    return null;
  }

  function renderAll() {
    clear(wall);

    if (!items.length) {
      wall.appendChild(h('p', 'empty-note', '墙上还没有胶囊。第一封可以写给两年后的自己。'));
    } else {
      var frag = document.createDocumentFragment();
      for (var i = 0; i < items.length; i++) frag.appendChild(buildCard(items[i]));
      wall.appendChild(frag);
    }

    wall.setAttribute('aria-busy', 'false');
    updateStats();
  }

  /* ---------- 管理员 ---------- */
  function hideCapsule(card, item) {
    B8.confirm('隐藏之后，这封胶囊就不会再出现在墙上。确定吗？', {
      title: '隐藏胶囊', okText: '隐藏', danger: true
    }).then(function (ok) {
      if (!ok) return;
      card.setAttribute('data-busy', '1');
      B8.sb.rpc('b8_capsule_hide', {
        p_token: B8.auth.token(),
        p_id: item.id
      }).then(function () {
        items = items.filter(function (x) { return String(x.id) !== String(item.id); });
        renderAll();
        B8.toast('已隐藏');
      }, function (err) {
        card.removeAttribute('data-busy');
        fail(err);
      });
    });
  }

  /* ---------- 数据 ---------- */
  function loadCapsules() {
    wall.setAttribute('aria-busy', 'true');
    B8.sb.rpc('b8_capsule_list', {
      p_token: B8.auth.token()
    }).then(function (rows) {
      items = Array.isArray(rows) ? rows : [];
      renderAll();
    }, function (err) {
      clear(wall);
      wall.setAttribute('aria-busy', 'false');
      var msg = errMessage(err);
      wall.appendChild(h('p', 'list-error', '胶囊墙暂时打不开：' + msg));
      if (statEl) statEl.textContent = '—';
      if (wallMeta) wallMeta.textContent = '读取失败，稍后再来。';
      B8.toast(msg);
    });
  }

  function demoFutureIso(days) {
    var d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + days);
    return d.toISOString();
  }

  function demoData() {
    var now = Date.now();
    return [
      {
        id: 'demo-c1', nick: '班长', anon: false,
        title: '写给刚上高二的我们',
        body: '现在是 2026 年的九月，刚分完班。\n\n不知道两年后的你，还会不会在晚自习前趴在栏杆上看操场。希望那时你还记得，八班的人曾经在这个窗口挤成一排。\n\n如果已经忘了，就当我们替你记着。',
        is_open: true,
        open_at: demoFutureIso(-45),
        days_left: 0,
        created_at: new Date(now - 1000 * 60 * 60 * 24 * 45).toISOString()
      },
      {
        id: 'demo-c2', nick: '匿名', anon: true,
        title: '给高考结束那天的我们',
        body: null,
        is_open: false,
        open_at: demoFutureIso(584),
        days_left: 584,
        created_at: new Date(now - 1000 * 60 * 60 * 24 * 20).toISOString()
      },
      {
        id: 'demo-c3', nick: '匿名', anon: true,
        title: '十八岁生日前想明白的一件事',
        body: null,
        is_open: false,
        open_at: demoFutureIso(820),
        days_left: 820,
        created_at: new Date(now - 1000 * 60 * 60 * 24 * 3).toISOString()
      }
    ];
  }

  function startDemo() {
    isDemo = true;
    isAdmin = false;
    items = demoData();
    if (demoNote) demoNote.hidden = false;
    if (submit) submit.disabled = true;
    renderAll();
  }

  function startReal() {
    isDemo = false;
    isAdmin = B8.auth.isAdmin();
    if (submit) submit.disabled = false;
    applyDefaultDate();
    loadCapsules();
  }

  /* ---------- 表单 ---------- */
  B8.on(bodyEl, 'input', syncCount);

  if (dateEl) {
    B8.on(dateEl, 'change', function () { dateEl.setAttribute('data-touched', '1'); });
    applyDefaultDate();
  }

  B8.on(form, 'submit', function (e) {
    e.preventDefault();
    if (isDemo) {
      B8.toast('数据库还没接，这里只是示例');
      return;
    }
    if (submitting) return;

    var title = B8.trim(titleEl ? titleEl.value : '', 40);
    var text = B8.trim(bodyEl ? bodyEl.value : '', 4000);
    var when = dateEl ? dateEl.value : '';
    var min = dateEl ? dateEl.min : '';

    if (!text) {
      setStatus('胶囊里总得写点东西。', 'err');
      if (bodyEl) bodyEl.focus();
      return;
    }
    if (!when || (min && when < min)) {
      setStatus('开启日期至少是明天。', 'err');
      if (dateEl) dateEl.focus();
      return;
    }

    var openDate = parseLocalDate(when);
    if (!openDate || openDate.getTime() <= Date.now()) {
      setStatus('开启日期要在未来。', 'err');
      if (dateEl) dateEl.focus();
      return;
    }

    submitting = true;
    setStatus('正在封存…');
    if (submit) {
      submit.disabled = true;
      submit.textContent = '封存中…';
    }

    B8.sb.rpc('b8_capsule_add', {
      p_token: B8.auth.token(),
      p_title: title,
      p_body: text,
      p_open_at: openDate.toISOString(),
      p_anon: !!(anonEl && anonEl.checked),
      p_nick: (anonEl && anonEl.checked) ? '' : (B8.auth.nick() || '')
    }).then(function (res) {
      submitting = false;
      if (submit) {
        submit.disabled = false;
        submit.textContent = '封存这颗胶囊';
      }
      if (titleEl) titleEl.value = '';
      if (bodyEl) bodyEl.value = '';
      if (anonEl) anonEl.checked = false;
      resetDate();
      syncCount();
      setStatus('封好了。到那天再回来。', 'ok');
      B8.toast('胶囊已经埋好');
      loadCapsules();
    }, function (err) {
      submitting = false;
      if (submit) {
        submit.disabled = false;
        submit.textContent = '封存这颗胶囊';
      }
      fail(err);
    });
  });

  B8.on(wall, 'click', function (e) {
    var actionEl = closest(e.target, '[data-act]');
    if (!actionEl) return;
    var card = closest(actionEl, '.capsule-card');
    if (!card) return;
    var item = findItem(card.getAttribute('data-id'));
    if (!item) return;
    if (actionEl.getAttribute('data-act') === 'hide') hideCapsule(card, item);
  });

  B8.on(wall, 'keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
    var el = e.target;
    if (!el || !el.getAttribute || el.getAttribute('role') !== 'button') return;
    e.preventDefault();
    el.click();
  });

  /* ---------- 启动 ---------- */
  setDateBounds();
  syncCount();

  B8.auth.ready(function (st) {
    if (!st || st.kind === 'none') return;
    if (st.kind === 'preview' || !B8.sb.ready) startDemo();
    else startReal();
  });
})();
