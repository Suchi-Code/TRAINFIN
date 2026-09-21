/* ============================================================
   js/config.js — ค่าตั้งต้นกลางของทั้งระบบ (API keys / URLs)
   ------------------------------------------------------------
   แก้คีย์/URL ที่นี่ที่เดียว มีผลกับทุกไฟล์ที่โหลด script นี้
   (ต้องโหลดไฟล์นี้ "ก่อน" date-th.js / gas-api.js / auth.js / schema.js เสมอ)
   ============================================================ */
window.APP_CONFIG = {
  SUPABASE_URL      : 'https://dcaydbxyjisegqzzildq.supabase.co',
  SUPABASE_ANON_KEY : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjYXlkYnh5amlzZWdxenppbGRxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2OTk5NDgsImV4cCI6MjEwMDI3NTk0OH0.cEk8k90NeTTnkZV0Sny7nuN8UbW15_eW8S_HTQSBwwA',

  // Google Apps Script Web App (deployment เดียวกับที่ทุกไฟล์ใช้อยู่ตอนนี้)
  GAS_URL           : 'https://script.google.com/macros/s/AKfycbySJROnBMkxFBNyPvET3DC5ihdCz03OPzvi2xXm6cMQpoPFsi2pAiTQAQIVSDUwQNVZ5w/exec',

  // Puppeteer PDF server (Render) — endpoint เดียว /generate-pdf (ตัด /pdf เก่าออกแล้ว)
  PDF_SERVER_URL    : 'https://trainfin.onrender.com/generate-pdf',

  // Supabase Storage bucket ที่ใช้เก็บ PDF รายงาน
  PDF_BUCKET        : 'pdfs',

  // หน้า login ที่ checkAuth() จะเด้งกลับไปถ้ายังไม่ได้ล็อกอิน
  LOGIN_URL         : 'index.html',
};
