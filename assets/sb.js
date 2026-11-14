/* ============================================================
   B8 · Supabase 极简客户端
   ------------------------------------------------------------
   只做三件事：REST 查询、RPC 调用、Storage 上传。
   不引 supabase-js（省 100 KB，国内打开更快）。
   配置写在 assets/site-config.js 里；没配就整体降级，页面不报错。

   ⚠ 这个文件必须保留 supabase.proxy 通道（v2.171 加、v3.8.6 修回）：
   *.supabase.co 在 Cloudflare 后面，国内手机（尤其 iPhone Safari）
   经常根本连不上，表现就是登录页「网络不通」；请求压根没到 Supabase。
   所以：API 默认走韩国反代（site-config.js 的 supabase.proxy），
   反代整条不通时自动回退直连，直连不行再回退反代；坏掉的那条记 60 秒。
   别用 backups/ 里的旧副本覆盖本文件，会把反代逻辑丢掉（2026-11-14 就是这么坏的）。
   ============================================================ */
(function () {
  'use strict';

  var B8 = window.B8 = window.B8 || {};
  var cfg = window.B8_CONFIG || {};
  var sbCfg = cfg.supabase || {};

  var URL_ = (sbCfg.url || '').replace(/\/+$/, '');      // 直连 Supabase：图片地址 + 兜底
  var PROXY = (sbCfg.proxy || '').replace(/\/+$/, '');   // 韩国反代：API 主通道
  var KEY = sbCfg.anonKey || '';

  // 依次尝试的 API 前缀：反代在前，直连在后。
  // 没有配置 proxy 时（本地/自建），行为和以前完全一样，只连直连地址。
  var BASES = [];
  if (PROXY) BASES.push(PROXY);
  if (URL_ && URL_ !== PROXY) BASES.push(URL_);

  var DOWN = {};          // base → 复活时间戳（毫秒）
  var DOWN_MS = 60000;    // 一次传输层失败后，60 秒内不再试这条

  var sb = B8.sb = {
    ready: !!(URL_ && KEY),
    url: URL_,            // 直连地址：Storage 公开图片仍然用它
    proxy: PROXY || '',
    api: BASES[0] || '',  // 当前首选 API 前缀
    lastError: null
  };

  function now() { return Date.now ? Date.now() : new Date().getTime(); }

  /** 按优先级列出还活着的通道；全被标记为坏时，仍然按原顺序试一遍。 */
  function order() {
    var t = now();
    var live = [];
    for (var i = 0; i < BASES.length; i++) {
      if (!DOWN[BASES[i]] || DOWN[BASES[i]] <= t) live.push(BASES[i]);
    }
    return live.length ? live : BASES.slice(0);
  }

  function hostOf(url) {
    var m = /^https?:\/\/([^\/?#]+)/i.exec(url || '');
    return m ? m[1] : String(url || '');
  }

  function headers(extra) {
    var h = {
      apikey: KEY,
      Authorization: 'Bearer ' + KEY
    };
    if (extra) for (var k in extra) h[k] = extra[k];
    return h;
  }

  function parse(text) {
    if (!text) return null;
    try { return JSON.parse(text); } catch (e) { return text; }
  }

  function xhrRequest(method, url, body, extraHeaders, ms) {
    return new Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.open(method, url, true);
      var h = headers(extraHeaders);
      for (var k in h) {
        if (Object.prototype.hasOwnProperty.call(h, k)) {
          try { xhr.setRequestHeader(k, h[k]); } catch (e) {}
        }
      }
      var raw = null;
      if (body !== undefined && body !== null) {
        if (typeof Blob !== 'undefined' && body instanceof Blob) raw = body;
        else {
          if (!h['Content-Type']) xhr.setRequestHeader('Content-Type', 'application/json');
          raw = JSON.stringify(body);
        }
      }
      var limit = ms || 15000;
      xhr.timeout = limit;
      xhr.onload = function () {
        var data = parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) {
          sb.lastError = null;
          resolve(data);
          return;
        }
        var msg = (data && (data.message || data.error_description || data.error)) || ('HTTP ' + xhr.status);
        var err = new Error(msg);
        err.status = xhr.status;
        err.detail = data;
        if (xhr.status === 404 && /relation|does not exist|schema/i.test(msg)) {
          err.message = '数据表还没建好（' + msg + '）。请先执行 supabase/schema.sql。';
        } else if (xhr.status === 404 && /function|schema cache/i.test(msg)) {
          err.message = 'RPC 函数还没建好（' + msg + '）。请先执行 supabase/schema.sql。';
        }
        sb.lastError = err;
        reject(err);
      };
      // 传输层失败：连不上 / 被拦 / DNS 挂了。带上主机名，方便学生截图报障时定位。
      xhr.onerror = function () {
        var err = new Error('网络不通：连不上 ' + hostOf(url) +
          '（网络被拦、DNS 或代理都可能；换 Wi-Fi / 移动数据再试）');
        err.status = 0;
        err.transport = true;
        sb.lastError = err;
        reject(err);
      };
      xhr.ontimeout = function () {
        var err = new Error('请求超时：' + hostOf(url) + ' ' + Math.round(limit / 1000) + ' 秒没响应');
        err.status = 0;
        err.transport = true;
        sb.lastError = err;
        reject(err);
      };
      xhr.send(raw);
    });
  }

  function fetchRequest(method, url, body, extraHeaders, ms) {
    var ctrl = null;
    var opts = {
      method: method,
      headers: headers(extraHeaders),
      mode: 'cors',
      credentials: 'omit',
      cache: 'no-store'
    };
    if (body !== undefined && body !== null) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    if (window.AbortController) {
      ctrl = new AbortController();
      opts.signal = ctrl.signal;
    }

    var limit = ms || 15000;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, limit);

    return fetch(url, opts).then(function (res) {
      clearTimeout(timer);
      return res.text().then(function (text) {
        var data = parse(text);
        if (!res.ok) {
          var msg = (data && (data.message || data.error_description || data.error)) || ('HTTP ' + res.status);
          var err = new Error(msg);
          err.status = res.status;
          err.detail = data;
          sb.lastError = err;
          if (res.status === 404 && /relation|does not exist|schema/i.test(msg)) {
            err.message = '数据表还没建好（' + msg + '）。请先执行 supabase/schema.sql。';
          } else if (res.status === 404 && /function|schema cache/i.test(msg)) {
            err.message = 'RPC 函数还没建好（' + msg + '）。请先执行 supabase/schema.sql。';
          }
          throw err;
        }
        sb.lastError = null;
        return data;
      });
    }, function (e) {
      clearTimeout(timer);
      if (e && e.name === 'AbortError') {
        var terr = new Error('请求超时：' + hostOf(url) + ' ' + Math.round(limit / 1000) + ' 秒没响应');
        terr.status = 0;
        terr.transport = true;
        sb.lastError = terr;
        throw terr;
      }
      var err = new Error('网络不通：连不上 ' + hostOf(url) +
        '（' + (e && e.message ? e.message : '未知错误') + '）');
      err.status = 0;
      err.transport = true;
      sb.lastError = err;
      throw err;
    });
  }

  /**
   * 单条通道发一次。Safari / iOS 微信里 fetch 偶尔会直接 TypeError
   * （表现为「一登录就网络不通」），所以有 XHR 就一定用 XHR。
   */
  function send(method, url, body, extraHeaders, ms) {
    if (typeof XMLHttpRequest !== 'undefined') return xhrRequest(method, url, body, extraHeaders, ms);
    return fetchRequest(method, url, body, extraHeaders, ms);
  }

  /**
   * 底层请求。失败时抛出带可读信息的 Error，前端要原样显示给用户。
   *
   * · path 以 / 开头：按「反代 → 直连」顺序尝试，传输层失败（status 0）就换下一条；
   * · path 是完整 http(s) 地址：只发一次，不换通道（保持老调用方式可用）；
   * · HTTP 4xx / 5xx 是「服务器真的回了话」（口令不对、函数没建…），
   *   换通道照样是这个结果，所以直接抛，不重试、不吞。
   */
  function request(method, path, body, extraHeaders, ms) {
    if (!sb.ready) return Promise.reject(new Error('未配置 Supabase'));
    if (/^https?:\/\//i.test(path || '')) {
      return send(method, path, body, extraHeaders, ms);
    }
    var list = order();
    var idx = 0;
    function next(lastErr) {
      if (idx >= list.length) throw lastErr || new Error('没有可用的数据库地址');
      var base = list[idx++];
      return send(method, base + (path || ''), body, extraHeaders, ms).catch(function (err) {
        if (err && err.transport && idx < list.length) {
          DOWN[base] = now() + DOWN_MS;
          return next(err);
        }
        throw err;
      });
    }
    return Promise.resolve().then(function () { return next(null); });
  }

  sb.request = request;

  /** 查询：B8.sb.select('b8_photos', 'select=*&order=id.desc&limit=20') */
  sb.select = function (table, query) {
    return request('GET', '/rest/v1/' + table + (query ? '?' + query : ''));
  };

  /** 插入（受 RLS 约束）。失败返回错误对象。 */
  sb.insert = function (table, row, prefer) {
    return request('POST', '/rest/v1/' + table, row, {
      Prefer: prefer || 'return=representation'
    });
  };

  /** 补丁 */
  sb.patch = function (table, query, patch) {
    return request('PATCH', '/rest/v1/' + table + (query ? '?' + query : ''), patch, {
      Prefer: 'return=representation'
    });
  };

  /** 删除 */
  sb.remove = function (table, query) {
    return request('DELETE', '/rest/v1/' + table + (query ? '?' + query : ''), null, {
      Prefer: 'return=representation'
    });
  };

  /** RPC：B8.sb.rpc('b8_signin', {p_no:'...'}) */
  sb.rpc = function (fn, args) {
    return request('POST', '/rest/v1/rpc/' + fn, args || {});
  };

  /** Storage 上传，返回 public URL（公开图片仍走直连地址，和 v2.171 一致） */
  sb.upload = function (bucket, path, file) {
    var tail = '/storage/v1/object/' + bucket + '/' + path.split('/').map(encodeURIComponent).join('/');
    return request('POST', tail, undefined, {
      'x-upsert': 'false',
      'Content-Type': file.type || 'application/octet-stream'
    }, 60000).then(function () {
      return URL_ + '/storage/v1/object/public/' + bucket + '/' + path.split('/').map(encodeURIComponent).join('/');
    });
  };

  /** Storage 删除（需要策略允许） */
  sb.unlink = function (bucket, path) {
    return request('DELETE', '/storage/v1/object/' + bucket + '/' + path.split('/').map(encodeURIComponent).join('/'));
  };

  B8.publicUrl = function (bucket, path) {
    return URL_ + '/storage/v1/object/public/' + bucket + '/' + String(path).split('/').map(encodeURIComponent).join('/');
  };
})();
