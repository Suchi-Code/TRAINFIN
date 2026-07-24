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

app.post(['/pdf', '/generate-pdf'], async (req, res) => {
  const { html, filename } = req.body;
  if (!html) {
    return res.status(400).json({ error: 'ไม่มีข้อมูล HTML' });
  }

  let page = null;
  try {
    let browser = await browserPromise;

    if (!browser || !browser.isConnected()) {
      browserPromise = getBrowser();
      browser = await browserPromise;
    }

    page = await browser.newPage();

    // ✅ ตั้ง viewport ให้เท่ากับขนาด A4 ที่ 96 DPI ก่อน (กัน layout เพี้ยนจาก responsive CSS)
    // A4 = 8.27in x 11.69in => 96dpi ≈ 794 x 1123 px
    await page.setViewport({
      width: 794,
      height: 1123,
      deviceScaleFactor: 2, // เพิ่มความคมชัดของภาพ/ตัวอักษรใน PDF
    });

    // ✅ เอกสารนี้ถูกออกแบบมาเป็น "เอกสารพิมพ์" โดยเฉพาะ (มี @media print / @page
    // กำหนด margin ไว้ตั้งใจ) จึงควรใช้ media 'print' ให้ตรงกับเจตนาการออกแบบ
    await page.emulateMediaType('print');

    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });

    // ✅ รอฟอนต์ (Sarabun) โหลด/render เสร็จจริง ก่อนพ่น PDF
    await page.evaluate(async () => {
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }
    });

    // ✅ กันเคสฟอนต์/รูปภาพโหลดช้ากว่านั้นอีกนิด
    await new Promise((r) => setTimeout(r, 150));

    // ✅ preferCSSPageSize: true ทำให้ Puppeteer อ่านค่า @page ที่ฝังมาใน HTML
    // (เช่น margin: 25.4mm 10mm 43mm 10mm) แทนที่จะใช้ค่า margin ที่ฮาร์ดโค้ดไว้ตรงนี้
    // ถ้า HTML ที่ส่งมาไม่มี @page กำหนดไว้ จะ fallback ไปใช้ margin ด้านล่างแทน
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: '0.2in', right: '0.2in', bottom: '0.2in', left: '0.2in' },
    });

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
