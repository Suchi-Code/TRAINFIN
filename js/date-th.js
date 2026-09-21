/* ============================================================
   js/date-th.js — normalize และ format วันที่ภาษาไทย (UTC+7)
   ------------------------------------------------------------
   รวบรวมจากของเดิมที่ "ใช้งานได้ถูกต้องแล้ว" ในไฟล์ 05/07 (_normThaiDate05/07,
   isoTh05/07, isoThRange05/07) เป็นหลัก + เพิ่มเคส Excel serial number
   จาก training_courses_gfr1.html (normDate) — ไม่มีวิธีคิดใหม่ที่ไม่เคยพิสูจน์แล้ว

   หลักการแก้บั๊ก timezone (สำคัญ อย่าลบ):
   Google Apps Script บางครั้งส่ง Date column กลับมาเป็น ISO datetime ที่มีเวลา
   ต่อท้าย เช่น "2026-07-20T17:00:00.000Z" ซึ่งจริงๆ คือ "เที่ยงคืนวันที่ 21"
   ตามเวลาไทย (GMT+7) ฟังก์ชัน normalize() เช็คว่า hour (UTC) >= 17 แล้วชดเชย
   +7 ชั่วโมงก่อนตัดเอาวันที่ — ใช้ getUTCHours()/getUTCFullYear() เท่านั้น
   (ไม่ใช้ getHours()/getFullYear() แบบ local) เพื่อไม่ให้ผลลัพธ์ขึ้นกับ
   timezone ของเครื่อง/เบราว์เซอร์ผู้ใช้เลย
   ============================================================ */
(function () {
  const MONTHS_LONG  = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
                         'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
  const MONTHS_SHORT = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.',
                         'ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

  /**
   * normalize(v) — แปลงค่าวันที่จากแหล่งไหนก็ได้ (ISO datetime / date-only /
   * Excel serial number) ให้เป็น "YYYY-MM-DD" เสมอ หรือ '' ถ้าแปลงไม่ได้
   */
  function normalize(v) {
    if (!v) return '';
    const s = String(v).trim();

    // date-only string อยู่แล้ว ("2026-07-20") — ผ่านเลย
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

    // Excel/Google Sheets serial date number ("45678") — นับวันจาก 1899-12-30
    if (/^\d{5}$/.test(s)) {
      const d = new Date(Math.round((+s - 25569) * 86400 * 1000));
      const yy = d.getUTCFullYear(), mm = String(d.getUTCMonth() + 1).padStart(2, '0'), dd = String(d.getUTCDate()).padStart(2, '0');
      return `${yy}-${mm}-${dd}`;
    }

    // ISO datetime ("2026-07-20T17:00:00.000Z") — เช็คชั่วโมงแล้วชดเชย +7 ถ้าจำเป็น
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):/);
    if (m) {
      const hh = parseInt(m[4], 10);
      if (hh >= 17) {
        const d = new Date(s);
        d.setUTCHours(d.getUTCHours() + 7);
        const yy = d.getUTCFullYear(), mm = String(d.getUTCMonth() + 1).padStart(2, '0'), dd = String(d.getUTCDate()).padStart(2, '0');
        return `${yy}-${mm}-${dd}`;
      }
      return `${m[1]}-${m[2]}-${m[3]}`;
    }

    return '';
  }

  /**
   * format(iso, opts) — แปลง "YYYY-MM-DD" เป็นข้อความไทยวันเดียว
   * opts.month: 'long' (ค่าเริ่มต้น, "20 กรกฎาคม 2569") หรือ 'short' ("20 ก.ค. 2569")
   */
  function format(iso, opts) {
    const short = !!(opts && opts.month === 'short');
    const clean = normalize(iso);
    if (!clean) return '';
    const p = clean.split('-');
    const months = short ? MONTHS_SHORT : MONTHS_LONG;
    return `${parseInt(p[2], 10)} ${months[parseInt(p[1], 10) - 1]} ${parseInt(p[0], 10) + 543}`;
  }

  /**
   * formatRange(ds, de, opts) — ช่วงวันที่แบบย่อ (ใช้รูปแบบเดียวกับที่ 05/07 ใช้อยู่แล้ว)
   *   วันเดียว              → "20 กรกฎาคม 2569"
   *   เดือน/ปีเดียวกัน       → "20 – 21 กรกฎาคม 2569"
   *   ปีเดียวกัน ต่างเดือน   → "28 มิถุนายน – 2 กรกฎาคม 2569"
   *   ต่างปี                → "30 ธันวาคม 2568 – 2 มกราคม 2569" (เต็มรูปแบบทั้งสองฝั่ง)
   */
  function formatRange(ds, de, opts) {
    const short = !!(opts && opts.month === 'short');
    const months = short ? MONTHS_SHORT : MONTHS_LONG;
    const cds = normalize(ds), cde = normalize(de);
    if (!cds) return '';
    if (!cde || cde === cds) return format(cds, opts);

    const ps = cds.split('-').map(Number), pe = cde.split('-').map(Number);
    if (ps[0] === pe[0] && ps[1] === pe[1]) {
      return `${ps[2]} – ${pe[2]} ${months[ps[1] - 1]} ${ps[0] + 543}`;
    }
    if (ps[0] === pe[0]) {
      return `${ps[2]} ${months[ps[1] - 1]} – ${pe[2]} ${months[pe[1] - 1]} ${ps[0] + 543}`;
    }
    return format(cds, opts) + ' – ' + format(cde, opts);
  }

  window.DateTH = { normalize, format, formatRange, MONTHS_LONG, MONTHS_SHORT };
})();
