const express   = require('express');
const cors      = require('cors');
const puppeteer = require('puppeteer');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '20mb' }));

// ฟังก์ชันสำหรับเปิด Browser แบบติดตัวแปรสภาพแวดล้อมบน Linux/Render
async function getBrowser() {
  return await puppeteer.launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
    ],
  });
}

let browserPromise = getBrowser();

app.get('/health', (req, res) => res.json({ ok: true }));

app.post('/pdf', async (req, res) => {
  const { html, filename } = req.body || {};

  if (!html || typeof html !== 'string') {
    return res.status(400).json({ error: 'ต้องส่ง "html" มาด้วย (string)' });
  }

  let page;
  try {
    let browser = await browserPromise;
    
    // เช็คว่า Browser ค้าง/ดับไปหรือยัง ถ้าดับให้เปิดใหม่
    if (!browser.isConnected()) {
      browserPromise = getBrowser();
      browser = await browserPromise;
    }

    page = await browser.newPage();

    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0.2in', right: '0.2in', bottom: '0.2in', left: '0.2in' },
    });

    const safeName = String(filename || 'report').replace(/[^\w\u0E00-\u0E7F\-]+/g, '_');

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${safeName}.pdf"`,
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
  const browser = await browserPromise;
  if (browser) await browser.close();
  process.exit(0);
});
