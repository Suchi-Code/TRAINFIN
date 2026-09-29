/* ==========================================================================
   js/sidebar.js — PWA Academy shared Sidebar module
   แหล่งความจริงเดียวของ Sidebar: เมนูหลัก, สไตล์ header, ปุ่มยืด/หด, กล่องผู้ใช้,
   เมนูย่อยแบบ accordion (nav-group), และปุ่มออกจากระบบ

   วิธีใช้ในแต่ละหน้า (ดูรายละเอียดเต็มใน Sidebar-Page-Guide.md):
   1) โหลดสคริปต์นี้ใน <head> (ตำแหน่งไหนก็ได้ในกลุ่ม shared modules — ไม่มี dependency
      กับไฟล์อื่น ยกเว้นปุ่ม Logout ที่ต้องการ window.APP_CONFIG + Supabase SDK ให้พร้อม
      ก่อนผู้ใช้กดปุ่มจริง ซึ่งโหลดมาก่อนหน้าแล้วเสมอตามลำดับ shared modules มาตรฐาน)
        <script src="js/sidebar.js"></script>
   2) แทนที่ก้อน <aside class="sidebar">...</aside> เดิมทั้งหมดด้วย placeholder เดียว:
        <div id="sidebarRoot"></div>
   3) เรียก renderSidebar() ทันทีหลัง placeholder (จะรันก่อน loadCurrentUser() เสมอ
      เพราะ browser parse บนลงล่าง — #userName จะมีอยู่แล้วตอน loadCurrentUser() ทำงาน):

      หน้าเมนูหลักทั่วไป (ไม่มีลูก):
        <script>renderSidebar('overview');</script>

      หน้าเมนูลูก (breadcrumb ขั้นบันได step-1/2/3) — ให้ replace เมนูหลักที่เป็นพ่อ
      (ปัจจุบันมีแค่กิ่ง 'training' ที่มีลูก: 01_Main-Reports.html, 10_PDF-Overview.html):
        <script>
          renderSidebar('training', [
            { cls: 'step-1',        href: 'training_courses_gfr1.html', title: 'หลักสูตรการฝึกอบรม', icon: SIDEBAR_STEP_ICON.training },
            { cls: 'step-2 active', href: '#',                          title: 'รายละเอียดหลักสูตร',  icon: SIDEBAR_STEP_ICON.chevron }
          ]);
        </script>

   เพิ่ม/แก้/ย้ายแท็บเมนูหลัก → แก้ที่ SIDEBAR_NAV_ITEMS ด้านล่างที่เดียว ไม่ต้องไล่แก้ทีละไฟล์

   ── เมนูย่อยแบบ accordion (nav-group) ──
   ให้ item ใดๆ ใน SIDEBAR_NAV_ITEMS มี property `children` (array ของ {title, href})
   แทนการมี href ตรงๆ (แนะนำตั้ง href ของ item แม่เป็น '#' เพราะจะ render เป็นปุ่ม toggle
   ไม่ใช่ลิงก์) โมดูลจะ:
     - render เป็นปุ่มกาง/หุบ พร้อมลูกศรหมุนตามสถานะ และเส้นแนวตั้งจางๆ ด้านซ้ายของ
       รายการลูก (ชี้ตำแหน่งกึ่งกลางไอคอนของ tab แม่) ให้เห็นว่าลูกกลุ่มไหนมาจาก tab ไหน
     - จำสถานะเปิด/ปิดต่อ key ไว้ใน sessionStorage('sidebar_expanded') ข้ามหน้า
       (เพราะระบบนี้เป็น full page reload ไม่ใช่ SPA — ถ้าไม่จำไว้ ผู้ใช้จะต้องกดเปิดใหม่
       ทุกครั้งที่คลิกลิงก์เปลี่ยนหน้าในกิ่งเดียวกัน)
     - auto-expand กิ่งที่มีไฟล์ปัจจุบันอยู่ในนั้นเสมอ (เผื่อเข้าตรงผ่าน URL/bookmark
       โดยไม่เคยกดเปิดเมนูมาก่อน) และ mark active ที่ลิงก์ลูกที่ตรงกับหน้าปัจจุบัน
     - เปิดได้หลายกิ่งพร้อมกัน (ไม่ใช่ accordion แบบเปิดได้ทีละอัน)
   child ที่ href เป็น '#' (ยังไม่มีปลายทางจริง) จะกดแล้วขึ้นป๊อปอัป "อยู่ระหว่างพัฒนา"
   แทนการกระโดดหน้าไปที่ว่างเปล่า (ดู sidebarShowComingSoon())

   ── ปุ่มออกจากระบบ ──
   แสดงอยู่ใต้กล่องผู้ใช้เสมอ (ปักอยู่ล่างสุดของ sidebar เหมือนกล่องผู้ใช้) ทำงานในตัวเอง
   ไม่ต้องพึ่งฟังก์ชันจากหน้า settings.html — สร้าง Supabase client ของตัวเอง (แพทเทิร์น
   เดียวกับ auth.js/gas-api.js), เรียก auth.signOut(), ล้าง sessionStorage.currentUser,
   แล้ว redirect ไป APP_CONFIG.LOGIN_URL (ถาม confirm ก่อนเสมอกันกดพลาด)
   ========================================================================== */

// ----- รายการเมนูหลัก (ลำดับการแสดงผล = ลำดับในอาร์เรย์นี้) -----
const SIDEBAR_NAV_ITEMS = [
  {
    key: 'overview',
    href: 'overview.html',
    title: 'ภาพรวม',
    icon: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zM9 21v-6h6v6"/>'
  },
  {
    key: 'annual-plan',
    href: 'annual-plan.html',
    title: 'แผนงานประจำปี',
    icon: '<path d="M4 5h16M4 12h16M4 19h10"/>'
  },
  {
    key: 'training',
    href: 'training_courses_gfr1.html',
    title: 'หลักสูตรการฝึกอบรม',
    icon: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h10M7 12h10M7 16h6"/>'
  },
  {
    key: 'projects',
    href: 'projects.html',
    title: 'โครงการ',
    icon: '<path d="M4 7h16v13H4zM8 7V4h8v3M8 12h8"/>'
  },
  {
    key: 'training-support',
    href: '#', // ← เป็น parent แบบ toggle เท่านั้น ไม่ลิงก์ไปไหนเอง (ดูหัวข้อ children ด้านบน)
    title: 'ระบบงานฝึกอบรม',
    icon: '<path d="M12 2 2 7l10 5 10-5-10-5Z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>',
    children: [
      { title: 'สร้างวุฒิบัตร/สร้างป้ายชื่อ/ใบสำคัญรับเงิน', href: 'Training_Support_Tools_Center.html' },
      { title: 'ระบบงาน...', href: '#' } // ← dummy รอปลายทางจริง — กดแล้วขึ้นป๊อปอัป "อยู่ระหว่างพัฒนา"
    ]
  },
  {
    key: 'settings',
    href: 'settings.html',
    title: 'ตั้งค่า',
    icon: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.04 2.04-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V20h-2.88v-.09a1.7 1.7 0 0 0-1.03-1.56 1.7 1.7 0 0 0-1.88.34l-.06.06-2.04-2.04.06-.06A1.7 1.7 0 0 0 7.3 14.8a1.7 1.7 0 0 0-1.56-1.03H5.6v-2.88h.14A1.7 1.7 0 0 0 7.3 9.86 1.7 1.7 0 0 0 6.96 8l-.06-.06L8.94 5.9 9 5.96a1.7 1.7 0 0 0 1.88.34 1.7 1.7 0 0 0 1.03-1.56V4.6h2.88v.14a1.7 1.7 0 0 0 1.03 1.56A1.7 1.7 0 0 0 17.7 5.96l.06-.06 2.04 2.04-.06.06a1.7 1.7 0 0 0-.34 1.88 1.7 1.7 0 0 0 1.56 1.03h.14v2.88h-.14A1.7 1.7 0 0 0 19.4 15z"/>'
  }
];

// ----- ไอคอนที่ใช้ซ้ำสำหรับสร้าง breadcrumb (step-1/2/3) ของหน้าเมนูลูก -----
const SIDEBAR_STEP_ICON = {
  training: SIDEBAR_NAV_ITEMS.find(function (i) { return i.key === 'training'; }).icon,
  chevron: '<path d="M9 18l6-6-6-6"/>'
};

/* ============================================================
   ACCORDION HELPERS — เมนูย่อย (nav-group) ที่มี property `children`
   ============================================================ */

function currentFileName() {
  const path = location.pathname || '';
  return (path.split('/').pop() || '').trim().toLowerCase();
}

function getExpandedNavGroups() {
  try {
    const raw = sessionStorage.getItem('sidebar_expanded');
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    return [];
  }
}

function setExpandedNavGroups(keys) {
  try { sessionStorage.setItem('sidebar_expanded', JSON.stringify(keys)); } catch (e) {}
}

function isNavGroupActive(item) {
  if (!item.children) return false;
  const file = currentFileName();
  return item.children.some(function (c) {
    return c.href && c.href !== '#' && c.href.toLowerCase() === file;
  });
}

/**
 * toggleNavGroup(key) — กาง/หุบเมนูย่อยของ item ที่มี children ตรงกับ key นี้
 * บันทึกสถานะลง sessionStorage ทันที เพื่อให้จำไว้ข้ามหน้า (ระบบนี้เป็น full page
 * reload ไม่ใช่ SPA — renderSidebar() จะอ่านค่านี้กลับมาตอนโหลดหน้าถัดไป)
 */
function toggleNavGroup(key) {
  const groupEl = document.querySelector('.nav-group[data-key="' + key + '"]');
  if (!groupEl) return;
  const isOpen = groupEl.classList.toggle('open');
  const keys = getExpandedNavGroups().filter(function (k) { return k !== key; });
  if (isOpen) keys.push(key);
  setExpandedNavGroups(keys);
}

/**
 * sidebarShowComingSoon(e) — ป๊อปอัปกลางสำหรับลิงก์ลูกที่ยังไม่มีปลายทางจริง (href="#")
 * ใช้แทนการปล่อยให้คลิกแล้วกระโดดไปหน้าเปล่า/รีเฟรชตัวเอง
 */
function sidebarShowComingSoon(e) {
  if (e) e.preventDefault();
  let overlay = document.getElementById('sidebar-coming-soon-overlay');
  if (overlay) { overlay.style.display = 'flex'; return; }
  overlay = document.createElement('div');
  overlay.id = 'sidebar-coming-soon-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(10,20,40,.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';
  overlay.onclick = function (ev) { if (ev.target === overlay) overlay.style.display = 'none'; };
  overlay.innerHTML =
    '<div style="background:#fff;border-radius:14px;padding:30px 32px;max-width:340px;width:100%;' +
    'box-shadow:0 20px 60px rgba(0,0,0,.3);font-family:Prompt,Sarabun,sans-serif;text-align:center;">' +
    '<div style="font-size:42px;margin-bottom:12px;">🚧</div>' +
    '<div style="font-size:16px;font-weight:700;color:#092c4c;margin-bottom:8px;">อยู่ระหว่างปรับปรุง</div>' +
    '<div style="font-size:13px;color:#627587;margin-bottom:22px;line-height:1.6;">เมนูนี้กำลังอยู่ระหว่างการพัฒนา<br>ขออภัยในความไม่สะดวก</div>' +
    '<button onclick="document.getElementById(\'sidebar-coming-soon-overlay\').style.display=\'none\'" ' +
    'style="background:#0b6aab;color:#fff;border:none;border-radius:8px;padding:9px 28px;' +
    'font-family:Prompt,Sarabun,sans-serif;font-size:14px;font-weight:700;cursor:pointer;">ตกลง</button>' +
    '</div>';
  document.body.appendChild(overlay);
}

/* ============================================================
   LOGOUT — ปุ่มออกจากระบบท้าย sidebar (ไม่ต้องเข้า settings.html อีกต่อไป)
   ============================================================ */

let _sidebarAuthClient = null;
function getSidebarAuthClient() {
  if (_sidebarAuthClient) return _sidebarAuthClient;
  const CFG = window.APP_CONFIG || {};
  if (!window.supabase || !window.supabase.createClient) {
    console.error('Supabase SDK ยังไม่โหลด — sidebarLogout() ทำงานไม่ได้');
    return null;
  }
  _sidebarAuthClient = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);
  return _sidebarAuthClient;
}

/**
 * sidebarLogout() — ออกจากระบบ (Supabase signOut) + ล้าง sessionStorage.currentUser
 * แล้ว redirect ไปหน้า login ถามยืนยันก่อนเสมอกันกดพลาด
 */
async function sidebarLogout() {
  if (!confirm('ยืนยันออกจากระบบ?')) return;
  const CFG = window.APP_CONFIG || {};
  const client = getSidebarAuthClient();
  try {
    if (client) await client.auth.signOut();
  } catch (e) {
    console.warn('sidebarLogout error:', e);
  }
  try { sessionStorage.removeItem('currentUser'); } catch (e) {}
  window.location.href = CFG.LOGIN_URL || 'index.html';
}

/**
 * injectSidebarStyles() — เพิ่ม CSS ที่ nav-group/nav-parent/nav-children/sidebar-logout
 * ต้องใช้ เพียงครั้งเดียวต่อหน้า กันไม่ต้องไปแก้ <style> ของทุกไฟล์ HTML ที่มี sidebar
 * (สีอ้างอิงจาก .nav a เดิมใน <aside> เพื่อให้กลืนกับเมนูหลักที่มีอยู่แล้ว)
 */
function injectSidebarStyles() {
  if (document.getElementById('sidebar-js-style')) return;
  const style = document.createElement('style');
  style.id = 'sidebar-js-style';
  style.textContent =
    '.nav-group{position:relative;margin:3px 0}' +
    '.nav-parent{display:flex;align-items:center;gap:12px;width:100%;text-align:left;background:transparent;border:0;color:#c9dae7;padding:12px;border-radius:8px;cursor:pointer;font:inherit;font-size:inherit;white-space:nowrap;overflow:hidden;transition:.15s}' +
    '.nav-parent:hover{background:rgba(255,255,255,.08)}' +
    '.nav-parent svg:not(.nav-caret){width:19px;height:19px;flex:0 0 19px;fill:none;stroke:currentColor;stroke-width:1.8}' +
    '.nav-parent span{overflow:hidden;text-overflow:ellipsis}' +
    '.nav-caret{width:14px;height:14px;flex:0 0 14px;margin-left:auto;transition:transform .2s ease;fill:none;stroke:currentColor;stroke-width:2}' +
    '.nav-group.open .nav-caret{transform:rotate(90deg)}' +
    '.nav-children{position:relative;max-height:0;overflow:hidden;transition:max-height .25s ease}' +
    '.nav-group.open .nav-children{max-height:240px}' +
    /* เส้นแนวตั้งจางๆ บอกว่าลูกกลุ่มไหนมาจาก tab ไหน — ตำแหน่ง left:21px ชนกึ่งกลาง
       ไอคอนของ nav-parent พอดี (padding-left 12px + ไอคอนกว้าง 19px/2 ≈ 21px) */
    '.nav-children::before{content:"";position:absolute;left:21px;top:0;bottom:0;width:1.5px;background:rgba(255,255,255,.18)}' +
    '.nav-child{display:flex;align-items:center;gap:8px;text-decoration:none;color:#a9c3d6;padding:10px 12px 10px 43px;border-radius:8px;margin:2px 0;font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:.15s}' +
    '.nav-child:hover{background:rgba(255,255,255,.08);color:#fff}' +
    '.nav-child.active{background:#1275b4;color:#fff;font-weight:700;box-shadow:inset 3px 0 #91d8ff}' +
    '.sidebar.collapsed .nav-children{display:none}' +
    '.sidebar.collapsed .nav-parent .nav-caret{display:none}' +
    /* ปุ่มออกจากระบบ — ปักอยู่ล่างสุดต่อจากกล่องผู้ใช้ */
    '.sidebar-logout{display:flex;align-items:center;gap:12px;width:100%;text-align:left;background:transparent;border:0;color:#c9dae7;padding:12px;border-radius:8px;margin-top:8px;cursor:pointer;font:inherit;font-size:inherit;white-space:nowrap;overflow:hidden;transition:.15s;flex:0 0 auto}' +
    '.sidebar-logout:hover{background:rgba(192,54,79,.18);color:#ff9fae}' +
    '.sidebar-logout svg{width:17px;height:17px;flex:0 0 17px;stroke:currentColor;stroke-width:1.8;fill:none}' +
    '.sidebar.collapsed .sidebar-logout{justify-content:center;padding-left:8px;padding-right:8px}' +
    '.sidebar.collapsed .sidebar-logout span{display:none}';
  document.head.appendChild(style);
}

/**
 * renderSidebar(activeKey, breadcrumbItems?)
 * - activeKey: key ของเมนูหลักที่ต้อง highlight (เช่น 'overview')
 *   สำหรับหน้าเมนูลูก ให้ใส่ key ของเมนูหลักที่เป็น "พ่อ" (เช่น 'training')
 * - breadcrumbItems: (optional) array ของ {cls, href, title, icon}
 *   ถ้าใส่มา จะ "แทนที่" ลิงก์เดียวของ activeKey ด้วยลิงก์ขั้นบันไดหลายอัน
 */
function renderSidebar(activeKey, breadcrumbItems) {
  injectSidebarStyles();
  const expandedKeys = getExpandedNavGroups();

  const linksHtml = SIDEBAR_NAV_ITEMS.map(function (item) {
    if (breadcrumbItems && item.key === activeKey) {
      return breadcrumbItems.map(function (b) {
        return '<a class="' + b.cls + '" href="' + b.href + '" title="' + b.title + '">' +
          '<svg viewBox="0 0 24 24">' + b.icon + '</svg><span>' + b.title + '</span></a>';
      }).join('\n      ');
    }

    if (item.children) {
      const isOpen = isNavGroupActive(item) || expandedKeys.indexOf(item.key) !== -1;
      const childrenHtml = item.children.map(function (c) {
        const isDummy = !c.href || c.href === '#';
        const childIsActive = !isDummy && c.href.toLowerCase() === currentFileName();
        const onclickAttr = isDummy ? ' onclick="sidebarShowComingSoon(event)"' : '';
        return '<a class="nav-child' + (childIsActive ? ' active' : '') + '" href="' + (c.href || '#') + '" title="' + c.title + '"' + onclickAttr + '><span>' + c.title + '</span></a>';
      }).join('\n        ');
      return '<div class="nav-group' + (isOpen ? ' open' : '') + '" data-key="' + item.key + '">\n' +
        '      <button type="button" class="nav-parent" onclick="toggleNavGroup(\'' + item.key + '\')" title="' + item.title + '">\n' +
        '        <svg viewBox="0 0 24 24">' + item.icon + '</svg><span>' + item.title + '</span>\n' +
        '        <svg class="nav-caret" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg>\n' +
        '      </button>\n' +
        '      <div class="nav-children">\n' +
        '        ' + childrenHtml + '\n' +
        '      </div>\n' +
        '    </div>';
    }

    const isActive = !breadcrumbItems && item.key === activeKey;
    const href = isActive ? '#' : item.href;
    return '<a' + (isActive ? ' class="active"' : '') + ' href="' + href + '" title="' + item.title + '">' +
      '<svg viewBox="0 0 24 24">' + item.icon + '</svg><span>' + item.title + '</span></a>';
  }).join('\n      ');

  const root = document.getElementById('sidebarRoot');
  if (!root) {
    console.error('renderSidebar(): ไม่พบ <div id="sidebarRoot"></div> ในหน้านี้');
    return;
  }

  root.outerHTML =
    '<aside class="sidebar">\n' +
    '    <div class="sidebar-head">\n' +
    '      <div class="brand">\n' +
    '        <img class="mark" src="https://res.cloudinary.com/daytjjgll/image/upload/fl_preserve_transparency/v1786810067/iuss72yvmfk5i0hndhdy.jpg?_s=public-apps" alt="Logo">\n' +
    '        <div class="brand-text"><b>PWA RTD1</b><span>ระบบติดตามงบประมาณและหลักสูตรฝึกอบรม</span></div>\n' +
    '      </div>\n' +
    '      <button id="sidebarToggle" class="sidebar-toggle" type="button" onclick="toggleSidebar()" title="ยืด / หด เมนู">\n' +
    '        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><polyline points="11 17 6 12 11 7"/><polyline points="18 17 13 12 18 7"/></svg>\n' +
    '      </button>\n' +
    '    </div>\n' +
    '    <nav class="nav">\n' +
    '      <div class="nav-label">เมนูหลัก</div>\n' +
    '      ' + linksHtml + '\n' +
    '    </nav>\n' +
    '    <div class="user"><b id="userName">กำลังโหลด...</b><span id="userSub">เจ้าหน้าที่ฝึกอบรม</span></div>\n' +
    '    <button type="button" class="sidebar-logout" onclick="sidebarLogout()" title="ออกจากระบบ">\n' +
    '      <svg viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>\n' +
    '      <span>ออกจากระบบ</span>\n' +
    '    </button>\n' +
    '  </aside>';
}

// ----- ปุ่มยืด/หด sidebar (ย้ายมารวมจากที่เคยก็อปซ้ำทุกไฟล์) -----
function toggleSidebar() {
  const sidebar = document.querySelector('.sidebar'), main = document.querySelector('.main'), button = document.getElementById('sidebarToggle');
  sidebar.classList.toggle('collapsed');
  main.classList.toggle('wide');
  button.classList.toggle('collapsed');
}
