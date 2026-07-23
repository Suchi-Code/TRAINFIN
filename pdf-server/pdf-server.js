const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' })); // ป้องกัน HTML ขนาดใหญ่เกินไป

app.post('/generate-pdf', async (req, res) => {
  let browser = null;
  try {
    // 💡 รับค่า filename เพิ่มเติมจาก req.body (ถ้านึกไม่ออกจะส่งอะไร จะใช้ 'document' เป็นค่าเริ่มต้น)
    const { html, filename } = req.body;

    if (!html) {
      return res.status(400).send('No HTML content provided');
    }

    // 1. ตั้งค่า launch arguments ให้รองรับระบบ Render (RAM 512MB)
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage', // ⚠️ สำคัญมากสำหรับ Render เพื่อไม่ให้ RAM เต็ม
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });

    const page = await browser.newPage();

    // 2. ใช้ domcontentloaded แทน networkidle0 เพื่อลดโอกาส Timeout 500
    await page.setContent(html, { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });

    // 3. แปลงเป็น PDF
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' }
    });

    await browser.close();

    // ----------------------------------------------------
    // 4. แปลงชื่อไฟล์เป็น UTF-8 Safe Format และตั้งค่า Header ป้องกัน ERR_INVALID_CHAR
    // ----------------------------------------------------
    const safeFilename = encodeURIComponent(filename || 'document');

    res.setHeader('Content-Type', 'application/pdf');
    // ใช้รูปแบบ RFC 5987 (filename*=UTF-8'') เพื่อให้รองรับภาษาไทยใน Header ได้ 100%
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${safeFilename}.pdf`);
    
    res.send(pdfBuffer);

  } catch (error) {
    console.error('Puppeteer PDF Error:', error);
    if (browser) await browser.close();
    res.status(500).send('PDF Generation Failed: ' + error.message);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`PDF Server running on port ${PORT}`);
});
