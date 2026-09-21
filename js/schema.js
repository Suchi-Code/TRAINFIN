/* ============================================================
   js/schema.js — ชื่อ/โครงสร้างหมวดงบประมาณมาตรฐาน (clean, ไม่มี fallback ชื่อเก่า)
   ------------------------------------------------------------
   รวมจาก SEC_OPTS / DYNAMIC_SEC_ORDER / SUB_OPTS / getActiveSections() /
   computeMajorNumbers() ที่เดิมก็อปวางเหมือนกันทุกตัวอักษรอยู่ในไฟล์ 06 และ 09

   ⚠️ เปลี่ยนจากเดิม 2 เรื่อง:
   1) ตัด 'int_lodging'/'int_travel' ออกจากหมวดย่อยของ 'int' เหลือแค่ค่าสมนาคุณ
      เพราะที่พัก/พาหนะวิทยากรภายในเป็นเงินโอนหน่วยงานต้นสังกัด อนุมัติ=ใช้จริงเสมอ
      คีย์ครั้งเดียวในไฟล์ 05 พอ ไม่ต้องผ่านไฟล์ 06 อีก
   2) เปลี่ยนรหัสหมวดจากตัวเลขล้วน ('1','2','3','4','1_1','3_12','4_3' ฯลฯ) เป็นภาษา
      อังกฤษสื่อความหมาย (camelCase) กันสับสน — ชื่อคอลัมน์ Google Sheet จริง
      (s11, sec1_1, a_4_1 ฯลฯ ใน Code.gs) "ไม่ได้เปลี่ยนตาม" เพราะเป็นคนละชั้นกัน
      ดู SHEET_FIELD_MAP ด้านล่างสำหรับตาราง mapping ระหว่างชื่อใหม่นี้กับคอลัมน์จริง
   ============================================================ */
(function () {

  const SEC = {
    FUEL:         'fuel',
    OFFICE:       'office',
    MISC:         'misc',
    LUMP:         'lump',
    VENUE:        'venue',
    FOOD:         'food',
    STAFF_TRAVEL: 'staffTravel',
    EXT:          'ext',
    INT:          'int',
  };

  const SUB = {
    OFFICE_STATIONERY:   'officeStationery',
    OFFICE_COPY:         'officeCopy',
    VENUE_MEETING:       'venueMeeting',
    VENUE_VIP_LODGING:   'venueVipLodging',
    VENUE_STAFF_LODGING: 'venueStaffLodging',
    FOOD_LUNCH_SNACK:    'foodLunchSnack',
    FOOD_LUNCH:          'foodLunch',
    FOOD_SNACK:          'foodSnack',
    FOOD_DINNER:         'foodDinner',
    FOOD_SPEAKER_DINNER: 'foodSpeakerDinner',
    STAFF_ALLOWANCE:     'staffAllowance',
    STAFF_LODGING:       'staffLodging',
    STAFF_TRANSPORT:     'staffTransport',
    EXT_HONORARIUM:      'extHonorarium',
    EXT_LODGING:         'extLodging',
    EXT_TRAVEL:          'extTravel',
    INT_HONORARIUM:      'intHonorarium',
  };

  const SEC_OPTS = [
    { v: SEC.FUEL,         l: 'ค่าน้ำมันเชื้อเพลิงและหล่อลื่น' },
    { v: SEC.OFFICE,       l: 'ค่าวัสดุสำนักงาน' },
    { v: SEC.MISC,         l: 'ค่าวัสดุเบ็ดเตล็ด' },
    { v: SEC.LUMP,         l: 'ค่าจ้างเหมา (รถตู้/พาหนะรับจ้าง)' },
    { v: SEC.VENUE,        l: 'ค่าเช่าสถานที่' },
    { v: SEC.FOOD,         l: 'ค่าอาหารและเครื่องดื่ม' },
    { v: SEC.STAFF_TRAVEL, l: 'ค่าเดินทางเจ้าหน้าที่ดำเนินการและประสานงาน (กฝภ.1)' },
    { v: SEC.EXT,          l: 'ค่าสมนาคุณวิทยากรภายนอก' },
    { v: SEC.INT,          l: 'ค่าสมนาคุณวิทยากรภายใน (จ่ายผ่าน payroll)' },
  ];

  const DYNAMIC_SEC_ORDER = [SEC.FUEL, SEC.OFFICE, SEC.MISC, SEC.LUMP, SEC.VENUE, SEC.FOOD, SEC.STAFF_TRAVEL, SEC.EXT, SEC.INT];

  // ตัวเลือกประเภทเอกสาร (ใบเสร็จ) — ใช้เฉพาะไฟล์ 06 — เป็น array ของ string ล้วน
  // เพราะค่าที่เก็บกับข้อความที่โชว์เป็นอันเดียวกันอยู่แล้ว ไม่ต้องมี v/l แยกแบบ SEC_OPTS/SUB_OPTS
  const DOC_OPTS = [
    'ใบเสร็จรับเงิน/ใบกำกับภาษี',
    'ใบสำคัญรับเงิน',
    'บิลเงินสด',
    'ใบส่งของ/ใบแจ้งหนี้/ใบกำกับภาษี/ใบเสร็จรับเงิน',
  ];

  // หมวดหมู่ร้านค้า (vendor category) — ใช้เฉพาะไฟล์ 06 (07/09 ไม่มี vendor picker) แต่ย้ายมารวม
  // ไว้ที่นี่ด้วยเพื่อให้แก้/เพิ่มหมวดในอนาคตได้ที่เดียวกับ SEC_OPTS/SUB_OPTS/DOC_OPTS — v = key
  // ภาษาอังกฤษที่เก็บลงคอลัมน์ category ของ Sheet vendors, l = label ไทยที่โชว์, icon = อิโมจิ
  const VENDOR_CATEGORIES = [
    {v:'head office',     l:'สำนักงาน กปภ.', icon:'🏢'},
    {v:'PWA reg.10',     l:'กปภ.ข.10 และสาขา', icon:'🏢'},
    {v:'PWA reg.9',     l:'กปภ.ข.9 และสาขา', icon:'🏢'},
    {v:'Macro&7',       l:'แมคโคร & เซเว่นฯ',        icon:'🏪'},
    {v:'shop',       l:'ร้านค้า',        icon:'🏪'},
    {v:'hotel',      l:'โรงแรม',        icon:'🏨'},
    {v:'fuel',       l:'ปั๊มน้ำมัน',      icon:'⛽'},
    {v:'restaurant', l:'ร้านอาหาร',      icon:'🍽️'},
    {v:'other',      l:'อื่นๆ',          icon:'📦'},
  ];

  const LOAN_SECTIONS = new Set([SEC.FUEL, SEC.OFFICE, SEC.MISC, SEC.LUMP, SEC.VENUE, SEC.FOOD, SEC.STAFF_TRAVEL, SEC.EXT]);

  const SUB_OPTS = {
    [SEC.OFFICE]: [
      { v: '',                     l: '— ไม่ระบุหมวดย่อย —' },
      { v: SUB.OFFICE_STATIONERY,  l: 'ค่าเครื่องเขียนแบบพิมพ์' },
      { v: SUB.OFFICE_COPY,        l: 'ค่าถ่ายเอกสารและเข้าเล่ม' },
    ],
    [SEC.VENUE]: [
      { v: '',                       l: '— ไม่ระบุหมวดย่อย —' },
      { v: SUB.VENUE_MEETING,        l: 'ค่าเช่าห้องประชุม' },
      { v: SUB.VENUE_VIP_LODGING,    l: 'ค่าเช่าห้องพัก ประธานในพิธี' },
      { v: SUB.VENUE_STAFF_LODGING,  l: 'ค่าเช่าห้องพัก ผู้เข้าอบรม/เจ้าหน้าที่' },
    ],
    [SEC.FOOD]: [
      { v: '',                       l: '— ไม่ระบุหมวดย่อย —' },
      { v: SUB.FOOD_LUNCH_SNACK,     l: 'บิลรวม (กรอกคู่ (อาหารกลางวัน+อาหารว่าง))' },
      { v: SUB.FOOD_LUNCH,           l: 'อาหารกลางวัน (บิลแยก)' },
      { v: SUB.FOOD_SNACK,           l: 'อาหารว่างและเครื่องดื่ม (บิลแยก)' },
      { v: SUB.FOOD_DINNER,          l: 'อาหารเย็น' },
      { v: SUB.FOOD_SPEAKER_DINNER,  l: 'อาหารเย็นวิทยากรภายนอก' },
    ],
    [SEC.STAFF_TRAVEL]: [
      { v: '',                     l: '— ไม่ระบุหมวดย่อย —' },
      { v: SUB.STAFF_ALLOWANCE,    l: 'ค่าเบี้ยเลี้ยง' },
      { v: SUB.STAFF_LODGING,      l: 'ค่าที่พัก' },
      { v: SUB.STAFF_TRANSPORT,    l: 'ค่าพาหนะ' },
    ],
    [SEC.EXT]: [
      { v: '',                   l: '— ไม่ระบุหมวดย่อย —' },
      { v: SUB.EXT_HONORARIUM,   l: 'ค่าสมนาคุณวิทยากร' },
      { v: SUB.EXT_LODGING,      l: 'ค่าที่พักวิทยากร' },
      { v: SUB.EXT_TRAVEL,       l: 'ค่าพาหนะ/เดินทางวิทยากร' },
    ],
    [SEC.INT]: [
      { v: '',                   l: '— ไม่ระบุหมวดย่อย —' },
      { v: SUB.INT_HONORARIUM,   l: 'ค่าสมนาคุณวิทยากร' },
    ],
  };

  function getSubOpts(sec) {
    return SUB_OPTS[sec] || [];
  }

  function getActiveSections(rows, toggles, budget) {
    if (toggles) {
      const b = budget || {};
      const set = new Set();
      if (toggles.fuel && toggles.fuel.on) set.add(SEC.FUEL);
      if (!toggles.toggles || toggles.toggles.office !== false) set.add(SEC.OFFICE);
      if (!toggles.toggles || toggles.toggles.misc !== false) set.add(SEC.MISC);
      if (toggles.lump && toggles.lump.on) set.add(SEC.LUMP);
      if (toggles.venue && toggles.venue.on) set.add(SEC.VENUE);
      if (!toggles.toggles || toggles.toggles.food !== false) set.add(SEC.FOOD);
      if (!toggles.toggles || toggles.toggles.stafftravel !== false) set.add(SEC.STAFF_TRAVEL);
      const extHasAmount = (Number(b.sec5)||0) + (Number(b.sec6)||0) > 0;
      const extHasSpeakers = Array.isArray(toggles.EXT) && toggles.EXT.length > 0;
      if (toggles.hasExternal !== false && (extHasAmount || extHasSpeakers)) set.add(SEC.EXT);
      const intHasSpeakers = Array.isArray(toggles.INT) && toggles.INT.length > 0;
      if (toggles.hasInternal || intHasSpeakers || (rows || []).some(r => (r.secV || r.sec) === SEC.INT)) set.add(SEC.INT);
      return set;
    }
    return new Set((rows || []).map(r => r.secV || r.sec));
  }

  function computeMajorNumbers(rows, toggles, budget) {
    const present = getActiveSections(rows, toggles, budget);
    const nums = {};
    let n = 0;
    DYNAMIC_SEC_ORDER.forEach(sec => {
      if (present.has(sec)) { n++; nums[sec] = String(n); }
    });
    return nums;
  }

  const SHEET_FIELD_MAP = {
    budget: {
      [SEC.FUEL]:         { total: 'secFuel' },
      [SEC.OFFICE]:       { total: 'sec1', [SUB.OFFICE_STATIONERY]: 's11', [SUB.OFFICE_COPY]: 's12' },
      [SEC.MISC]:         { total: 'sec2', value: 's21' },
      [SEC.LUMP]:         { total: 'secLump' },
      [SEC.VENUE]:        { total: 'secVenue', [SUB.VENUE_MEETING]: 'secVenueMeeting', [SUB.VENUE_VIP_LODGING]: 'secVenueVip', [SUB.VENUE_STAFF_LODGING]: 'secVenueStaff' },
      [SEC.FOOD]:         { total: 'sec3', [SUB.FOOD_LUNCH]: 's31', [SUB.FOOD_DINNER]: 'sD', [SUB.FOOD_SNACK]: 's32', [SUB.FOOD_SPEAKER_DINNER]: 's33' },
      [SEC.STAFF_TRAVEL]: { total: 'sec4', [SUB.STAFF_ALLOWANCE]: 's41', [SUB.STAFF_LODGING]: 's42', [SUB.STAFF_TRANSPORT]: 's43' },
      [SEC.EXT]:          { part1: 'sec5', part2: 'sec6' },
      [SEC.INT]:          { total: 'secInternal', allowance: 'in_allowance', lodging: 'in_lodging', travel: 'in_travel', payroll: 'in_payroll' },
      pres:                { total: 'secPres', allowance: 'pres1', lodging: 'pres2', travel: 'pres3' },
      grandTotal: 'grandTotal', gorLoanTotal: 'gorTotal', korTotal: 'korTotal', budgetTotal: 'budgetTotal',
    },
    actual06: {
      [SEC.FUEL]:         { total: 'secFuel' },
      [SEC.OFFICE]:       { total: 'sec1', [SUB.OFFICE_STATIONERY]: 'sec1_1', [SUB.OFFICE_COPY]: 'sec1_2' },
      [SEC.MISC]:         { total: 'sec2' },
      [SEC.LUMP]:         { total: 'secLump' },
      [SEC.VENUE]:        { total: 'secVenue', [SUB.VENUE_MEETING]: 'secVenueMeeting', [SUB.VENUE_VIP_LODGING]: 'secVenueVip', [SUB.VENUE_STAFF_LODGING]: 'secVenueStaff' },
      [SEC.FOOD]:         { total: 'sec3', [SUB.FOOD_LUNCH]: 'sec3_1', [SUB.FOOD_SNACK]: 'sec3_2', [SUB.FOOD_DINNER]: 'sec3Dinner', [SUB.FOOD_SPEAKER_DINNER]: 'sec3_3' },
      [SEC.STAFF_TRAVEL]: { total: 'sec4', [SUB.STAFF_ALLOWANCE]: 'sec4_1', [SUB.STAFF_LODGING]: 'sec4_2', [SUB.STAFF_TRANSPORT]: 'sec4_3' },
      [SEC.EXT]:          { total: 'secExt', [SUB.EXT_HONORARIUM]: 'secExtHonor', [SUB.EXT_LODGING]: 'secExtLodging', [SUB.EXT_TRAVEL]: 'secExtTravel' },
      [SEC.INT]:          { total: 'secInt', [SUB.INT_HONORARIUM]: 'secIntHonor' },
      grandTotal: 'grandTotal',
    },
    actual07: {
      [SEC.FUEL]:         { total: 'a_fuel' },
      [SEC.OFFICE]:       { [SUB.OFFICE_STATIONERY]: 'a_1_1', [SUB.OFFICE_COPY]: 'a_1_2' },
      [SEC.MISC]:         { total: 'a_2_1' },
      [SEC.LUMP]:         { total: 'a_lump' },
      [SEC.VENUE]:        { [SUB.VENUE_MEETING]: 'a_venue_meet', [SUB.VENUE_VIP_LODGING]: 'a_venue_vip', [SUB.VENUE_STAFF_LODGING]: 'a_venue_staff' },
      [SEC.FOOD]:         { [SUB.FOOD_LUNCH]: 'a_3_1', [SUB.FOOD_DINNER]: 'a_food_dinner', [SUB.FOOD_SNACK]: 'a_3_2', [SUB.FOOD_SPEAKER_DINNER]: 'a_3_3' },
      [SEC.STAFF_TRAVEL]: { [SUB.STAFF_ALLOWANCE]: 'a_4_1', [SUB.STAFF_LODGING]: 'a_4_2', [SUB.STAFF_TRANSPORT]: 'a_4_3' },
      [SEC.INT]:          { allowance: 'a_in_1', lodging: 'a_in_2', travel: 'a_in_3', payroll: 'a_in_payroll' },
      pres:                { allowance: 'a_pres_1', lodging: 'a_pres_2', travel: 'a_pres_3' },
      korTravelerAllowance: 'a_b1', korTravelerLodging: 'a_b2', korTravelerTransport: 'a_b3',
      grandTotal: 'grandTotal',
    },
  };

  window.SchemaTH = {
    SEC,
    SUB,
    SEC_OPTS,
    DOC_OPTS,
    VENDOR_CATEGORIES,
    DYNAMIC_SEC_ORDER,
    LOAN_SECTIONS,
    SUB_OPTS,
    SHEET_FIELD_MAP,
    getSubOpts,
    getActiveSections,
    computeMajorNumbers,
  };
})();
