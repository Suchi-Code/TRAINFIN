/* ============================================================
   PaginateTH — เครื่องมือช่วยจัดหน้าเวลาพิมพ์/เซฟ PDF ที่ใช้ร่วมกันได้
   หลายไฟล์ (06 ใช้อยู่ตอนนี้ — ไฟล์อื่นในอนาคตเรียกซ้ำได้เลย ไม่ต้อง copy
   logic ไปเขียนใหม่) แบ่งเป็น 2 ส่วนไม่เกี่ยวข้องกันโดยตรง แต่รวมไฟล์เดียว
   เพราะทั้งคู่เป็นเรื่อง "จัดหน้าตอนพิมพ์/เซฟ PDF":

   1) mmToPx() / measureHeight() / paginateByHeight()
      — แบ่งหน้าโดยวัดความสูงจริงที่ render ออกมา (แทนการนับจำนวนรายการ
      คงที่ต่อหน้าแบบเดิม ซึ่งทำให้บางหน้าล้น บางหน้าเหลือพื้นที่เยอะ เพราะไม่
      รู้ความสูงจริงของแต่ละแถว/หัวข้อที่แทรกเข้ามา)

   2) makeRowSpacingControl() / getPdfScale()
      — ปุ่ม −/+ ปรับระยะห่างบรรทัดของตาราง + อ่านค่า dropdown สเกล PDF
      (ย้ายมารวมจากไฟล์ 05/07 ที่แต่ละไฟล์เคย copy โค้ดชุดนี้แยกกันคนละชุด)
   ============================================================ */
(function(){
  'use strict';

  const MM_TO_PX = 96 / 25.4; // 96dpi มาตรฐานเบราว์เซอร์/Puppeteer
  function mmToPx(mm){ return mm * MM_TO_PX; }

  /**
   * measureHeight(html, widthPx, extraStyle)
   * วัดความสูงจริง (px) ของ HTML ก้อนหนึ่ง โดย render ลงพื้นที่ซ่อนไว้นอกจอ
   * (position:absolute; left:-99999px) แล้ว appendChild เข้า document.body
   * ตัวจริง — ไม่ต้องแนบ CSS ซ้ำเอง เพราะ <style> ของหน้าเว็บที่เรียกใช้ฟังก์ชัน
   * นี้ (ผ่าน <script src> ในหน้าเดียวกัน) มีผลกับทุก element ใน document
   * อยู่แล้ว รวมถึง element ที่ appendChild เข้าไปใหม่ด้วย
   *
   * extraStyle (ไม่บังคับ): CSS เพิ่มเติมใส่ตรงบน holder เอง เช่น
   * `--row-pad-v:7px;` — จำเป็นถ้าตารางที่วัดใช้ CSS var ที่ set ไว้บน element
   * จริง (เช่น .sum-print-wrap) เพราะ holder เป็นลูกของ document.body ตรงๆ
   * ไม่ใช่ลูกของ element นั้น จึงไม่ได้รับ CSS var ที่ set ผ่าน .style.setProperty()
   * มาด้วยอัตโนมัติ ต้องส่งมาซ้ำตรงนี้เอง ไม่งั้นความสูงที่วัดได้จะใช้ค่า fallback
   * เริ่มต้นเสมอ ไม่ตรงกับระยะห่างบรรทัดที่ผู้ใช้เลือกไว้จริง
   */
  function measureHeight(html, widthPx, extraStyle) {
    const holder = document.createElement('div');
    holder.style.cssText = `position:absolute; left:-99999px; top:0; visibility:hidden; width:${widthPx}px; ${extraStyle || ''}`;
    holder.innerHTML = html;
    document.body.appendChild(holder);
    const h = holder.getBoundingClientRect().height;
    document.body.removeChild(holder);
    return h;
  }

  /**
   * paginateByHeight({ totalItems, renderChunk, measure, budgetPx })
   * แบ่ง "รายการ" (เช่น แถวบัญชีในไฟล์ 06) ออกเป็นหน้าๆ ตามความสูงจริงที่
   * render ได้ แทนการนับจำนวนคงที่ — ไม่รู้เนื้อหาข้างในของแต่ละรายการเลย
   * (ให้ไฟล์ที่เรียกใช้ implement renderChunk เอง เพราะ logic เนื้อหาต่างกัน
   * ไปตามแต่ละไฟล์รายงาน)
   *
   * totalItems : จำนวนรายการทั้งหมด (เช่น rows.length)
   * renderChunk: function(start, end, pageNum) → คืน HTML ของ "หน้าที่ถ้าตัด
   *              ตรงนี้" (start..end ไม่รวม end) — ควร render แบบ "ยังไม่ใช่
   *              หน้าสุดท้าย" เสมอตอนช่วงลอง (เผื่อพื้นที่ส่วนท้ายหน้าไว้ก่อน
   *              เพราะตอนนี้ยังไม่รู้ว่าหน้านี้จะเป็นหน้าสุดท้ายจริงไหม)
   * measure    : function(html) → ความสูง px ที่ render ได้จริง
   * budgetPx   : พื้นที่พิมพ์ได้จริงต่อหน้า (px หลังหัก margin แล้ว)
   *
   * คืนค่า: array ของ {start, end} — ไฟล์ที่เรียกใช้นำไป render จริงอีกครั้ง
   * (รอบนี้รู้ totalPages/isLast ที่ถูกต้องแล้ว จึงตัดแถว "ยกยอดไป" ของหน้า
   * สุดท้ายออกได้ถ้ามี) โดยไม่ต้องเรียก measure ซ้ำอีก
   */
  function paginateByHeight({ totalItems, renderChunk, measure, budgetPx }) {
    if (!totalItems) return [{ start: 0, end: 0 }];
    const chunks = [];
    let start = 0;
    while (start < totalItems) {
      let end = start + 1; // อย่างน้อย 1 รายการเสมอต่อหน้า กันลูปค้างถ้ารายการเดียวก็ล้นอยู่แล้ว
      while (end < totalItems) {
        const nextEnd = end + 1;
        const h = measure(renderChunk(start, nextEnd, chunks.length));
        if (h > budgetPx) break;
        end = nextEnd;
      }
      chunks.push({ start, end });
      start = end;
    }
    return chunks;
  }

  /* ============================================================
     ควบคุมระยะห่างบรรทัดของตาราง (ปุ่ม −/+) — ย้ายมารวมจาก 05/07 ที่เคย
     ประกาศ ROW_SPACING_LEVELS/adjustRowSpacing() แยกกันคนละชุดต่อไฟล์
     ============================================================ */
  const ROW_SPACING_LEVELS = [
    {label:'แน่น',      pad:'2px'},
    {label:'กระชับ',    pad:'3.5px'},
    {label:'ปกติ',      pad:'5px'},
    {label:'กว้าง',     pad:'7px'},
    {label:'กว้างมาก',  pad:'9px'},
  ];
  const ROW_SPACING_DEFAULT = 2; // index ของ "ปกติ"

  /**
   * makeRowSpacingControl({ containerSelector, sessionKey, labelId, decId, incId })
   * คืนอ็อบเจ็กต์ { init, adjust } — ไฟล์ที่เรียกใช้ต้องมี CSS ผูก
   * `padding:var(--row-pad-v, 5px) ...` ไว้กับ td ของตารางรายงานอยู่แล้ว
   * (ดูตัวอย่างใน 05/07: table.rpt tbody td) เรียก .init() ตอนโหลดหน้า และ
   *ผูกปุ่ม onclick="...adjust(-1)/.adjust(1)" เอง
   *
   * containerSelector : selector ของ element ที่จะ set CSS var (เช่น
   *   '.report-container' หรือ '.sum-print-wrap')
   * sessionKey        : key เก็บค่าที่เลือกไว้ใน sessionStorage (กันรีเซ็ต
   *   ทุกครั้งที่กดดูตัวอย่างใหม่ระหว่างเซสชันเดียวกัน) ต้องไม่ซ้ำกันข้ามไฟล์
   */
  function makeRowSpacingControl({ containerSelector, sessionKey, labelId, decId, incId }) {
    let idx = ROW_SPACING_DEFAULT;
    function apply(){
      const lvl = ROW_SPACING_LEVELS[idx];
      const el = document.querySelector(containerSelector);
      if (el) el.style.setProperty('--row-pad-v', lvl.pad);
      const lbl = document.getElementById(labelId);
      if (lbl) lbl.textContent = lvl.label;
      const dec = document.getElementById(decId);
      const inc = document.getElementById(incId);
      if (dec) dec.disabled = (idx === 0);
      if (inc) inc.disabled = (idx === ROW_SPACING_LEVELS.length - 1);
      try{ sessionStorage.setItem(sessionKey, String(idx)); }catch(e){}
    }
    function adjust(dir){
      const next = idx + dir;
      if (next < 0 || next >= ROW_SPACING_LEVELS.length) return;
      idx = next;
      apply();
    }
    function init(){
      try{
        const saved = sessionStorage.getItem(sessionKey);
        if (saved !== null) {
          const n = parseInt(saved, 10);
          if (!isNaN(n) && n >= 0 && n < ROW_SPACING_LEVELS.length) idx = n;
        }
      }catch(e){}
      apply();
    }
    return { init, adjust };
  }

  /**
   * getPdfScale(selectId, defaultPercent)
   * อ่านค่าที่เลือกจาก <select> สเกล PDF คืนเป็นทศนิยม 0-1 พร้อมส่งให้
   * pdfOptions.scale ของ Puppeteer ตรงๆ — รองรับทั้ง <option value="75">
   * และ <option value="0.75"> (เผื่อไฟล์ในอนาคตเขียนคนละแบบ)
   */
  function getPdfScale(selectId, defaultPercent) {
    const raw = parseFloat(document.getElementById(selectId)?.value);
    if (isNaN(raw)) return defaultPercent / 100;
    return raw > 1 ? raw / 100 : raw;
  }

  window.PaginateTH = {
    mmToPx, measureHeight, paginateByHeight,
    ROW_SPACING_LEVELS, makeRowSpacingControl,
    getPdfScale,
  };
})();
