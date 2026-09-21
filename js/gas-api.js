/* ============================================================
   js/gas-api.js — เรียก Google Apps Script กลาง + Loading overlay
   + อัปโหลด PDF รายงานขึ้น Supabase Storage พร้อมบันทึกลิงก์กลับ Sheet
   ------------------------------------------------------------
   ต้องโหลด js/config.js (สำหรับ APP_CONFIG) และ Supabase JS SDK
   (<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2">)
   มาก่อนไฟล์นี้เสมอ

   Error handling: swallow-return-null (ไม่ throw) — ทุกจุดที่เรียก gsApi()
   ต้องเช็ค `if (!result) { ... }` เอง เพราะ error จะถูก console.error() ไว้
   แล้วคืนค่า null กลับมาแทนการโยน exception ออกไป (เลือกแบบนี้เพราะ 4/7 ไฟล์เดิม
   ใช้รูปแบบนี้อยู่แล้ว และปลอดภัยกว่าตอนรีแฟกเตอร์ — ดูเหตุผลเต็มในบทสนทนาที่ตกลงกันไว้)
   ============================================================ */
(function () {
  const CFG = window.APP_CONFIG || {};
  const GAS_URL = CFG.GAS_URL;

  // ============================================================
  //  gsApi — GET สำหรับอ่าน (ไม่มี data), POST สำหรับเขียน (มี data)
  // ============================================================
  async function gsApi(action, data, no) {
    try {
      let res;
      if (data) {
        const params = new URLSearchParams({ action, data: JSON.stringify(data) });
        if (no) params.append('no', no);
        res = await fetch(GAS_URL, { method: 'POST', body: params });
      } else {
        let url = GAS_URL + '?action=' + encodeURIComponent(action);
        if (no) url += '&no=' + encodeURIComponent(no);
        res = await fetch(url);
      }
      const json = await res.json();
      if (json.ok) return json.data;
      console.error('gsApi error (' + action + '):', json.error);
      return null;
    } catch (e) {
      console.error('gsApi network error (' + action + '):', e);
      return null;
    }
  }

  // ============================================================
  //  Loading overlay กลาง — ใช้แทน _showLoaderXX/_hideLoaderXX เดิมที่ก็อปกันไว้ทุกไฟล์
  // ============================================================
  function showGsLoader(msg) {
    let el = document.getElementById('gs-loader-overlay');
    if (!el) {
      el = document.createElement('div');
      el.id = 'gs-loader-overlay';
      el.style.cssText = 'position:fixed;inset:0;background:rgba(15,39,68,.55);z-index:9998;display:flex;align-items:center;justify-content:center;';
      el.innerHTML =
        '<div style="background:transparent;padding:16px;min-width:200px;max-width:280px;width:90%;' +
        'font-family:Sarabun,Prompt,sans-serif;text-align:center;box-sizing:border-box;">' +
        '<svg width="48" height="48" viewBox="0 0 48 48" style="display:block;margin:0 auto 14px;animation:gs-api-spin .9s linear infinite;transform-origin:center;filter:drop-shadow(0 0 6px rgba(255,255,255,0.7));">' +
        '<circle cx="24" cy="24" r="20" fill="none" stroke="#ffffff" stroke-width="4"/>' +
        '<circle cx="24" cy="24" r="20" fill="none" stroke="#1a56db" stroke-width="4.5" stroke-linecap="round" stroke-dasharray="30 96"/>' +
        '</svg>' +
        '<div id="gs-loader-msg" style="font-size:15px;color:#ffffff;font-weight:600;line-height:1.6;' +
        'text-shadow:0 2px 4px rgba(0,0,0,0.6), 0 4px 12px rgba(0,0,0,0.3);"></div>' +
        '</div>';
      if (!document.getElementById('gs-api-spin-style')) {
        const styleEl = document.createElement('style');
        styleEl.id = 'gs-api-spin-style';
        styleEl.textContent = '@keyframes gs-api-spin{to{transform:rotate(360deg)}}';
        document.head.appendChild(styleEl);
      }
      document.body.appendChild(el);
    }
    el.style.display = 'flex';
    const m = document.getElementById('gs-loader-msg');
    if (m) m.textContent = msg || 'กำลังโหลด...';
  }

  function hideGsLoader() {
    const el = document.getElementById('gs-loader-overlay');
    if (el) el.style.display = 'none';
  }

  // ============================================================
  //  Toast สถานะกลาง — ใช้แทน _showStatusXX เดิม
  // ============================================================
  function showGsStatus(msg, type) {
    const colors = {
      ok:    ['#d1fae5', '#065f46', '#10b981'],
      warn:  ['#fef3c7', '#92400e', '#f59e0b'],
      error: ['#fee2e2', '#991b1b', '#ef4444'],
    };
    const [bg, text, border] = colors[type] || colors.ok;
    let el = document.getElementById('gs-status-bar');
    if (!el) {
      el = document.createElement('div');
      el.id = 'gs-status-bar';
      el.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);' +
        'z-index:9999;padding:12px 24px;border-radius:10px;font-family:Sarabun,Prompt,sans-serif;' +
        'font-size:14px;font-weight:600;box-shadow:0 4px 20px rgba(0,0,0,.15);white-space:nowrap;max-width:90vw;';
      document.body.appendChild(el);
    }
    el.style.background = bg;
    el.style.color = text;
    el.style.border = '1.5px solid ' + border;
    el.textContent = msg;
    el.style.display = 'block';
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.style.display = 'none'; }, 4000);
  }

  // ============================================================
  //  Supabase client เฉพาะสำหรับ Storage (สร้างครั้งเดียว cache ไว้)
  //  แยกจาก client ฝั่ง auth.js โดยตั้งใจ กันปัญหาลำดับการโหลด script
  // ============================================================
  let _storageClient = null;
  function getStorageClient() {
    if (_storageClient) return _storageClient;
    if (!window.supabase || !window.supabase.createClient) {
      console.error('Supabase SDK ยังไม่โหลด — ไม่สามารถอัปโหลด PDF ได้');
      return null;
    }
    _storageClient = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);
    return _storageClient;
  }

  // ============================================================
  //  saveReportPdf — อัปโหลด PDF ขึ้น Supabase Storage แบบ versioning
  //  (pdf05-v1.pdf, pdf05-v2.pdf, ... แยกโฟลเดอร์ตามเลขที่หลักสูตร ไม่ทับ/ไม่ลบของเก่า)
  //  แล้วบันทึกลิงก์ล่าสุดกลับ Sheet "courses" ให้อัตโนมัติในฟังก์ชันเดียว
  //  (แก้บั๊กเดิมที่ 05/06/09 อัปโหลดสำเร็จแต่ไม่เคยเขียนลิงก์กลับ Sheet)
  //
  //  courseNo : เลขที่หลักสูตร (no)
  //  reportKey: 'pdf05' | 'pdf06' | 'pdf07' | 'pdf08' | 'pdf09'
  //  blob     : Blob ของไฟล์ PDF ที่สร้างเสร็จแล้ว
  //
  //  คืนค่า { publicUrl, version, fileName } หรือ null ถ้าล้มเหลว (ไม่ throw)
  // ============================================================
  async function saveReportPdf(courseNo, reportKey, blob) {
    const client = getStorageClient();
    if (!client) return null;
    const folder = String(courseNo || '').trim();
    if (!folder) { console.error('saveReportPdf: courseNo ว่างเปล่า'); return null; }

    try {
      const bucket = CFG.PDF_BUCKET || 'pdfs';
      const { data: existing, error: listErr } = await client.storage.from(bucket).list(folder, { limit: 200 });
      if (listErr) console.warn('saveReportPdf: list() ผิดพลาด (ถือว่ายังไม่มีไฟล์เก่า):', listErr.message);

      let maxVer = 0;
      const verRe = new RegExp('^' + reportKey + '-v(\\d+)\\.pdf$');
      (existing || []).forEach(f => {
        const m = f.name.match(verRe);
        if (m) maxVer = Math.max(maxVer, parseInt(m[1], 10));
      });
      const version  = maxVer + 1;
      const fileName = `${folder}/${reportKey}-v${version}.pdf`;

      const file = new File([blob], fileName, { type: 'application/pdf' });
      const { error: uploadErr } = await client.storage.from(bucket)
        .upload(fileName, file, { cacheControl: '3600', upsert: false });
      if (uploadErr) { console.error('saveReportPdf upload error:', uploadErr.message); return null; }

      const { data: pub } = client.storage.from(bucket).getPublicUrl(fileName);
      const publicUrl = pub.publicUrl;

      const savedAtKey = reportKey + 'SavedAt';
      const saveResult = await gsApi('updateCourseField', {
        no: folder,
        [reportKey]: publicUrl,
        [savedAtKey]: new Date().toISOString(),
      });
      if (!saveResult) {
        console.error('saveReportPdf: อัปโหลดสำเร็จแต่บันทึกลิงก์กลับ Sheet ไม่สำเร็จ (no=' + folder + ')');
      }

      return { publicUrl, version, fileName };
    } catch (e) {
      console.error('saveReportPdf error:', e);
      return null;
    }
  }

  window.gsApi          = gsApi;
  window.showGsLoader   = showGsLoader;
  window.hideGsLoader   = hideGsLoader;
  window.showGsStatus   = showGsStatus;
  window.saveReportPdf  = saveReportPdf;
})();
