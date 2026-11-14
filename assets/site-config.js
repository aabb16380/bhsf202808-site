/* ============================================================
   八班树洞 · 唯一配置点
   ------------------------------------------------------------
   Supabase 项目：zcfdtfmxtsxacsklqlhe（Singapore · free）
   悄悄话 / 提问 / 胶囊都不开放直读，只能带令牌走 RPC。
   ============================================================ */
window.B8_CONFIG = {
  site: {
    name: '八班树洞',
    domain: 'bhsf202808.site',
    github: 'aabb16380',
    version: 'v2.50'
  },

  supabase: {
    url: 'https://zcfdtfmxtsxacsklqlhe.supabase.co',
    anonKey: 'sb_publishable_kkJAT4lA9KFJGhua2V9gjw_tr-doaVN',
    // 国内直连 supabase.co（Cloudflare）经常连不上，手机（尤其 iPhone Safari）
    // 表现就是登录门「网络不通」；API 走首尔服务器的反代，坏了自动回退直连。
    proxy: 'https://api.bhsf202808.fun/sb'
  },

  links: {
    homes: '//bhsf202808.homes/',
    fun: '//bhsf202808.fun/',
    site: '//bhsf202808.site/'
  },

  features: {
    whispers: true,
    questions: true,
    capsules: true
  }
};
