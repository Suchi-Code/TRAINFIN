/* ============================================================
   js/auth.js — Supabase auth กลาง: guard เข้าใช้งาน + โหลดชื่อผู้ใช้ที่ sidebar
   ------------------------------------------------------------
   ต้องโหลด js/config.js และ Supabase JS SDK มาก่อนไฟล์นี้เสมอ

   การใช้งาน:
     - หน้าที่ต้องล็อกอินก่อนถึงจะเข้าได้: เรียก checkAuth() ทันทีตอนโหลดสคริปต์
       (จะเด้งกลับไปหน้า login อัตโนมัติถ้ายังไม่มี session)
     - ทุกหน้าที่มี sidebar: เรียก loadCurrentUser() เพื่อเติมชื่อผู้ใช้ใน
       <b id="userName"> และ <span id="userSub"> ให้อัตโนมัติ
   ============================================================ */
(function () {
  const CFG = window.APP_CONFIG || {};

  let _client = null;
  function getAuthClient() {
    if (_client) return _client;
    if (!window.supabase || !window.supabase.createClient) {
      console.error('Supabase SDK ยังไม่โหลด — auth.js ทำงานไม่ได้');
      return null;
    }
    _client = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);
    return _client;
  }

  /**
   * checkAuth() — เช็ก Supabase session ปัจจุบัน ถ้าไม่มีให้เด้งกลับหน้า login ทันที
   * เรียกครั้งเดียวตอนโหลดหน้า (ไม่ await ก็ได้ ปล่อยทำงาน async เบื้องหลัง)
   */
  async function checkAuth() {
    const client = getAuthClient();
    if (!client) return;
    try {
      const { data: { session } } = await client.auth.getSession();
      if (!session) {
        alert('⚠️ กรุณาเข้าสู่ระบบก่อนใช้งาน');
        window.location.href = CFG.LOGIN_URL || 'index.html';
      }
    } catch (e) {
      console.error('checkAuth error:', e);
    }
  }

  function setSidebarUser(name, sub) {
    const nameEl = document.getElementById('userName');
    const subEl  = document.getElementById('userSub');
    if (nameEl) nameEl.textContent = name || 'ผู้ใช้งาน';
    if (subEl && sub) subEl.textContent = sub;
  }

  /**
   * loadCurrentUser() — เติมชื่อผู้ใช้ที่ sidebar
   *   1) ลองอ่านจาก sessionStorage('currentUser') ก่อน (เร็วสุด, เซ็ตไว้ตอน login)
   *   2) ถ้าไม่มี → ถาม Supabase session ตรงๆ แล้ว query ตาราง profiles หา full_name
   *   3) ถ้ายังไม่เจอ → fallback "ผู้ใช้งาน"
   */
  async function loadCurrentUser() {
    try {
      const raw = sessionStorage.getItem('currentUser');
      if (raw) {
        const cu = JSON.parse(raw);
        if (cu && cu.name) {
          setSidebarUser(cu.name, cu.empId ? ('รหัส ' + cu.empId) : 'เจ้าหน้าที่ฝึกอบรม');
          return;
        }
      }
    } catch (e) {}

    const client = getAuthClient();
    if (!client) { setSidebarUser('ผู้ใช้งาน', 'เจ้าหน้าที่ฝึกอบรม'); return; }

    try {
      const { data: { user } } = await client.auth.getUser();
      if (!user) { setSidebarUser('ผู้ใช้งาน', 'เจ้าหน้าที่ฝึกอบรม'); return; }

      const { data: profile } = await client
        .from('profiles')
        .select('full_name, emp_id')
        .eq('id', user.id)
        .single();

      const name = (profile && profile.full_name) || user.email || 'ผู้ใช้งาน';
      const sub  = (profile && profile.emp_id) ? ('รหัส ' + profile.emp_id) : 'เจ้าหน้าที่ฝึกอบรม';
      setSidebarUser(name, sub);

      try { sessionStorage.setItem('currentUser', JSON.stringify({ empId: (profile && profile.emp_id) || '', name })); } catch (e) {}
    } catch (e) {
      console.error('loadCurrentUser error:', e);
      setSidebarUser('ผู้ใช้งาน', 'เจ้าหน้าที่ฝึกอบรม');
    }
  }

  window.checkAuth       = checkAuth;
  window.loadCurrentUser = loadCurrentUser;
})();
