/* ============================================================
   js/permissions.js — ระบบสิทธิ์ผู้ใช้งาน 3 ระดับ (admin/manager/viewer)
   ------------------------------------------------------------
   ⚠️ นี่คือ UI-level protection เท่านั้น (กันมือลั่น/กันความสับสนของผู้ใช้จริง)
   ไม่ใช่ security boundary — การป้องกันจริงอยู่ที่ Supabase RLS บนตาราง
   profiles (ดู supabase-migration-roles.sql) ผู้ที่เปิด DevTools ยังสามารถ
   ลบ disabled/เรียก gsApi() ตรงๆ ได้เสมอ ระบบนี้แค่ทำให้ผู้ใช้ทั่วไปที่ใช้งาน
   ผ่านหน้าเว็บปกติไม่เผลอแก้ไขข้อมูลที่ไม่มีสิทธิ์

   ต้องโหลดหลัง js/auth.js เสมอ (อ่าน sessionStorage.currentUser ที่ auth.js/
   index.html เซ็ตไว้ตอน login — ต้องมี field "role" ติดมาด้วย)

   วิธีใช้ในแต่ละหน้า (วางต่อจาก checkAuth() เสมอ):
     <script src="js/permissions.js"></script>
     <script>checkAuth(); lockPageIfReadOnly();</script>

   วิธีทำเครื่องหมายปุ่ม/องค์ประกอบที่ "มีผลเขียนข้อมูลกลับ Sheet หรือ Supabase":
     เติม attribute data-permission="write" เข้าไปตรงๆ ในแท็ก HTML (หรือใน
     template string ของปุ่มที่สร้างด้วย JS แบบ dynamic ก็ได้ — CSS จะซ่อนให้
     อัตโนมัติแม้ปุ่มนั้นเพิ่งถูกสร้างขึ้นทีหลังหลังจากเรียก lockPageIfReadOnly()
     ไปแล้วก็ตาม เพราะกลไกการซ่อนทำงานผ่าน CSS selector ที่ผูกกับ body class
     ไม่ใช่การไล่ querySelectorAll ครั้งเดียวตอนโหลดหน้า)
   ปุ่มพิมพ์ (window.print()) ไม่ต้องแท็ก เพราะไม่มีผลเขียนข้อมูลใดๆ
   ============================================================ */
(function () {
  // ไฟล์ (location.pathname ตัดเหลือแค่ชื่อไฟล์) ที่ role 'manager' แก้ไขได้
  // ไฟล์ที่ไม่อยู่ในนี้ → manager เห็นเป็นโหมดอ่านอย่างเดียวเหมือน viewer
  // admin ไม่ถูกจำกัดด้วยรายการนี้เลย (แก้ได้ทุกไฟล์เสมอ)
  const PAGE_ACCESS = {
    manager: [
      'annual-plan.html',
      'training_courses_gfr1.html',
      '01_Main-Reports.html',
      '05_Budgeted-Expenses.html',
      '06_Sum-Training-Expenses.html',
      '07_Sum-Borrow1.html',
      '08_Form-Pwa-27.html',
      '09_V199.html',
      '11_Memo-Borrow-Reconcile.html',
    ],
  };

  /**
   * getCurrentRole() — อ่าน role จาก sessionStorage.currentUser (cache ที่ตั้งไว้
   * ตอน login/loadCurrentUser()) ไม่ query Supabase ซ้ำทุกหน้า — เป็นไปตามที่
   * ตกลงกันไว้ว่า role ที่เปลี่ยนจะมีผลตอน login ครั้งถัดไป ไม่ต้อง realtime
   * ไม่พบ/parse ไม่ได้ → fallback เป็น 'viewer' เสมอ (ปลอดภัยไว้ก่อน)
   */
  function getCurrentRole() {
    try {
      const cu = JSON.parse(sessionStorage.getItem('currentUser') || 'null');
      const role = cu && cu.role;
      return (role === 'admin' || role === 'manager') ? role : 'viewer';
    } catch (e) {
      return 'viewer';
    }
  }

  function currentFileName() {
    const path = location.pathname || '';
    return (path.split('/').pop() || '').trim().toLowerCase();
  }

  /**
   * canEditThisPage(role) — true ถ้า role นี้แก้ไขหน้าปัจจุบันได้
   */
  function canEditThisPage(role) {
    if (role === 'admin') return true;
    if (role === 'manager') {
      const file = currentFileName();
      return PAGE_ACCESS.manager.some(f => f.toLowerCase() === file);
    }
    return false; // viewer ไม่มีสิทธิ์แก้ไขหน้าใดเลย
  }

  /**
   * lockPageIfReadOnly() — เรียกครั้งเดียวตอนโหลดหน้า (ต่อจาก checkAuth())
   * ถ้า role ปัจจุบันแก้ไขหน้านี้ไม่ได้ จะ:
   *   1. ปิด (disabled) ช่องกรอกทั้งหมดที่มีอยู่ ณ ตอนนี้ (input/select/textarea)
   *   2. ถอด contenteditable ทั้งหมด (หัวเอกสารในหน้ารายงานที่แก้ไขได้)
   *   3. เติม class 'readonly-mode' ที่ <body> + แทรก CSS ซ่อนทุกอย่างที่มี
   *      data-permission="write" — ใช้ CSS แทน JS loop เพื่อให้ครอบคลุมปุ่ม
   *      ที่ยังไม่ถูกสร้าง ณ ตอนนี้ด้วย (เช่น ปุ่มในแถวตารางที่ render()
   *      ทีหลังแบบ async)
   *   4. แสดงแถบแจ้งเตือนโหมดดูอย่างเดียวไว้บนสุดของหน้า
   */
  function lockPageIfReadOnly() {
    const role = getCurrentRole();
    if (canEditThisPage(role)) return;

    // ถ้าเรียกจาก <script> ใน <head> (ตามวิธีใช้ที่แนะนำ) document.body ยังไม่มี
    // ณ จุดนี้ — ต้องรอ DOMContentLoaded ก่อน ไม่งั้น document.body.classList
    // ด้านล่างจะ throw แล้วทำให้ทั้งฟังก์ชันไม่ทำงานเลยแบบเงียบๆ
    if (!document.body) {
      document.addEventListener('DOMContentLoaded', applyLock, { once: true });
      return;
    }
    applyLock();
  }

  function applyLock() {
    document.querySelectorAll('input, select, textarea').forEach(el => {
      if (!el.hasAttribute('readonly')) el.disabled = true;
    });

    document.querySelectorAll('[contenteditable]').forEach(el => {
      el.removeAttribute('contenteditable');
      el.style.cursor = 'default';
    });

    injectReadOnlyStyle();
    document.body.classList.add('readonly-mode');

    showReadOnlyBanner();
  }

  function injectReadOnlyStyle() {
    if (document.getElementById('readonly-mode-style')) return;
    const style = document.createElement('style');
    style.id = 'readonly-mode-style';
    style.textContent =
      'body.readonly-mode [data-permission="write"]{display:none!important}';
    document.head.appendChild(style);
  }

  function showReadOnlyBanner() {
    if (document.getElementById('readonly-mode-banner')) return;
    const el = document.createElement('div');
    el.id = 'readonly-mode-banner';
    el.title = 'บัญชีนี้ไม่มีสิทธิ์แก้ไขหน้านี้';
    // Badge ลอยมุมขวาล่าง แทนแถบเต็มความกว้างด้านบน (ของเดิมทับ site-header/
    // sidebar ทุกเลย์เอาต์และบังเนื้อหา) — เล็ก ไม่ดันหน้า ไม่ชนกับองค์ประกอบ
    // อื่นที่ fixed ไว้แล้ว (เช่น .btn-add-course-float ที่ก็อยู่มุมขวาล่าง
    // เหมือนกัน — badge นี้ z-index สูงกว่าและมี margin เผื่อไว้พอสมควร)
    el.style.cssText =
      'position:fixed;bottom:18px;right:18px;z-index:9997;' +
      'display:inline-flex;align-items:center;gap:6px;' +
      'background:rgba(124,45,18,.94);color:#fff;padding:8px 14px;' +
      'border-radius:999px;font-family:Sarabun,Prompt,sans-serif;' +
      'font-size:11.5px;font-weight:700;letter-spacing:.02em;' +
      'box-shadow:0 4px 14px rgba(0,0,0,.28);cursor:default;user-select:none;' +
      'opacity:.88;transition:opacity .15s;';
    el.onmouseenter = () => { el.style.opacity = '1'; };
    el.onmouseleave = () => { el.style.opacity = '.88'; };
    el.innerHTML = '🔒 <span>ดูอย่างเดียว</span>';
    document.body.appendChild(el);
  }

  window.getCurrentRole     = getCurrentRole;
  window.canEditThisPage    = canEditThisPage;
  window.lockPageIfReadOnly = lockPageIfReadOnly;
})();
