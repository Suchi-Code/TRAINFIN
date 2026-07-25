const express   = require('express');
const cors      = require('cors');
const puppeteer = require('puppeteer-core');
const chromium  = require('@sparticuz/chromium');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '20mb' }));

let browserPromise = null;

async function getBrowser() {
  return await puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
  });
}

browserPromise = getBrowser();

/**
 * ✅ SERVER กลาง ใช้ร่วมกันได้ทุกไฟล์ (05-09 หรือไฟล์ในอนาคต)
 * -----------------------------------------------------------------
 * แต่ละไฟล์ layout ไม่เหมือนกัน (บางไฟล์แนวตั้ง/แนวนอน, margin ไม่เท่ากัน,
 * บางไฟล์ต้อง scale ลงเพราะตารางกว้าง) ดังนั้น "ค่าที่เกี่ยวกับหน้ากระดาษ"
 * ทั้งหมดจึงไม่ hardcode ไว้ที่นี่ แต่รับมาเป็น JSON จากฝั่ง client แทน
 * (ดู client-pdf-export.js ที่ห่อ logic นี้ไว้ให้แต่ละไฟล์เรียกใช้)
 *
 * รูปแบบ request body:
 * {
 *   html: "<!DOCTYPE html>...",   // เอกสารที่ประกอบ CSS ครบแล้ว (จำเป็น)
 *   filename: "report_xxx",       // ชื่อไฟล์ (ไม่ต้องมี .pdf) (ไม่จำเป็น)
 *   pdfOptions: {                 // ทั้งหมดเป็น optional มี default ทุกตัว
 *     format: "A4",               // "A4" | "Letter" | ... หรือเว้นว่างถ้าใช้ width/height
 *     width, height,              // เผื่อบางไฟล์ใช้ขนาดกระดาษกำหนดเอง เช่น "216mm"
 *     landscape: false,           // true = แนวนอน
 *     scale: 1,                   // 0.1 - 2 เทียบเท่า % ในหน้าต่างพิมพ์เบราว์เซอร์
 *     margin: { top, right, bottom, left },  // string เช่น "10mm" หรือ "0.2in"
 *     preferCSSPageSize: true,    // true = ให้ @page ใน HTML คุมขนาด/margin แทน
 *     mediaType: "print"          // "print" | "screen"
 *   }
 * }
 */
app.post(['/pdf', '/generate-pdf'], async (req, res) => {
  const { html, filename } = req.body;
  if (!html) {
    return res.status(400).json({ error: 'ไม่มีข้อมูล HTML' });
  }

  // ✅ Backward-compatible: รองรับทั้ง request รูปแบบเก่า (ไฟล์ 07 ส่ง { scale } ตรงๆ)
  // และรูปแบบใหม่ (ไฟล์ 05 เป็นต้นไป ส่ง { pdfOptions: {...} }) — ไม่ต้องแก้ไฟล์ 07 ก็ยังทำงานได้
  const pdfOptions = { ...(req.body.pdfOptions || {}) };
  if (pdfOptions.scale === undefined && req.body.scale !== undefined) {
    pdfOptions.scale = req.body.scale;
  }
  if (pdfOptions.margin === undefined && req.body.margin !== undefined) {
    pdfOptions.margin = req.body.margin;
  }

  let page = null;
  try {
    let browser = await browserPromise;

    if (!browser || !browser.isConnected()) {
      browserPromise = getBrowser();
      browser = await browserPromise;
    }

    page = await browser.newPage();

    // ขนาด viewport อ้างอิงจากขนาดกระดาษจริงที่จะพิมพ์ (กัน responsive CSS เพี้ยน)
    // ถ้าเป็นแนวนอน (landscape) หรือใช้ width/height เอง ให้คำนวณ viewport ตามนั้น
    const isLandscape = !!pdfOptions.landscape;
    const baseW = 794;  // A4 width  @ 96dpi
    const baseH = 1123; // A4 height @ 96dpi
    await page.setViewport({
      width: isLandscape ? baseH : baseW,
      height: isLandscape ? baseW : baseH,
      deviceScaleFactor: 2,
    });

    await page.emulateMediaType(pdfOptions.mediaType === 'screen' ? 'screen' : 'print');

    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });

    // รอฟอนต์ (เช่น Sarabun) โหลด/render เสร็จจริงก่อนพ่น PDF
    await page.evaluate(async () => {
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }
    });
    await new Promise((r) => setTimeout(r, 150));

    const scale = Math.min(Math.max(Number(pdfOptions.scale) || 0.8, 0.1), 2);
    const margin = pdfOptions.margin || {
      top: '0.2in', right: '0.2in', bottom: '0.2in', left: '0.2in',
    };

    const pdfPayload = {
      printBackground: true,
      preferCSSPageSize: pdfOptions.preferCSSPageSize !== false, // default true
      landscape: isLandscape,
      scale,
      margin,
    };

    // ถ้าระบุ width/height มาเอง ใช้แทน format (เช่นกระดาษขนาดพิเศษ)
    if (pdfOptions.width && pdfOptions.height) {
      pdfPayload.width  = pdfOptions.width;
      pdfPayload.height = pdfOptions.height;
    } else {
      pdfPayload.format = pdfOptions.format || 'A4';
    }

    const pdfBuffer = await page.pdf(pdfPayload);

    const safeName = String(filename || 'report').replace(/[^\w\u0E00-\u0E7F\-]+/g, '_');

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(safeName)}.pdf`,
    });
    res.send(pdfBuffer);

  } catch (err) {
    console.error('PDF generation error:', err);
    res.status(500).json({ error: err.message || 'สร้าง PDF ไม่สำเร็จ' });
  } finally {
    if (page) await page.close().catch(() => {});
  }
});

app.listen(PORT, () => {
  console.log(`✅ PDF server พร้อมใช้งานที่ port ${PORT}`);
});

process.on('SIGTERM', async () => {
  if (browserPromise) {
    const browser = await browserPromise;
    if (browser) await browser.close();
  }
  process.exit(0);
});
