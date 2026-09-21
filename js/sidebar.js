/* ==========================================================================
   js/sidebar.js — PWA Academy shared Sidebar module
   แหล่งความจริงเดียวของ Sidebar: เมนูหลัก, สไตล์ header, ปุ่มยืด/หด, กล่องผู้ใช้

   วิธีใช้ในแต่ละหน้า (ดูรายละเอียดเต็มใน Sidebar-Page-Guide.md):
   1) โหลดสคริปต์นี้ใน <head> (ตำแหน่งไหนก็ได้ในกลุ่ม shared modules — ไม่มี dependency)
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
    href: 'Training_Support_Tools_Center.html',
    title: 'ระบบงานฝึกอบรม',
    icon: '<path d="M12 2 2 7l10 5 10-5-10-5Z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>'
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

/**
 * renderSidebar(activeKey, breadcrumbItems?)
 * - activeKey: key ของเมนูหลักที่ต้อง highlight (เช่น 'overview')
 *   สำหรับหน้าเมนูลูก ให้ใส่ key ของเมนูหลักที่เป็น "พ่อ" (เช่น 'training')
 * - breadcrumbItems: (optional) array ของ {cls, href, title, icon}
 *   ถ้าใส่มา จะ "แทนที่" ลิงก์เดียวของ activeKey ด้วยลิงก์ขั้นบันไดหลายอัน
 */
function renderSidebar(activeKey, breadcrumbItems) {
  const linksHtml = SIDEBAR_NAV_ITEMS.map(function (item) {
    if (breadcrumbItems && item.key === activeKey) {
      return breadcrumbItems.map(function (b) {
        return '<a class="' + b.cls + '" href="' + b.href + '" title="' + b.title + '">' +
          '<svg viewBox="0 0 24 24">' + b.icon + '</svg><span>' + b.title + '</span></a>';
      }).join('\n      ');
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
    '  </aside>';
}

// ----- ปุ่มยืด/หด sidebar (ย้ายมารวมจากที่เคยก็อปซ้ำทุกไฟล์) -----
function toggleSidebar() {
  const sidebar = document.querySelector('.sidebar'), main = document.querySelector('.main'), button = document.getElementById('sidebarToggle');
  sidebar.classList.toggle('collapsed');
  main.classList.toggle('wide');
  button.classList.toggle('collapsed');
}
