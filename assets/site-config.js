/* ============================================================
   八班树洞 · 唯一配置点
   ------------------------------------------------------------
   和三站共用一个 Supabase 项目：先跑 supabase/schema.sql，
   再把 Project URL 与 anon public key 填进来。
   ============================================================ */
window.B8_CONFIG = {
  site: {
    name: '八班树洞',
    domain: 'bhsf202808.site',
    github: 'aabb16380',
    version: 'v1.0'
  },

  supabase: {
    url: '',
    anonKey: ''
  },

  links: {
    homes: 'https://bhsf202808.homes/',
    fun: 'https://bhsf202808.fun/',
    site: 'https://bhsf202808.site/'
  },

  features: {
    whispers: true,
    questions: true,
    capsules: true
  }
};
