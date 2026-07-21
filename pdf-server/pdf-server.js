// ============================================================
//  pdf-server.js — Puppeteer PDF generation server
//  รับ HTML มา render ด้วย Chromium จริง แล้วส่งไฟล์ PDF กลับ
//  ใช้แทน html2canvas + jsPDF เดิมในไฟล์ 05 (Puppeteer ตัดหน้า A4
//  ให้เองอัตโนมัติผ่าน page.pdf() ไม่ต้องหั่นภาพเป็น canvas)
// ============================================================

const express   = require('express');
const cors      = require('cors');
const puppeteer = require('puppeteer');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());                        // อนุญาตให้เรียกจากโดเมนอื่น (ไฟล์ 05 อยู่คนละที่กับ server นี้)
app.use(express.json({ limit: '20mb' })); // รายงานบางฉบับ HTML ยาว ตั้ง limit ไว้กันพลาด

// เปิด browser instance เดียวไว้ใช้ซ้ำ (เร็วกว่าเปิดใหม่ทุกครั้งมาก)
let browserPromise = puppeteer.launch({
  headless: 'new',
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage', // กันปัญหา memory บน container เล็กๆ เช่น Render/Railway free tier
  ],
});

app.get('/health', (req, res) => res.json({ ok: true }));

app.post('/pdf', async (req, res) => {
  const { html, filename } = req.body || {};

  if (!html || typeof html !== 'string') {
    return res.status(400).json({ error: 'ต้องส่ง "html" มาด้วย (string)' });
  }

  let page;
  try {
    const browser = await browserPromise;
    page = await browser.newPage();

    // โหลด HTML ที่ส่งมาเข้า page โดยตรง แล้วรอจน network idle (ฟอนต์/รูปโหลดครบ)
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

// ปิด browser ให้เรียบร้อยตอน process ถูกสั่งหยุด (กัน process ค้าง)
process.on('SIGTERM', async () => {
  const browser = await browserPromise;
  await browser.close();
  process.exit(0);
});
