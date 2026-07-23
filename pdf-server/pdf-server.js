const express   = require('express');
const cors      = require('cors');
const puppeteer = require('puppeteer-core');
const chromium  = require('@sparticuz/chromium');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '20mb' }));

let browserPromise = null;

// ฟังก์ชันสำหรับเปิด Browser
async function getBrowser() {
  return await puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
  });
}

// เริ่มเปิด Browser ตอนรันเซิร์ฟเวอร์
browserPromise = getBrowser();

app.post(['/pdf', '/generate-pdf'], async (req, res) => {
  const { html, filename } = req.body;
  if (!html) {
    return res.status(400).json({ error: 'ไม่มีข้อมูล HTML' });
  }

  let page = null;
  try {
    let browser = await browserPromise;

    // เช็กว่า Browser ค้าง/ดับไปหรือยัง ถ้าดับให้เปิดใหม่
    if (!browser || !browser.isConnected()) {
      browserPromise = getBrowser();
      browser = await browserPromise;
    }

  page = await browser.newPage();

    // 1. กำหนดความกว้างหน้าจอระดับ HD ให้รองรับการจัด Layout ตาราง/คอลัมน์ได้ครบ
    await page.setViewport({ width: 1240, height: 1754, deviceScaleFactor: 2 });

    // 2. สั่งให้ Puppeteer เรนเดอร์ด้วยโหมดการพิมพ์ (Print Media)
    await page.emulateMediaType('print');

    // 3. ใส่ HTML และตั้ง waitUntil เป็น networkidle0 เพื่อรอให้ CSS/Font ทั้งหมดโหลดเสร็จสมบูรณ์
    await page.setContent(html, { 
      waitUntil: ['domcontentloaded', 'networkidle0'], 
      timeout: 30000 
    });

    // 4. สั่งสร้าง PDF
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true, // ดึงสีพื้นหลังและสีตารางมาครบ
      margin: { top: '8mm', right: '8mm', bottom: '8mm', left: '8mm' },
      preferCSSPageSize: true
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
