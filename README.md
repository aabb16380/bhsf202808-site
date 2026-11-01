# 八班树洞 · bhsf202808.site

北京四中 2028 届 8 班的树洞：**悄悄话 / 提问箱 / 时光胶囊**。
单页静态站，无构建步骤，GitHub Pages 直接从仓库根目录发布。

- 版本：`v1.0`
- 构建号：`20261101a1`
- 默认形态：夜色；右上角可切日间，选择存在 `localStorage` 的 `b8.mode`
- 共用设计系统：`_shared/base.css`，本站样式只写在 `assets/site.css`
- 数据：与另外两站共用一个 Supabase 项目，所有写操作走 RPC

---

## 1. 目录

```text
site/
├─ index.html              单页：首屏 + 登录门 + 三个板块
├─ 404.html
├─ test/index.html         调试入口，自动加 ?t=<时间戳>
├─ robots.txt
├─ .nojekyll
├─ CNAME                   bhsf202808.site
├─ README.md
└─ assets/
   ├─ site-config.js       **唯一配置点**
   ├─ site.css             本站源样式
   ├─ styles.css           由 sync.ps1 生成，别直接改
   ├─ main.js sb.js auth.js  由 sync.ps1 从 _shared 复制
   ├─ whispers.js
   ├─ questions.js
   └─ capsules.js
```

> `styles.css`、`main.js`、`sb.js`、`auth.js` 都是生成/复制的产物。
> 改样式只改 `assets/site.css`，改公共逻辑只改 `_shared/` 下的原件，然后跑同步脚本。

---

## 2. 把数据库接上

### 2.1 跑 SQL

1. 打开三站共用的 Supabase 项目 → **SQL Editor**。
2. 把仓库根目录的 `supabase/schema.sql` **整段**贴进去，点 Run。
3. 这个脚本是幂等的，以后改了再跑一遍即可。

它会建好：

- `b8_keys` / `b8_sessions`：口令（只存 sha256）和登录令牌
- `b8_whispers` / `b8_questions` / `b8_capsules`：本站三块内容
- 所有读写 RPC，以及 RLS（匿名 key 不能直读这些内容）
- `.fun` 用的照片桶；本站不用它，但共用一份 schema

### 2.2 填配置

编辑 `assets/site-config.js`：

```js
supabase: {
  url: 'https://xxxx.supabase.co',
  anonKey: 'eyJhbGciOi...' // anon public key
}
```

- 只填 **Project URL** 和 **anon public key**。
- 永远不要把 `service_role` key 写进前端。
- 配置为空时站点会自动进入预览模式：三个板块各显示几条示例，写入按钮禁用。这是本地首次预览的正常状态。

### 2.3 跑同步、看效果

在仓库根目录（`bhsf202808/`）执行：

```powershell
pwsh -File _shared/sync.ps1
```

它会把 `base.css + assets/site.css` 拼成 `assets/styles.css`，并复制共用 JS。
**每次改完 `site.css` 都要跑一次。**

本地预览（不要用 `file://`，登录门/网络请求都需要 http）：

```powershell
python -m http.server 8803 -d bhsf202808/site
# 打开 http://127.0.0.1:8803/
```

调试入口：`http://127.0.0.1:8803/test/?to=/`
它会跳转到 `/?t=<时间戳>`，让 CSS/JS 全部绕过缓存。

---

## 3. 口令管理

### 3.1 先想清楚两种口令

| 类型 | 用途 | 有效期 | 权限 |
|---|---|---|---|
| `class` | 全班同学 | 30 天 | 发悄悄话、提问、埋胶囊、点赞 |
| `admin` | 班委 / 网站维护 | 1 天 | 班级权限 + 回复、置顶、隐藏、回答、隐藏胶囊 |

管理员令牌很短是有意的：管理员密钥能改内容，丢了影响大。

### 3.2 第一次灌口令

在 SQL Editor 里执行（把中文替换成真正的口令，**只执行一次**）：

```sql
insert into public.b8_keys (kind, label, hash)
values
  ('class', '全班通用', public.b8_sha('替换成班级口令')),
  ('admin', '班委',     public.b8_sha('替换成管理员密钥'))
on conflict (hash) do nothing;
```

- 数据库只保存 sha256，不保存明文；口令丢了无法找回，只能发新的。
- 不要把口令写进本仓库的任何文件。
- `label` 是没填昵称时的默认称呼，也是后台识别口令用途的标签。

### 3.3 换口令 / 停用旧口令

```sql
-- 1) 看一眼现有口令（只有标签/状态，看不到明文）
select id, kind, label, active, created_at, used_at
from public.b8_keys
order by kind, id;

-- 2) 灌入一条新口令
insert into public.b8_keys (kind, label, hash)
values ('class', '2027 春季版', public.b8_sha('新的班级口令'));

-- 3) 停用旧口令，并把已经发出去的旧会话一起作废
update public.b8_keys set active = false where id = 旧口令的id;
delete from public.b8_sessions where kind = 'class';
```

同学重新输入新口令即可。管理员密钥轮换同理；若只是怀疑泄露，先 `active = false` 再删除会话。

> 口令只是前端的门，真正的权限在 RPC 里：没有有效令牌，写操作会被数据库拒绝。
> 静态站挡不住能直接读源码的人，所以不要往站点里塞不该被看到的秘密。

---

## 4. 三个板块怎么用

### 悄悄话

- 1000 字以内，匿名是默认；署名时会用你输入的昵称，留空则用登录昵称。
- 发布后立刻出现在卡片流，并带上「刚刚」。
- 点赞只能点一次，记录在本地 `b8.liked.whisper.<id>`；清浏览器数据后可以再点。
- 顶部「随便抽一条」会随机高亮一张便签并滚过去。
- 管理员在每张卡片上能看到 **回复 / 置顶 / 隐藏**：
  - 回复用 `b8_whisper_post_admin('reply')`，内容显示在便签下方
  - 置顶会排到所有未置顶内容前面
  - 隐藏只从列表里移除，不删除数据库记录；目前没有站内恢复入口

### 提问箱

- 问题 2–1000 字，匿名 / 实名默认匿名。
- 未回答的排前面，显示「待回答」；回答后显示答案、回答者和时间。
- 管理员可以在卡片里直接写回答（`b8_question_answer`），也可以隐藏。
- 回答可以再次编辑；保存后卡片会按「待回答优先」重新排序。

### 时光胶囊

- 标题可空，空标题由服务端存成「无题」；正文 4000 字。
- 开启日期最早明天；页面默认填 `2028-06-09`（高考后第一天）。
- 勾「匿名封存」则只显示匿名，不勾则用登录称呼署名。
- 封存中的卡片只显示标题和「封存中 · 还有 N 天」。正文在服务端被替换成 `null`，根本不会进前端 DOM。
- 管理员可以隐藏胶囊；目前没有站内恢复 / 删除入口。

---

## 5. 胶囊到点怎么“开”

**没有“手动开启”按钮，也不需要做任何操作。** 打开页面时，
`b8_capsule_list` 会用数据库时间比较 `now() >= open_at`：

- 没到点：`body` 返回 `null`，页面只渲染信封和剩余天数
- 到点：`is_open = true`，正文随列表返回，卡片自动展开并显示开启日期

开启日期来自当天本地时间的零点（前端把 `<input type="date">` 解释成本地 00:00 再转成带时区的时间），
所以选 `2028-06-09`，就是 2028 年 6 月 9 日那天打开。

想确认 / 提前打开 / 延后，只能通过数据库：

```sql
-- 查看所有胶囊的开启状态
select id, title, nick, anon, open_at,
       now() >= open_at as is_open, hidden, created_at
from public.b8_capsules
order by open_at;

-- 提前到“现在”（刷新页面即可看到正文）
update public.b8_capsules
set open_at = now() - interval '1 minute'
where id = 胶囊的id;

-- 延后
update public.b8_capsules
set open_at = '2029-06-09 00:00:00+08'
where id = 胶囊的id;

-- 恢复被隐藏的胶囊
update public.b8_capsules set hidden = false where id = 胶囊的id;
```

同理，被隐藏的悄悄话 / 问题也可以在 SQL Editor 里恢复：

```sql
update public.b8_whispers  set hidden = false where id = ...;
update public.b8_questions set hidden = false where id = ...;
```

---

## 6. 部署

这个目录在独立仓库里应该就是**仓库根目录**：

1. 确认 `CNAME` 仍只有一行 `bhsf202808.site`。
2. 确认 `assets/styles.css`、`assets/main.js`、`assets/sb.js`、`assets/auth.js` 都已生成并提交。
3. 推送到 GitHub 的 `main`，GitHub Pages 会直接从根目录发布。
4. 域名解析到 GitHub Pages，勾选 Enforce HTTPS。
5. 改动样式或 JS 后，把构建号从 `20261101a1` 往后递增（`20261101a2`…），避免老访客拿到缓存。

`test/` 是调试用的缓存绕行入口，不适合放进导航供日常使用；
`robots.txt` 已经不允许抓取它，`404.html` 也带 `noindex`。

---

## 7. 排错

| 现象 | 先看哪里 |
|---|---|
| 打开只有示例和「数据库还没接」提示 | `site-config.js` 的 `url` / `anonKey` 是否为空；空是预览模式 |
| 登录提示「口令不对」 | `b8_keys` 是否有 `active = true` 的对应 hash；sql 里 `b8_sha` 是否一致 |
| 写操作报「登录已过期」 | 令牌 30 天到期；退出后重新登录 |
| 所有接口 404 | `supabase/schema.sql` 是否完整跑过；Supabase 的 schema cache 需稍等 |
| 样式没变化 | 是否跑了 `sync.ps1`；是否带着旧的 `?t=` 访问 |
| 手机页面被撑宽 | 检查浏览器控制台是否有超长无空格字符串；正文已设 `overflow-wrap: anywhere` |

更详细的共用约定见 `_shared/BUILD-SPEC.md`。
