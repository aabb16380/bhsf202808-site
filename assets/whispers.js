/* ============================================================
   八班树洞 · 悄悄话
   ------------------------------------------------------------
   一条悄悄话是一张便签：字可以歪，边界不能歪。
   用户写下的字一律走 textContent；只有固定的骨架用 DOM 拼。
   预览模式不碰网络，示例卡片明确标「示例」。
   ============================================================ */
(function () {
  'use strict';

  var B8 = window.B8;
  if (!B8) return;

  var list = B8.qs('#whisper-list');
  var form = B8.qs('#whisper-form');
  var bodyEl = B8.qs('#whisper-body');
  var submit = B8.qs('#whisper-submit');
  var countEl = B8.qs('#whisper-count');
  var modeEl = B8.qs('#whisper-mode');
  var nickField = B8.qs('#whisper-nick-field');
  var nickEl = B8.qs('#whisper-nick');
  var statusEl = B8.qs('#whisper-status');
  var randomBtn = B8.qs('#whisper-random');
  var demoNote = B8.qs('#whisper-demo-note');
  var statEl = B8.qs('#stat-whispers');

  if (!list || !form) return;

  var items = [];
  var isDemo = false;
  var isAdmin = false;
  var anon = true;
  var submitting = false;
  var pickTimer = 0;

  /* ---------- 小工具 ---------- */
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

  function setStatus(msg, kind) {
    if (!statusEl) return;
    statusEl.textContent = msg || '';
    statusEl.className = 'form-status' + (kind ? ' ' + kind : '');
  }

  function errMessage(err) {
    return (err && err.message) ? err.message : '请求失败，请稍后再试';
  }

  function fail(err) {
    var msg = errMessage(err);
    setStatus(msg, 'err');
    B8.toast(msg);
  }

  function setBusy(btn, busy, label) {
    if (!btn) return;
    if (busy) {
      btn.disabled = true;
      if (label) btn.textContent = label;
    } else {
      btn.disabled = false;
      if (label) btn.textContent = label;
    }
  }

  function sortItems(arr) {
    arr.sort(function (a, b) {
      var pa = a.pinned ? 1 : 0;
      var pb = b.pinned ? 1 : 0;
      if (pa !== pb) return pb - pa;
      var ta = new Date(a.created_at || 0).getTime() || 0;
      var tb = new Date(b.created_at || 0).getTime() || 0;
      return tb - ta;
    });
    return arr;
  }

  function updateStat() {
    if (statEl) statEl.textContent = B8.num(items.length);
  }

  function syncCount() {
    if (!bodyEl || !countEl) return;
    var n = bodyEl.value.length;
    countEl.textContent = String(n);
    var wrap = countEl.parentNode;
    if (wrap) {
      if (n >= 900) wrap.classList.add('near');
      else wrap.classList.remove('near');
    }
  }

  function markLiked(id) {
    try { localStorage.setItem('b8.liked.whisper.' + id, '1'); } catch (e) {}
  }

  function hasLiked(id) {
    try { return localStorage.getItem('b8.liked.whisper.' + id) === '1'; } catch (e) { return false; }
  }

  function setAnon(next, focusNick) {
    anon = !!next;
    B8.qsa('.seg-btn', modeEl).forEach(function (btn) {
      var isAnonBtn = btn.getAttribute('data-anon') === 'true';
      btn.setAttribute('aria-pressed', isAnonBtn === anon ? 'true' : 'false');
    });
    if (nickField) nickField.hidden = anon;
    if (!anon && focusNick && nickEl) nickEl.focus();
  }

  /* ---------- 一张便签 ---------- */
  function buildCard(item) {
    var card = h('article', 'whisper');
    card.setAttribute('data-id', String(item.id));
    if (item.pinned) card.classList.add('is-pinned');

    var top = h('div', 'whisper-top');
    var who = h('div', 'whisper-who');
    who.appendChild(h('span', 'whisper-nick', item.anon ? '匿名' : (item.nick || '匿名')));

    var time = h('time', 'whisper-time', B8.ago(item.created_at));
    if (item.created_at) time.setAttribute('datetime', item.created_at);
    who.appendChild(time);
    top.appendChild(who);

    var tags = h('div', 'whisper-tags');
    if (isDemo) tags.appendChild(tagEl('示例', 'plain'));
    if (item.pinned) tags.appendChild(tagEl('置顶', 'pin'));
    if (tags.childNodes.length) top.appendChild(tags);
    card.appendChild(top);

    // 正文不拼 HTML：换行交给 CSS 的 white-space: pre-wrap。
    var body = h('p', 'whisper-body');
    body.textContent = item.body || '';
    card.appendChild(body);

    var foot = h('div', 'whisper-foot');
    var liked = hasLiked(item.id);
    var like = h('button', 'like-btn');
    like.type = 'button';
    like.setAttribute('data-act', 'like');
    like.setAttribute('aria-label', '赞这条悄悄话，现在有 ' + B8.num(item.likes || 0) + ' 个赞');
    like.setAttribute('aria-pressed', liked ? 'true' : 'false');
    if (liked) like.classList.add('liked');
    if (isDemo || liked) like.disabled = true;

    var heart = h('span', 'like-heart', liked ? '♥' : '♡');
    heart.setAttribute('aria-hidden', 'true');
    like.appendChild(heart);
    like.appendChild(h('span', 'like-count', B8.num(item.likes || 0)));
    foot.appendChild(like);

    if (isAdmin) {
      var acts = h('div', 'admin-actions');
      acts.appendChild(miniAct(item.reply ? '改回复' : '回复', 'reply'));
      acts.appendChild(miniAct(item.pinned ? '取消置顶' : '置顶', 'pin'));
      acts.appendChild(miniAct('隐藏', 'hide', 'is-danger'));
      foot.appendChild(acts);
    }

    card.appendChild(foot);

    if (item.reply) {
      var reply = h('div', 'reply-block');
      var rhead = h('div', 'reply-head');
      rhead.appendChild(h('span', 'reply-who', '回复 · ' + (item.reply_by || '管理员')));
      if (item.replied_at) rhead.appendChild(h('span', '', B8.ago(item.replied_at)));
      reply.appendChild(rhead);
      var rbody = h('p', 'reply-body');
      rbody.textContent = item.reply;
      reply.appendChild(rbody);
      card.appendChild(reply);
    }

    return card;
  }

  function miniAct(text, action, extra) {
    var n = h('span', 'mini-act' + (extra ? ' ' + extra : ''), text);
    n.setAttribute('role', 'button');
    n.setAttribute('tabindex', '0');
    n.setAttribute('data-act', action);
    return n;
  }

  function renderAll() {
    clear(list);
    sortItems(items);

    if (!items.length) {
      var empty = h('p', 'empty-note', '洞里还没有人开口。第一句可以是你。');
      list.appendChild(empty);
    } else {
      var frag = document.createDocumentFragment();
      for (var i = 0; i < items.length; i++) frag.appendChild(buildCard(items[i]));
      list.appendChild(frag);
    }

    list.setAttribute('aria-busy', 'false');
    updateStat();
  }

  function findItem(id) {
    for (var i = 0; i < items.length; i++) {
      if (String(items[i].id) === String(id)) return items[i];
    }
    return null;
  }

  /* ---------- 管理员动作 ---------- */
  function openReplyEditor(card, item) {
    var old = B8.qs('.reply-editor', card);
    if (old) {
      card.removeChild(old);
      return;
    }

    var box = h('form', 'reply-editor admin-editor');
    var ta = h('textarea', 'textarea');
    ta.maxLength = 600;
    ta.rows = 3;
    ta.placeholder = '回复会显示在这条悄悄话下面';
    ta.value = item.reply || '';
    box.appendChild(ta);

    var foot = h('div', 'admin-editor-foot');
    var save = h('button', 'btn seal sm', '保存回复');
    save.type = 'submit';
    var cancel = h('button', 'btn ghost sm', '取消');
    cancel.type = 'button';
    var status = h('span', 'form-status');
    foot.appendChild(save);
    foot.appendChild(cancel);
    foot.appendChild(status);
    box.appendChild(foot);
    card.appendChild(box);
    ta.focus();

    B8.on(cancel, 'click', function () {
      if (box.parentNode) box.parentNode.removeChild(box);
    });

    B8.on(box, 'submit', function (e) {
      e.preventDefault();
      var text = B8.trim(ta.value, 600);
      if (!text) {
        status.className = 'form-status err';
        status.textContent = '回复不能空着。';
        ta.focus();
        return;
      }

      save.disabled = true;
      save.textContent = '保存中…';
      status.className = 'form-status';
      status.textContent = '';

      B8.sb.rpc('b8_whisper_post_admin', {
        p_token: B8.auth.token(),
        p_id: item.id,
        p_action: 'reply',
        p_text: text
      }).then(function () {
        item.reply = text;
        item.reply_by = B8.auth.nick() || '管理员';
        item.replied_at = new Date().toISOString();
        var fresh = buildCard(item);
        if (card.parentNode) {
          list.replaceChild(fresh, card);
          fresh.classList.add('is-picked');
          setTimeout(function () { fresh.classList.remove('is-picked'); }, 1600);
        }
        B8.toast('回复已经放上去了');
      }, function (err) {
        save.disabled = false;
        save.textContent = '保存回复';
        var msg = errMessage(err);
        status.className = 'form-status err';
        status.textContent = msg;
        B8.toast(msg);
      });
    });
  }

  function togglePin(card, item) {
    if (card.getAttribute('data-busy') === '1') return;
    card.setAttribute('data-busy', '1');
    B8.sb.rpc('b8_whisper_post_admin', {
      p_token: B8.auth.token(),
      p_id: item.id,
      p_action: 'pin',
      p_text: ''
    }).then(function () {
      item.pinned = !item.pinned;
      renderAll();
      B8.toast(item.pinned ? '已经置顶' : '取消置顶了');
    }, function (err) {
      card.removeAttribute('data-busy');
      fail(err);
    });
  }

  function hideWhisper(card, item) {
    if (!window.confirm('隐藏之后，这条悄悄话就不会再出现在洞里。确定吗？')) return;
    card.setAttribute('data-busy', '1');
    B8.sb.rpc('b8_whisper_post_admin', {
      p_token: B8.auth.token(),
      p_id: item.id,
      p_action: 'hide',
      p_text: ''
    }).then(function () {
      items = items.filter(function (x) { return String(x.id) !== String(item.id); });
      renderAll();
      B8.toast('已隐藏');
    }, function (err) {
      card.removeAttribute('data-busy');
      fail(err);
    });
  }

  function handleLike(btn, item) {
    if (btn.disabled || hasLiked(item.id)) return;
    btn.disabled = true;
    B8.sb.rpc('b8_whisper_like', {
      p_token: B8.auth.token(),
      p_id: item.id,
      p_delta: 1
    }).then(function (n) {
      var likes = (n === null || n === undefined) ? (Number(item.likes || 0) + 1) : Number(n);
      item.likes = likes;
      markLiked(item.id);
      btn.classList.add('liked');
      btn.setAttribute('aria-pressed', 'true');
      btn.setAttribute('aria-label', '赞这条悄悄话，现在有 ' + B8.num(likes) + ' 个赞');
      var heart = B8.qs('.like-heart', btn);
      if (heart) heart.textContent = '♥';
      var num = B8.qs('.like-count', btn);
      if (num) num.textContent = B8.num(likes);
    }, function (err) {
      btn.disabled = false;
      fail(err);
    });
  }

  /* ---------- 数据 ---------- */
  function loadWhispers() {
    list.setAttribute('aria-busy', 'true');
    B8.sb.rpc('b8_whisper_list', {
      p_token: B8.auth.token(),
      p_limit: 80
    }).then(function (rows) {
      items = Array.isArray(rows) ? rows : [];
      renderAll();
    }, function (err) {
      clear(list);
      list.setAttribute('aria-busy', 'false');
      var msg = errMessage(err);
      list.appendChild(h('p', 'list-error', '悄悄话没读出来：' + msg));
      if (statEl) statEl.textContent = '—';
      B8.toast(msg);
    });
  }

  function demoData() {
    var now = Date.now();
    return [
      {
        id: 'demo-w1', nick: '匿名', anon: true,
        body: '今天晚自习前，看见操场上的灯一盏一盏亮起来。突然觉得，这样的傍晚好像也没剩多少次了。',
        likes: 12,
        reply: '所以每次亮灯都看一会儿吧。',
        reply_by: '班委',
        replied_at: new Date(now - 1000 * 60 * 38).toISOString(),
        pinned: true, hidden: false,
        created_at: new Date(now - 1000 * 60 * 60 * 3).toISOString()
      },
      {
        id: 'demo-w2', nick: '匿名', anon: true,
        body: '物理卷子最后一题，我其实到现在也没弄懂。问不出口，就写在这里。',
        likes: 7, reply: '', reply_by: '', replied_at: null,
        pinned: false, hidden: false,
        created_at: new Date(now - 1000 * 60 * 60 * 11).toISOString()
      },
      {
        id: 'demo-w3', nick: '后排靠窗', anon: false,
        body: '想对某个人说，上次借我的伞我洗干净了，就是一直没找到机会还。',
        likes: 4, reply: '', reply_by: '', replied_at: null,
        pinned: false, hidden: false,
        created_at: new Date(now - 1000 * 60 * 60 * 26).toISOString()
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
    var me = B8.auth.nick();
    if (nickEl && me) nickEl.placeholder = '留空就用「' + me + '」';
    loadWhispers();
  }

  /* ---------- 事件 ---------- */
  B8.on(bodyEl, 'input', syncCount);
  B8.on(modeEl, 'click', function (e) {
    var btn = closest(e.target, '.seg-btn');
    if (!btn) return;
    setAnon(btn.getAttribute('data-anon') === 'true', true);
  });

  B8.on(form, 'submit', function (e) {
    e.preventDefault();
    if (isDemo) {
      B8.toast('数据库还没接，这里只是示例');
      return;
    }
    if (submitting) return;

    var text = B8.trim(bodyEl ? bodyEl.value : '', 1000);
    if (!text) {
      setStatus('写点什么再放进去。', 'err');
      if (bodyEl) bodyEl.focus();
      return;
    }

    var nick = anon ? '' : B8.trim(nickEl ? nickEl.value : '', 16);
    submitting = true;
    setStatus('正在放进树洞…');
    if (submit) {
      submit.disabled = true;
      submit.textContent = '发送中…';
    }

    B8.sb.rpc('b8_whisper_add', {
      p_token: B8.auth.token(),
      p_body: text,
      p_nick: nick,
      p_anon: anon
    }).then(function (res) {
      var fallbackNick = B8.auth.nick() || '同学';
      var item = {
        id: res && res.id ? res.id : ('local-' + Date.now()),
        nick: anon ? '匿名' : (nick || fallbackNick),
        anon: anon,
        body: text,
        likes: 0,
        reply: '',
        reply_by: '',
        replied_at: null,
        pinned: false,
        hidden: false,
        created_at: new Date().toISOString()
      };
      items.unshift(item);
      renderAll();

      if (bodyEl) bodyEl.value = '';
      if (nickEl) nickEl.value = '';
      setAnon(true, false);
      syncCount();
      submitting = false;
      if (submit) {
        submit.disabled = false;
        submit.textContent = '放进树洞';
      }
      setStatus('已经放进树洞了。', 'ok');
      B8.toast('放好了');
    }, function (err) {
      submitting = false;
      if (submit) {
        submit.disabled = false;
        submit.textContent = '放进树洞';
      }
      fail(err);
    });
  });

  B8.on(list, 'click', function (e) {
    var actionEl = closest(e.target, '[data-act]');
    if (!actionEl) return;
    var card = closest(actionEl, '.whisper');
    if (!card) return;
    var item = findItem(card.getAttribute('data-id'));
    if (!item) return;
    var action = actionEl.getAttribute('data-act');

    if (action === 'like') handleLike(actionEl, item);
    else if (action === 'reply') openReplyEditor(card, item);
    else if (action === 'pin') togglePin(card, item);
    else if (action === 'hide') hideWhisper(card, item);
  });

  // 管理员动作是 span，键盘也得能用。
  B8.on(list, 'keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
    var el = e.target;
    if (!el || !el.getAttribute || el.getAttribute('role') !== 'button') return;
    e.preventDefault();
    el.click();
  });

  B8.on(randomBtn, 'click', function () {
    var cards = B8.qsa('.whisper', list);
    if (!cards.length) {
      B8.toast('洞里还没有悄悄话');
      return;
    }
    B8.qsa('.is-picked', list).forEach(function (c) { c.classList.remove('is-picked'); });
    var card = cards[Math.floor(Math.random() * cards.length)];
    card.classList.add('is-picked');
    var reduce = false;
    try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
    try { card.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' }); }
    catch (e2) { card.scrollIntoView(); }
    clearTimeout(pickTimer);
    pickTimer = setTimeout(function () { card.classList.remove('is-picked'); }, 2800);
    B8.toast('抽到一条');
  });

  /* ---------- 启动 ---------- */
  setAnon(true, false);
  syncCount();

  B8.auth.ready(function (st) {
    if (!st || st.kind === 'none') return;
    if (st.kind === 'preview' || !B8.sb.ready) startDemo();
    else startReal();
  });
})();
