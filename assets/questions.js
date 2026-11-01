/* ============================================================
   八班树洞 · 提问箱
   ------------------------------------------------------------
   未回答的问题排在前面；管理员能在卡片里直接写答案。
   问题、答案、署名都来自用户，渲染一律走 textContent。
   ============================================================ */
(function () {
  'use strict';

  var B8 = window.B8;
  if (!B8) return;

  var list = B8.qs('#question-list');
  var form = B8.qs('#ask-form');
  var bodyEl = B8.qs('#ask-body');
  var submit = B8.qs('#ask-submit');
  var countEl = B8.qs('#ask-count');
  var modeEl = B8.qs('#ask-mode');
  var nickField = B8.qs('#ask-nick-field');
  var nickEl = B8.qs('#ask-nick');
  var statusEl = B8.qs('#ask-status');
  var demoNote = B8.qs('#question-demo-note');
  var statEl = B8.qs('#stat-questions');

  if (!list || !form) return;

  var items = [];
  var isDemo = false;
  var isAdmin = false;
  var anon = true;
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

  function isAnswered(item) {
    return !!(item && item.answer && String(item.answer).replace(/\s/g, '') !== '');
  }

  function sortItems(arr) {
    arr.sort(function (a, b) {
      var aa = isAnswered(a) ? 1 : 0;
      var ab = isAnswered(b) ? 1 : 0;
      if (aa !== ab) return aa - ab;
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

  function setAnon(next, focusNick) {
    anon = !!next;
    B8.qsa('.seg-btn', modeEl).forEach(function (btn) {
      var isAnonBtn = btn.getAttribute('data-anon') === 'true';
      btn.setAttribute('aria-pressed', isAnonBtn === anon ? 'true' : 'false');
    });
    if (nickField) nickField.hidden = anon;
    // 切到「署名」时默认填真名，改了就算非真名
    if (!anon && nickEl && !nickEl.value && B8.auth && B8.auth.nick()) {
      nickEl.value = B8.auth.nick();
    }
    if (!anon && focusNick && nickEl) nickEl.focus();
  }

  function miniAct(text, action, extra) {
    var n = h('span', 'mini-act' + (extra ? ' ' + extra : ''), text);
    n.setAttribute('role', 'button');
    n.setAttribute('tabindex', '0');
    n.setAttribute('data-act', action);
    return n;
  }

  /* ---------- 一张问题卡 ---------- */
  /* ---------- 点赞 / 同问 ---------- */
  function likeKey(kind, id) { return 'b8.q.' + kind + '.' + id; }

  function liked(kind, id) {
    try { return localStorage.getItem(likeKey(kind, id)) === '1'; } catch (e) { return false; }
  }

  function markLiked(kind, id) {
    try { localStorage.setItem(likeKey(kind, id), '1'); } catch (e) {}
  }

  function reactBtn(kind, item, iconOn, iconOff, cls) {
    var btn = h('button', 'q-react' + (cls ? ' ' + cls : ''));
    btn.type = 'button';
    btn.setAttribute('data-act', kind);
    var here = liked(kind, item.id);
    if (here || isDemo) btn.disabled = true;
    if (here) btn.classList.add('is-on');

    btn.appendChild(h('span', 'q-react-icon', here ? iconOn : iconOff));
    var num = h('span', 'q-react-num', String(item[kind === 'answer' ? 'answer_likes' : kind === 'same' ? 'same_count' : 'likes'] || 0));
    btn.appendChild(num);

    B8.on(btn, 'click', function () {
      btn.disabled = true;
      B8.sb.rpc('b8_question_like', { p_token: B8.auth.token(), p_id: item.id, p_kind: kind })
        .then(function (n) {
          num.textContent = String(n == null ? num.textContent : n);
          btn.classList.add('is-on');
          btn.querySelector('.q-react-icon').textContent = iconOn;
          markLiked(kind, item.id);
          if (kind === 'same') B8.toast('已同问 +1');
        })
        .catch(function (err) {
          btn.disabled = false;
          B8.toast(errMessage(err));
        });
    });

    return btn;
  }
  function buildCard(item) {
    var answered = isAnswered(item);
    var card = h('article', 'q-card' + (answered ? ' is-answered' : ''));
    card.setAttribute('data-id', String(item.id));

    var top = h('div', 'q-top');
    var person = h('div', 'q-person');
    person.appendChild(h('span', 'q-nick', item.anon ? '匿名' : (item.nick || '匿名')));
    if (!item.anon && item.nick_real === false) {
      person.appendChild(h('span', 'tag plain nick-fake', '非真名'));
    }
    var time = h('time', 'q-time', B8.ago(item.created_at));
    if (item.created_at) time.setAttribute('datetime', item.created_at);
    person.appendChild(time);
    top.appendChild(person);

    var flags = h('div', 'q-flags');
    if (isDemo) flags.appendChild(tagEl('示例', 'plain'));
    flags.appendChild(answered ? tagEl('已回答', 'jade') : tagEl('待回答'));
    top.appendChild(flags);
    card.appendChild(top);

    var body = h('p', 'q-body');
    body.textContent = item.body || '';
    card.appendChild(body);

    if (answered) {
      var answer = h('div', 'q-answer');
      var head = h('div', 'q-answer-head');
      head.appendChild(h('span', 'q-answer-who', '回答 · ' + (item.answered_by || '管理员')));
      if (item.answered_at) head.appendChild(h('span', '', B8.ago(item.answered_at)));
      answer.appendChild(head);
      var answerBody = h('p', 'q-answer-body');
      answerBody.textContent = item.answer;
      answer.appendChild(answerBody);
      card.appendChild(answer);
    }

    var actions = h('div', 'q-actions');
    actions.appendChild(reactBtn('question', item, '♥', '♡'));
    actions.appendChild(reactBtn('same', item, '已同问', '同问', 'is-same'));
    if (answered) actions.appendChild(reactBtn('answer', item, '有用 ♥', '有用'));
    card.appendChild(actions);
    if (isAdmin) {
      var foot = h('div', 'q-foot');
      var acts = h('div', 'admin-actions');
      acts.appendChild(miniAct(answered ? '改回答' : '回答', 'answer'));
      acts.appendChild(miniAct('隐藏', 'hide', 'is-danger'));
      foot.appendChild(acts);
      card.appendChild(foot);
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
    clear(list);
    sortItems(items);

    if (!items.length) {
      list.appendChild(h('p', 'empty-note', '箱子里还是空的。第一个问题可以现在投。'));
    } else {
      var frag = document.createDocumentFragment();
      for (var i = 0; i < items.length; i++) frag.appendChild(buildCard(items[i]));
      list.appendChild(frag);
    }

    list.setAttribute('aria-busy', 'false');
    updateStat();
  }

  /* ---------- 管理员动作 ---------- */
  function openAnswerEditor(card, item) {
    var old = B8.qs('.answer-editor', card);
    if (old) {
      card.removeChild(old);
      return;
    }

    var box = h('form', 'answer-editor admin-editor');
    var ta = h('textarea', 'textarea');
    ta.maxLength = 1500;
    ta.rows = 4;
    ta.placeholder = '写在这个框里，保存后会显示在问题下面';
    ta.value = item.answer || '';
    box.appendChild(ta);

    var foot = h('div', 'admin-editor-foot');
    var save = h('button', 'btn seal sm', '保存回答');
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
      var text = B8.trim(ta.value, 1500);
      if (!text) {
        status.className = 'form-status err';
        status.textContent = '回答不能空着。';
        ta.focus();
        return;
      }

      save.disabled = true;
      save.textContent = '保存中…';
      status.className = 'form-status';
      status.textContent = '';

      B8.sb.rpc('b8_question_answer', {
        p_token: B8.auth.token(),
        p_id: item.id,
        p_answer: text
      }).then(function () {
        item.answer = text;
        item.answered_by = B8.auth.nick() || '管理员';
        item.answered_at = new Date().toISOString();
        renderAll();
        B8.toast('回答已保存');
      }, function (err) {
        save.disabled = false;
        save.textContent = '保存回答';
        var msg = errMessage(err);
        status.className = 'form-status err';
        status.textContent = msg;
        B8.toast(msg);
      });
    });
  }

  function hideQuestion(card, item) {
    if (!window.confirm('隐藏之后，这个问题就不会再出现在箱子里。确定吗？')) return;
    card.setAttribute('data-busy', '1');
    B8.sb.rpc('b8_question_hide', {
      p_token: B8.auth.token(),
      p_id: item.id,
      p_hidden: true
    }).then(function () {
      items = items.filter(function (x) { return String(x.id) !== String(item.id); });
      renderAll();
      B8.toast('已隐藏');
    }, function (err) {
      card.removeAttribute('data-busy');
      fail(err);
    });
  }

  /* ---------- 数据 ---------- */
  function loadQuestions() {
    list.setAttribute('aria-busy', 'true');
    B8.sb.rpc('b8_question_list', {
      p_token: B8.auth.token(),
      p_limit: 80
    }).then(function (rows) {
      items = Array.isArray(rows) ? rows : [];
      renderAll();
    }, function (err) {
      clear(list);
      list.setAttribute('aria-busy', 'false');
      var msg = errMessage(err);
      list.appendChild(h('p', 'list-error', '问题没读出来：' + msg));
      if (statEl) statEl.textContent = '—';
      B8.toast(msg);
    });
  }

  function demoData() {
    var now = Date.now();
    return [
      {
        id: 'demo-q1', nick: '匿名', anon: true,
        body: '班服的尺寸还能改吗？我上次好像报小了一号。',
        answer: '', answered_by: '', answered_at: null,
        hidden: false,
        created_at: new Date(now - 1000 * 60 * 60 * 5).toISOString()
      },
      {
        id: 'demo-q2', nick: '走读生', anon: false,
        body: '图书馆三楼靠窗那排，晚上闭馆前会清座吗？',
        answer: '', answered_by: '', answered_at: null,
        hidden: false,
        created_at: new Date(now - 1000 * 60 * 60 * 28).toISOString()
      },
      {
        id: 'demo-q3', nick: '匿名', anon: true,
        body: '想问一下，运动会报名什么时候截止？',
        answer: '这周五放学前找体委。接力还差两个人，想跑的直接来。',
        answered_by: '体委',
        answered_at: new Date(now - 1000 * 60 * 90).toISOString(),
        hidden: false,
        created_at: new Date(now - 1000 * 60 * 60 * 52).toISOString()
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
    loadQuestions();
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
    if (text.length < 2) {
      setStatus('问题至少写两个字。', 'err');
      if (bodyEl) bodyEl.focus();
      return;
    }

    var nick = anon ? '' : B8.trim(nickEl ? nickEl.value : '', 16);
    submitting = true;
    setStatus('正在投进箱子…');
    if (submit) {
      submit.disabled = true;
      submit.textContent = '投递中…';
    }

    B8.sb.rpc('b8_question_add', {
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
        answer: '',
        answered_by: '',
        answered_at: null,
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
        submit.textContent = '投进提问箱';
      }
      setStatus('问题已经投进箱子了。', 'ok');
      B8.toast('投进去了');
    }, function (err) {
      submitting = false;
      if (submit) {
        submit.disabled = false;
        submit.textContent = '投进提问箱';
      }
      fail(err);
    });
  });

  B8.on(list, 'click', function (e) {
    var actionEl = closest(e.target, '[data-act]');
    if (!actionEl) return;
    var card = closest(actionEl, '.q-card');
    if (!card) return;
    var item = findItem(card.getAttribute('data-id'));
    if (!item) return;

    if (actionEl.getAttribute('data-act') === 'answer') openAnswerEditor(card, item);
    else if (actionEl.getAttribute('data-act') === 'hide') hideQuestion(card, item);
  });

  B8.on(list, 'keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
    var el = e.target;
    if (!el || !el.getAttribute || el.getAttribute('role') !== 'button') return;
    e.preventDefault();
    el.click();
  });

  /* ---------- 启动 ---------- */
  setAnon(true, false);
  syncCount();

  // 提权（输密钥）之后 isAdmin 才会变 true，必须重画一次，
  // 否则「回答」按钮永远不出现——这就是之前点不了回答的原因。
  document.addEventListener('b8:auth', function () {
    var was = isAdmin;
    isAdmin = B8.auth.isAdmin();
    if (was !== isAdmin) renderAll();
  });
  B8.auth.ready(function (st) {
    if (!st || st.kind === 'none') return;
    if (st.kind === 'preview' || !B8.sb.ready) startDemo();
    else startReal();
  });
})();
