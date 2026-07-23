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

    // ✨ เพิ่มบรรทัดนี้ใหม่เข้าไปครับ ✨
    await page.emulateMediaType('print');
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
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
