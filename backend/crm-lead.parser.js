// ═══════════════════════════════════════════════════════════════════════════════
// Walk The plan — CRM Lead Import & Normalization Parser
// Handles Excel (.xlsx, .xls), CSV, TSV, and JSON uploads.
// Robustly extracts ONLY important fields and cleans/sanitizes worn/wrong fields.
// ═══════════════════════════════════════════════════════════════════════════════

const XLSX = require('xlsx');

// Normalizes header string to alphanumeric lowercase
function normalizeKey(str) {
  if (str === null || str === undefined) return '';
  return String(str).toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Check if a value is considered "empty" or placeholder
function isNil(val) {
  if (val === null || val === undefined) return true;
  const s = String(val).trim().toLowerCase();
  return (
    s === '' ||
    s === 'null' ||
    s === 'undefined' ||
    s === 'n/a' ||
    s === 'na' ||
    s === 'none' ||
    s === 'nil' ||
    s === '-' ||
    s === '--' ||
    s === '---' ||
    s === 'unknown'
  );
}

// Normalized keys that MUST NEVER match client name (Meta & Ad metadata)
const NON_CLIENT_NAMES = [
  'adname', 'adsetname', 'campaignname', 'formname', 'studioname',
  'filename', 'pagename', 'plantname', 'packagename', 'servicename',
  'eventname', 'groupname', 'accountname', 'leadgenname', 'sheetname'
];

const INVALID_NAME_VALUES = [
  'ad a', 'ad b', 'ad c', 'ad 1', 'ad 2', 'ad name', 'ad_name',
  'meta ad', 'meta ad campaign', 'campaign', 'campaign name',
  'walk the plan', 'walk the plan 1:1', 'google sheet live sync',
  'meta customer', 'new meta lead', 'sheet lead', 'rokon', 'test', 'demo',
  'lead', 'prospect', 'customer', 'client'
];

// Validates whether a value is a genuine client human name
function isInvalidClientName(val) {
  if (isNil(val)) return true;
  const s = String(val).trim().toLowerCase();
  if (s.length < 2 || s.length > 60) return true;
  if (s.includes('@') || s.includes('http') || s.includes('www.') || s.includes('\n')) return true;
  if (/^\+?[\d\s\-()]+$/.test(s)) return true; // pure numbers
  if (INVALID_NAME_VALUES.includes(s)) return true;
  const norm = s.replace(/[^a-z0-9]/g, '');
  if (NON_CLIENT_NAMES.includes(norm)) return true;
  if (/^(ad|adset|campaign|form|page|file|studio|package|sheet|id|l:|leadgen)[\s_-]*([a-z0-9]+)?$/i.test(s)) return true;
  if (/^(pending|ready|residential|commercial|instagram|facebook|meta)$/i.test(s)) return true;
  return false;
}

// Dictionary of aliases for important CRM lead fields
const FIELD_ALIASES = {
  // Exact client identifiers prioritized first
  name: [
    'fullname', 'clientname', 'customername', 'prospectname', 'contactname',
    'contactperson', 'leadname', 'person', 'client', 'customer', 'prospect',
    'full_name', 'client_name', 'customer_name', 'name'
  ],
  firstName: ['firstname', 'fname', 'first'],
  lastName: ['lastname', 'lname', 'surname', 'last'],
  phone: [
    'phonenumber', 'phoneno', 'mobile', 'mobilenumber', 'mobileno',
    'contact', 'contactno', 'contactnumber', 'contactnum', 'cell', 'cellphone',
    'whatsapp', 'whatsappnumber', 'whatsappno', 'tel', 'telephone', 'call', 'mob',
    'phone_number', 'phone'
  ],
  email: [
    'email', 'emailid', 'emailaddress', 'mail', 'mailid', 'contactemail',
    'emailaddr', 'useremail', 'email_address'
  ],
  meta_platform: [
    'platform', 'metaplatform', 'adplatform', 'fb', 'ig', 'acquisitionplatform', 'channelplatform'
  ],
  meta_campaign_name: [
    'campaignname', 'campaignid', 'campaign', 'adcampaign', 'campaign_name', 'campaign_id'
  ],
  meta_ad_name: [
    'adname', 'adid', 'adsetname', 'adsetid', 'formname', 'formid', 'ad_name', 'ad_id', 'adset_name', 'adset_id', 'form_name', 'form_id'
  ],
  floor_plan_status: [
    'whatisyourfloorplanstatus', 'whatisyourfloorplanstatus?', 'floorplanstatus', 'floorplan', 'planstatus', 'floor_plan_status'
  ],
  plot_size: [
    'whatisyourplotsize', 'whatisyourplotsize?', 'plotsize', 'plotsizerange', 'plotsqyards', 'plot_size'
  ],
  city: [
    'city', 'town', 'district', 'location', 'place', 'citytown', 'leadcity',
    'plantlocation', 'citylocation', 'site'
  ],
  state: [
    'state', 'province', 'region', 'stateregion'
  ],
  requirement: [
    'requirement', 'requirements', 'req', 'requirementdetails', 'service',
    'services', 'product', 'products', 'query', 'enquiry', 'inquiry',
    'inquirydetails', 'enquirydetails', 'interest', 'interestedin', 'lookingfor',
    'project', 'projectdetails', 'projectrequirement', 'scope', 'workscope',
    'walkthroughrequirement', 'description', 'details', 'need', 'message'
  ],
  budget: [
    'budget', 'estbudget', 'estimatedbudget', 'projectbudget', 'dealvalue',
    'value', 'amount', 'price', 'cost', 'investment', 'budgetscope', 'approxbudget'
  ],
  source: [
    'source', 'leadsource', 'leadorigin', 'channel',
    'origin', 'medium', 'adsource', 'utmsource', 'referral'
  ],
  notes: [
    'notes', 'note', 'remark', 'remarks', 'comment', 'comments', 'feedback',
    'discussion', 'technicalnotes', 'additionalinfo', 'memo', 'summary'
  ],
  status: [
    'status', 'leadstatus', 'stage', 'leadstage', 'pipelinestatus'
  ],
  priority: [
    'priority', 'urgency', 'leadpriority', 'leadquality'
  ],
  follow_up_date: [
    'followupdate', 'followup', 'nextfollowupdate', 'nextfollowup',
    'reminderdate', 'reminder', 'scheduledfollowup', 'scheduleddate', 'duedate',
    'nextcall', 'calldate'
  ],
  assigned_to: [
    'assignedto', 'assigned', 'assignedengineer', 'assignee', 'owner',
    'agent', 'salesrep', 'executive', 'representative', 'engineer'
  ],
  studio_location: [
    'studiolocation', 'studio', 'studioname'
  ],
  package_service: [
    'packageservice', 'packageservicename', 'leadtype', 'packagename'
  ],
  payment_status: [
    'paymentstatus', 'payment'
  ],
  token_paid: [
    'tokenamountpaid', 'tokenpaid', 'tokenamount'
  ],
  balance_pending: [
    'balancepending', 'balanceamount', 'pendingbalance'
  ],
  razorpay_id: [
    'razorpaypaymentid', 'razorpayid'
  ]
};

// Match a raw column header to an allowed CRM lead field
function matchFieldHeader(rawHeader) {
  const norm = normalizeKey(rawHeader);
  if (!norm) return null;

  // 1. Exact alias match in FIELD_ALIASES
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    if (aliases.includes(norm)) return field;
  }

  // 2. Explicitly guard against non-client name headers matching 'name'
  const isNonClient = NON_CLIENT_NAMES.some(k => norm === k || norm.includes(k));
  if (isNonClient) {
    if (norm.includes('adset') || norm.includes('adname') || norm.includes('form') || norm.includes('adid')) return 'meta_ad_name';
    if (norm.includes('campaign')) return 'meta_campaign_name';
    if (norm.includes('studio')) return 'studio_location';
    if (norm.includes('package')) return 'package_service';
    return null;
  }

  // 3. Substring matching for compound headers
  // High confidence phone matches
  if (norm.includes('phone') || norm.includes('mobile') || norm.includes('whatsapp') || norm.includes('cell') || norm.includes('tel')) {
    return 'phone';
  }
  // High confidence email matches
  if (norm.includes('email') || norm.includes('mail')) {
    return 'email';
  }
  // Meta specific questions
  if (norm.includes('floorplan')) {
    return 'floor_plan_status';
  }
  if (norm.includes('plotsize') || norm.includes('sqyard')) {
    return 'plot_size';
  }
  if (norm.includes('platform')) {
    return 'meta_platform';
  }
  if (norm.includes('campaign')) {
    return 'meta_campaign_name';
  }
  if (norm.includes('adname') || norm.includes('adset') || norm.includes('formname')) {
    return 'meta_ad_name';
  }
  // Client Names: prioritize fullname, clientname, customername, or clean name
  if (norm.includes('fullname') || norm.includes('clientname') || norm.includes('customername') || norm.includes('leadname') || norm.includes('contactname') || norm === 'name') {
    return 'name';
  }
  if (norm.includes('client') || norm.includes('customer') || norm.includes('prospect')) {
    return 'name';
  }
  // If ends with name and is not in non-client list
  if (norm.endsWith('name') && !isNonClient) {
    return 'name';
  }
  // Location
  if (norm.includes('city') || norm.includes('town') || norm.includes('location') || norm.includes('district')) {
    return 'city';
  }
  if (norm.includes('state') || norm.includes('province') || norm.includes('region')) {
    return 'state';
  }
  // Requirement
  if (norm.includes('require') || norm.includes('enquiry') || norm.includes('inquiry') || norm.includes('service') || norm.includes('project') || norm.includes('scope')) {
    return 'requirement';
  }
  // Budget
  if (norm.includes('budget') || norm.includes('dealvalue') || norm.includes('cost') || norm.includes('amount') || norm.includes('price')) {
    return 'budget';
  }
  // Follow-up
  if (norm.includes('follow') || norm.includes('remind') || norm.includes('nextcall')) {
    return 'follow_up_date';
  }
  // Assigned
  if (norm.includes('assign') || norm.includes('salesrep') || norm.includes('assignee')) {
    return 'assigned_to';
  }
  // Status
  if (norm.includes('status') || norm.includes('stage')) {
    return 'status';
  }
  // Priority
  if (norm.includes('priorit') || norm.includes('urgenc')) {
    return 'priority';
  }
  // Source
  if (norm.includes('source') || norm.includes('campaign') || norm.includes('channel')) {
    return 'source';
  }
  // Notes
  if (norm.includes('note') || norm.includes('remark') || norm.includes('comment') || norm.includes('feedback')) {
    return 'notes';
  }

  // Unrecognized column (junk, serial no, timestamp, system IDs, etc.)
  return null;
}

// Convert Excel dates or date strings into YYYY-MM-DD
function parseDateValue(val) {
  if (isNil(val)) return null;

  // If already a Date object
  if (val instanceof Date && !isNaN(val.getTime())) {
    return val.toISOString().split('T')[0];
  }

  // Check if numeric or Excel serial day count (e.g. 45612)
  let num = null;
  if (typeof val === 'number') {
    num = val;
  } else if (typeof val === 'string' && /^\d{5}(\.\d+)?$/.test(val.trim())) {
    num = Number(val.trim());
  }

  if (num !== null && Number.isFinite(num) && num > 20000 && num < 80000) {
    try {
      const utcDays = Math.floor(num - 25569);
      const dateInfo = new Date(utcDays * 86400 * 1000);
      if (!isNaN(dateInfo.getTime())) {
        return dateInfo.toISOString().split('T')[0];
      }
    } catch { }
  }

  const s = String(val).trim();
  if (!s) return null;

  // Direct ISO match YYYY-MM-DD
  const isoMatch = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (isoMatch) {
    const yr = isoMatch[1];
    const mo = String(isoMatch[2]).padStart(2, '0');
    const da = String(isoMatch[3]).padStart(2, '0');
    return `${yr}-${mo}-${da}`;
  }

  // DD-MM-YYYY or DD/MM/YYYY (also handle MM/DD/YYYY when second field > 12)
  const dmyMatch = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (dmyMatch) {
    let first = Number(dmyMatch[1]);
    let second = Number(dmyMatch[2]);
    const yr = dmyMatch[3];
    if (second > 12 && first <= 12) {
      const tmp = first;
      first = second;
      second = tmp;
    }
    const da = String(first).padStart(2, '0');
    const mo = String(second).padStart(2, '0');
    return `${yr}-${mo}-${da}`;
  }

  // Try standard Date.parse if it looks like a date string (has month name or slash/dash)
  if (/[-/\s,]/.test(s) && !/^\d+$/.test(s)) {
    const parsed = Date.parse(s);
    if (!isNaN(parsed)) {
      try {
        const d = new Date(parsed);
        const yr = d.getFullYear();
        if (yr >= 2000 && yr <= 2100) {
          return d.toISOString().split('T')[0];
        }
      } catch { }
    }
  }

  return null;
}

// Clean and extract phone number
function cleanPhoneNumber(val) {
  if (isNil(val)) return null;

  let s = '';
  if (typeof val === 'number') {
    if (Number.isFinite(val)) {
      s = Math.round(val).toString();
    } else {
      return null;
    }
  } else {
    s = String(val).trim();
  }

  // If scientific notation string like 9.87654E+09
  if (/^[0-9.]+[eE]\+[0-9]+$/.test(s)) {
    const num = Number(s);
    if (Number.isFinite(num)) {
      s = Math.round(num).toString();
    }
  }

  // Strip common prefixes
  s = s.replace(/^(tel:|p:|phone:|ph:)/i, '').trim();

  // If contains @, it's not a phone number!
  if (s.includes('@')) return null;

  // Remove trailing .0 from Excel integer floats
  s = s.replace(/\.0+$/, '');

  // Keep phone characters: digits, leading +, spaces, hyphens
  const digitsOnly = s.replace(/\D/g, '');
  if (digitsOnly.length < 6) {
    // Too short to be a valid phone number
    return null;
  }

  // Return clean string
  return s.replace(/[^\d+\-\s]/g, '').trim() || digitsOnly;
}

// Clean and extract email
function cleanEmail(val) {
  if (isNil(val)) return null;
  const s = String(val).trim().toLowerCase();

  // Simple email regex pattern
  const match = s.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
  if (match) return match[0];

  return null;
}

// Normalize pipeline status to client's 14 stages (Default: Pending)
function normalizeStatus(val) {
  if (isNil(val)) return 'Pending';
  const s = String(val).trim().toLowerCase();
  if (s.includes('blank') || s.includes('uncategorized')) return 'Blank Lead';
  if (s.includes('pend') || s === 'new' || s === 'new lead') return 'Pending';
  if (s.includes('hot')) return 'Hot Lead';
  if (s.includes('warm')) return 'Warm Lead';
  if (s.includes('cold')) return 'Cold Lead';
  if (s.includes('not interest') || s.includes('not-interest') || s.includes('not_interest') || s.includes('uninterested') || s.includes('disinterested') || s.includes('not keen') || s.includes('no interest')) return 'Not Interested';
  if (s.includes('interest') && !s.includes('not')) return 'Interested';
  if (s.includes('design') || s.includes('cad') || s.includes('plan')) return 'Design Related';
  if (s.includes('detail') || s.includes('share') || s.includes('sent')) return 'Details Shared';
  if (s.includes('50') || s.includes('half')) return '50/50';
  if (s.includes('not pick') || s.includes('unanswered') || s.includes('missed')) return 'Not Picked';
  if (s.includes('non') || s.includes('relevent') || s.includes('relevant') || s.includes('spam') || s.includes('invalid')) return 'Non Relevant';
  if (s.includes('far') || s.includes('distance') || s.includes('other city')) return 'Too Far';
  if (s.includes('early') || s.includes('before')) return 'Too Early';
  if (s.includes('late') || s.includes('done') || s.includes('finished')) return 'Too Late';
  return 'Pending';
}

// Normalize lead priority
function normalizePriority(val) {
  if (isNil(val)) return 'medium';
  const s = String(val).trim().toLowerCase();
  if (s.includes('urgent') || s.includes('critical') || s.includes('immediate') || s.includes('p1')) return 'high';
  if (s.includes('high') || s.includes('hot') || s.includes('warm')) return 'high';
  if (s.includes('low') || s.includes('cold')) return 'low';
  return 'medium';
}

// Clean budget text
function cleanBudget(val) {
  if (isNil(val)) return null;
  if (typeof val === 'number') {
    return val.toLocaleString('en-IN');
  }
  let s = String(val).trim();
  s = s.replace(/^(inr|rs\.?|₹|\$)\s*/i, '').trim();
  return s || null;
}

/**
 * Main parser: takes a file buffer, parses sheets or CSV, identifies headers,
 * extracts ONLY important CRM lead fields, and cleanses data.
 */
function parseLeadSpreadsheet(fileBuffer, originalFilename = '') {
  let workbook;

  // 1. Try reading with SheetJS
  try {
    workbook = XLSX.read(fileBuffer, {
      type: 'buffer',
      cellDates: true,
      raw: true
    });
  } catch (err) {
    // If XLSX.read failed, try text CSV decoding
    try {
      const text = fileBuffer.toString('utf-8').replace(/^\uFEFF/, '');
      workbook = XLSX.read(text, { type: 'string', cellDates: true, raw: true });
    } catch (fallbackErr) {
      throw new Error(`Unable to parse spreadsheet file: ${err.message}`);
    }
  }

  if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('Spreadsheet has no readable sheets.');
  }

  // Find the first sheet that contains data
  let targetSheet = null;
  let rawRows = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: '',
      blankrows: false,
      raw: true
    });
    if (rows && rows.length > 0) {
      targetSheet = sheet;
      rawRows = rows;
      break;
    }
  }

  if (!rawRows || rawRows.length === 0) {
    return { leads: [], errors: ['No data rows found in spreadsheet.'] };
  }

  // 2. Identify the Header Row
  let headerRowIdx = -1;
  let colMapping = {}; // colIndex -> targetField

  // Scan the first 15 rows to find the best header match
  const maxScan = Math.min(rawRows.length, 15);
  let bestMatchScore = 0;
  let bestHeaderRowIdx = -1;
  let bestColMapping = {};

  for (let r = 0; r < maxScan; r++) {
    const row = rawRows[r];
    if (!Array.isArray(row)) continue;

    let score = 0;
    const currentMapping = {};

    for (let c = 0; c < row.length; c++) {
      const cell = row[c];
      if (cell === null || cell === undefined) continue;
      const matched = matchFieldHeader(cell);
      if (matched) {
        score++;
        if (matched === 'name') {
          const normCell = normalizeKey(cell);
          const isHighPriorityName = normCell.includes('full') || normCell.includes('client') || normCell.includes('customer');
          if (currentMapping['name'] === undefined || isHighPriorityName) {
            currentMapping['name'] = c;
          }
        } else if (matched === 'meta_ad_name') {
          const normCell = normalizeKey(cell);
          const isHighPriorityAd = normCell === 'adname';
          if (currentMapping['meta_ad_name'] === undefined || isHighPriorityAd) {
            currentMapping['meta_ad_name'] = c;
          }
        } else if (matched === 'meta_campaign_name') {
          const normCell = normalizeKey(cell);
          const isHighPriorityCamp = normCell === 'campaignname';
          if (currentMapping['meta_campaign_name'] === undefined || isHighPriorityCamp) {
            currentMapping['meta_campaign_name'] = c;
          }
        } else if (currentMapping[matched] === undefined) {
          currentMapping[matched] = c;
        }
      }
    }

    if (score > bestMatchScore) {
      bestMatchScore = score;
      bestHeaderRowIdx = r;
      bestColMapping = currentMapping;
    }
  }

  let dataStartIdx = 0;

  // If we found a row matching at least 2 fields (or 1 if table is tiny)
  if (bestMatchScore >= 2 || (bestMatchScore >= 1 && rawRows[0] && rawRows[0].length <= 3)) {
    headerRowIdx = bestHeaderRowIdx;
    colMapping = bestColMapping;
    dataStartIdx = headerRowIdx + 1;
  } else {
    // No explicit header matched. Inspect column values across data to auto-assign columns!
    colMapping = autoDetectColumnsByValues(rawRows);
    dataStartIdx = 0;
  }

  // 3. Process each data row and extract ONLY the important fields
  const leads = [];
  const errors = [];

  for (let r = dataStartIdx; r < rawRows.length; r++) {
    const row = rawRows[r];
    if (!row || !Array.isArray(row)) continue;

    // Check if the entire row is blank
    const isRowEmpty = row.every(c => isNil(c));
    if (isRowEmpty) continue;

    // Helper to get raw cell by mapped column
    const getVal = (field) => {
      const colIdx = colMapping[field];
      if (colIdx !== undefined && colIdx !== null && row[colIdx] !== undefined) {
        const val = row[colIdx];
        return isNil(val) ? null : val;
      }
      return null;
    };

    let rawName = getVal('name');
    let rawFirst = getVal('firstName');
    let rawLast = getVal('lastName');
    let rawPhone = getVal('phone');
    let rawEmail = getVal('email');
    let rawRequirement = getVal('requirement');
    let rawCity = getVal('city');
    let rawState = getVal('state');
    let rawBudget = getVal('budget');
    let rawSource = getVal('source');
    let rawStatus = getVal('status');
    let rawPriority = getVal('priority');
    let rawNotes = getVal('notes');
    let rawFollowUp = getVal('follow_up_date');
    let rawAssigned = getVal('assigned_to');
    let rawPlatform = getVal('meta_platform');
    let rawFloorPlan = getVal('floor_plan_status');
    let rawPlotSize = getVal('plot_size');
    let rawAdName = getVal('meta_ad_name');
    let rawCampaignName = getVal('meta_campaign_name');

    // ─── Data Cleansing & Cross-Field Recovery ───

    // Handle First Name + Last Name
    if (!rawName && (rawFirst || rawLast)) {
      rawName = [rawFirst, rawLast].filter(Boolean).map(s => String(s).trim()).join(' ');
    }

    // Phone & Email cross-check (handles swapped phone/email columns)
    let cleanedPhone = cleanPhoneNumber(rawPhone);
    let cleanedEmail = cleanEmail(rawEmail);

    // If both failed or are swapped, detect cross-assignment
    if (!cleanedPhone && !cleanedEmail) {
      if (rawPhone && String(rawPhone).includes('@') && cleanPhoneNumber(rawEmail)) {
        cleanedEmail = cleanEmail(rawPhone);
        cleanedPhone = cleanPhoneNumber(rawEmail);
      } else if (rawEmail && String(rawEmail).includes('@') && cleanPhoneNumber(rawPhone)) {
        cleanedEmail = cleanEmail(rawEmail);
        cleanedPhone = cleanPhoneNumber(rawPhone);
      }
    }
    // Individual cross-recovery if only one was missing
    if (!cleanedEmail && rawPhone && String(rawPhone).includes('@')) {
      cleanedEmail = cleanEmail(rawPhone);
    }
    if (!cleanedPhone && rawEmail && cleanPhoneNumber(rawEmail)) {
      cleanedPhone = cleanPhoneNumber(rawEmail);
    }

    // Check if name is mistakenly an email or phone or ad name
    let cleanedName = rawName ? String(rawName).trim() : null;
    if (cleanedName) {
      if (cleanedName.includes('@') && !cleanedEmail) {
        cleanedEmail = cleanEmail(cleanedName);
        cleanedName = null;
      } else if (/^\+?[0-9\s\-()]{10,15}$/.test(cleanedName) && !cleanedPhone) {
        cleanedPhone = cleanPhoneNumber(cleanedName);
        cleanedName = null;
      } else if (isInvalidClientName(cleanedName)) {
        cleanedName = null;
      }
    }

    // Content Fallback: If phone, email, name, or city are missing for this row, inspect remaining unmapped cells
    if (!cleanedPhone || !cleanedEmail || !cleanedName || !rawCity) {
      for (let c = 0; c < row.length; c++) {
        if (c === colMapping.phone || c === colMapping.email || c === colMapping.name || c === colMapping.city) continue;
        const cell = row[c];
        if (isNil(cell)) continue;
        const strVal = String(cell).trim();

        if (!cleanedEmail && cleanEmail(strVal)) {
          cleanedEmail = cleanEmail(strVal);
        } else if (!cleanedPhone && cleanPhoneNumber(strVal)) {
          cleanedPhone = cleanPhoneNumber(strVal);
        } else if (!cleanedName && !isInvalidClientName(strVal) && strVal.length >= 2 && strVal.length <= 60 && !strVal.includes('\n')) {
          cleanedName = strVal;
        } else if (!rawCity && strVal.length >= 2 && strVal.length <= 40 && /^[a-zA-Z\s.-]+$/.test(strVal) && !isInvalidClientName(strVal)) {
          rawCity = strVal;
        }
      }
    }

    // Filter out summary / footer rows (e.g. "Total Leads: 100", "Summary", "Report generated...")
    const JUNK_NAME_REGEX = /^(total|count|summary|grand total|sub total|subtotal|page \d|note:|disclaimer|confidential|report|sl no|s\.no|index|sr no|test lead|junk|na|none|undefined|null)/i;
    if (!cleanedPhone && !cleanedEmail && cleanedName && JUNK_NAME_REGEX.test(cleanedName)) {
      continue;
    }

    // If name is still empty, derive a sensible name
    if (!cleanedName) {
      if (cleanedPhone) {
        cleanedName = `Lead (${cleanedPhone})`;
      } else if (cleanedEmail) {
        const localPart = cleanedEmail.split('@')[0].replace(/[._-]/g, ' ');
        cleanedName = localPart.charAt(0).toUpperCase() + localPart.slice(1);
      }
    }

    // Must have at least one valid identifying field (Name, Phone, or Email)
    if (!cleanedName && !cleanedPhone && !cleanedEmail) {
      // Row contains only junk / non-identifiable data, skip
      continue;
    }

    // Clean dates
    const cleanedFollowUp = parseDateValue(rawFollowUp);

    // Clean requirement & notes
    const cleanedRequirement = rawRequirement ? String(rawRequirement).trim() : null;
    const cleanedNotes = rawNotes ? String(rawNotes).trim() : null;
    const cleanedCity = rawCity ? String(rawCity).trim() : null;
    const cleanedState = rawState ? String(rawState).trim() : null;
    const cleanedBudget = cleanBudget(rawBudget);
    const cleanedAssigned = rawAssigned ? String(rawAssigned).trim() : null;

    const isSheet = Boolean((rawSource && String(rawSource).toLowerCase().includes('sheet')) || (rawSource && String(rawSource).toLowerCase().includes('google')));
    const isMeta = Boolean(rawFloorPlan || rawPlotSize || rawPlatform || rawAdName || rawCampaignName || (rawSource && String(rawSource).toLowerCase().includes('meta')));
    const category = isSheet ? 'google_sheets' : (isMeta ? 'meta' : 'google_sheets');
    const platform = rawPlatform ? String(rawPlatform).toLowerCase().trim() : (isMeta ? 'ig' : (isSheet ? 'Google Sheets' : null));
    const cleanedSource = rawSource
      ? String(rawSource).trim()
      : (isSheet ? 'Google Sheet Live Sync' : (isMeta ? `Meta Ads (${(platform || 'IG').toUpperCase()})` : 'Google Sheet Import'));

    // Construct lead object
    const sanitizedLead = {
      name: cleanedName || (isMeta ? 'New Meta Lead' : (isSheet ? 'Google Sheet Lead' : 'Valued Client')),
      email: cleanedEmail || null,
      phone: cleanedPhone || null,
      source: cleanedSource,
      city: cleanedCity || null,
      state: cleanedState || null,
      budget: cleanedBudget || null,
      requirement: cleanedRequirement || null,
      status: normalizeStatus(rawStatus || 'Pending'),
      priority: normalizePriority(rawPriority),
      notes: cleanedNotes || null,
      follow_up_date: cleanedFollowUp || null,
      assigned_to: cleanedAssigned || null,
      lead_category: category,
      meta_platform: platform,
      floor_plan_status: rawFloorPlan ? String(rawFloorPlan).trim() : null,
      plot_size: rawPlotSize ? String(rawPlotSize).trim() : null,
      meta_ad_name: rawAdName ? String(rawAdName).trim() : null,
      meta_campaign_name: rawCampaignName ? String(rawCampaignName).trim() : null,
      created_at: new Date().toISOString()
    };

    leads.push(sanitizedLead);
  }

  return { leads, errors };
}

/**
 * Fallback: when no column headers exist, inspect cell values to identify
 * which column is Phone, which is Email, which is Name, which is Date, etc.
 */
function autoDetectColumnsByValues(rows) {
  const mapping = {};
  if (!rows || rows.length === 0) return mapping;

  const sampleLimit = Math.min(rows.length, 30);
  const maxCols = Math.max(...rows.slice(0, sampleLimit).map(r => (Array.isArray(r) ? r.length : 0)));
  const minThreshold = rows.length <= 2 ? 1 : 2;

  for (let c = 0; c < maxCols; c++) {
    let emailMatches = 0;
    let phoneMatches = 0;
    let dateMatches = 0;
    let textCount = 0;

    for (let r = 0; r < sampleLimit; r++) {
      const val = rows[r] ? rows[r][c] : null;
      if (isNil(val)) continue;

      if (cleanEmail(val)) emailMatches++;
      if (cleanPhoneNumber(val)) phoneMatches++;
      if (parseDateValue(val)) dateMatches++;
      if (typeof val === 'string' && val.trim().length > 1 && !isInvalidClientName(val)) textCount++;
    }

    if (emailMatches >= minThreshold && mapping.email === undefined) {
      mapping.email = c;
    } else if (phoneMatches >= minThreshold && mapping.phone === undefined) {
      mapping.phone = c;
    } else if (dateMatches >= minThreshold && mapping.follow_up_date === undefined) {
      mapping.follow_up_date = c;
    } else if (textCount >= minThreshold && mapping.name === undefined) {
      mapping.name = c;
    }
  }

  return mapping;
}

/**
 * Normalizes a raw lead object (e.g. from JSON body upload)
 * ensuring ONLY important fields are preserved and properly formatted.
 */
function sanitizeLeadObject(raw) {
  if (!raw || typeof raw !== 'object') return null;

  // Flatten / case-insensitive lookup
  const normalizedKeys = {};
  for (const [k, v] of Object.entries(raw)) {
    const matched = matchFieldHeader(k);
    if (matched && !normalizedKeys[matched]) {
      normalizedKeys[matched] = v;
    }
  }

  let name = normalizedKeys.name || raw.full_name || raw.fullname || raw.client_name || raw.customer_name || raw.name || raw.client;
  let first = normalizedKeys.firstName || raw.first_name;
  let last = normalizedKeys.lastName || raw.last_name;
  let phone = normalizedKeys.phone || raw.phone_number || raw.phone || raw.mobile || raw.contact;
  let email = normalizedKeys.email || raw.email || raw.email_address;
  let requirement = normalizedKeys.requirement || raw.requirement || raw.requirements || raw.service;
  let city = normalizedKeys.city || raw.city || raw.location;
  let state = normalizedKeys.state || raw.state;
  let budget = normalizedKeys.budget || raw.budget;
  let source = normalizedKeys.source || raw.source;
  let status = normalizedKeys.status || raw.status;
  let priority = normalizedKeys.priority || raw.priority;
  let notes = normalizedKeys.notes || raw.notes || raw.remarks;
  let follow_up_date = normalizedKeys.follow_up_date || raw.follow_up_date || raw.followup;
  let assigned_to = normalizedKeys.assigned_to || raw.assigned_to || raw.assigned;

  if (!name && (first || last)) {
    name = [first, last].filter(Boolean).map(s => String(s).trim()).join(' ');
  }

  let cleanedPhone = cleanPhoneNumber(phone);
  let cleanedEmail = cleanEmail(email);

  if (!cleanedPhone && !cleanedEmail) {
    if (phone && String(phone).includes('@') && cleanPhoneNumber(email)) {
      cleanedEmail = cleanEmail(phone);
      cleanedPhone = cleanPhoneNumber(email);
    } else if (email && String(email).includes('@') && cleanPhoneNumber(phone)) {
      cleanedEmail = cleanEmail(email);
      cleanedPhone = cleanPhoneNumber(phone);
    }
  }
  if (!cleanedEmail && phone && String(phone).includes('@')) {
    cleanedEmail = cleanEmail(phone);
  }
  if (!cleanedPhone && email && cleanPhoneNumber(email)) {
    cleanedPhone = cleanPhoneNumber(email);
  }

  let cleanedName = name ? String(name).trim() : null;
  if (cleanedName) {
    if (cleanedName.includes('@') && !cleanedEmail) {
      cleanedEmail = cleanEmail(cleanedName);
      cleanedName = null;
    } else if (/^\+?[0-9\s\-()]{10,15}$/.test(cleanedName) && !cleanedPhone) {
      cleanedPhone = cleanPhoneNumber(cleanedName);
      cleanedName = null;
    } else if (isInvalidClientName(cleanedName)) {
      cleanedName = null;
    }
  }

  // Fallback: search raw object values if missing
  if (!cleanedPhone || !cleanedEmail || !cleanedName) {
    for (const [k, v] of Object.entries(raw)) {
      if (!v) continue;
      const strVal = String(v).trim();
      const kNorm = normalizeKey(k);
      if (NON_CLIENT_NAMES.includes(kNorm)) continue;

      if (!cleanedEmail && cleanEmail(strVal)) {
        cleanedEmail = cleanEmail(strVal);
      } else if (!cleanedPhone && cleanPhoneNumber(strVal)) {
        cleanedPhone = cleanPhoneNumber(strVal);
      } else if (!cleanedName && !isInvalidClientName(strVal) && strVal.length >= 2 && strVal.length <= 60 && !strVal.includes('\n')) {
        cleanedName = strVal;
      }
    }
  }

  const JUNK_NAME_REGEX = /^(total|count|summary|grand total|sub total|subtotal|page \d|note:|disclaimer|confidential|report|sl no|s\.no|index|sr no|test lead|junk|na|none|undefined|null)/i;
  if (!cleanedPhone && !cleanedEmail && cleanedName && JUNK_NAME_REGEX.test(cleanedName)) {
    return null;
  }

  if (!cleanedName && !cleanedPhone && !cleanedEmail) {
    return null; // Invalid row
  }

  let meta_platform = normalizedKeys.meta_platform || raw.platform || raw.meta_platform;
  let floor_plan_status = normalizedKeys.floor_plan_status || raw['what_is_your_floor_plan_status_?'] || raw.floor_plan_status;
  let plot_size = normalizedKeys.plot_size || raw['what_is_your_plot_size_?'] || raw.plot_size;
  let meta_ad_name = normalizedKeys.meta_ad_name || raw.ad_name || raw.ad_id;
  let meta_campaign_name = normalizedKeys.meta_campaign_name || raw.campaign_name || raw.campaign_id;
  let studio_location = normalizedKeys.studio_location || raw.studio_location || raw.studio;
  let package_service = normalizedKeys.package_service || raw.package_service || raw.lead_type || raw['Lead Type'] || raw.service;
  let payment_status = normalizedKeys.payment_status || raw.payment_status || raw['Payment Status'];
  let token_paid = normalizedKeys.token_paid || raw.token_paid || raw['Token Amount Paid (₹)'];
  let balance_pending = normalizedKeys.balance_pending || raw.balance_pending || raw['Balance Pending (₹)'];
  let razorpay_id = normalizedKeys.razorpay_id || raw.razorpay_id || raw['Razorpay Payment ID'];

  const isSheet = Boolean((source && String(source).toLowerCase().includes('sheet')) || (source && String(source).toLowerCase().includes('google')));
  const isMeta = Boolean(floor_plan_status || plot_size || (meta_platform && (String(meta_platform).toLowerCase() === 'fb' || String(meta_platform).toLowerCase() === 'ig')) || (source && String(source).toLowerCase().includes('meta')));
  const category = isSheet ? 'google_sheets' : (isMeta ? 'meta' : 'google_sheets');

  if (!cleanedName) {
    if (cleanedPhone) cleanedName = `Lead (${cleanedPhone})`;
    else if (cleanedEmail) cleanedName = `Lead (${cleanedEmail.split('@')[0]})`;
    else cleanedName = isMeta ? 'New Meta Lead' : (isSheet ? 'Google Sheet Lead' : 'Valued Client');
  }

  let created_at = new Date().toISOString();
  const rawCreated = raw.created_at || raw.created_time || raw.createdTime;
  if (rawCreated) {
    const parsed = new Date(rawCreated);
    if (!isNaN(parsed.getTime())) created_at = parsed.toISOString();
  }

  return {
    name: cleanedName,
    email: cleanedEmail || null,
    phone: cleanedPhone || null,
    source: isNil(source) ? (isSheet ? 'Google Sheet Live Sync' : (isMeta ? 'Meta Ads' : 'Google Sheet Export')) : String(source).trim(),
    city: isNil(city) ? null : String(city).trim(),
    state: isNil(state) ? null : String(state).trim(),
    budget: cleanBudget(budget),
    requirement: isNil(requirement) ? null : String(requirement).trim(),
    status: normalizeStatus(status || 'Pending'),
    priority: normalizePriority(priority),
    notes: isNil(notes) ? null : String(notes).trim(),
    follow_up_date: parseDateValue(follow_up_date),
    assigned_to: isNil(assigned_to) ? null : String(assigned_to).trim(),
    lead_category: category,
    meta_platform: isNil(meta_platform) ? (isMeta ? 'ig' : null) : String(meta_platform).toLowerCase().trim(),
    floor_plan_status: isNil(floor_plan_status) ? null : String(floor_plan_status).trim(),
    plot_size: isNil(plot_size) ? null : String(plot_size).trim(),
    meta_ad_name: isNil(meta_ad_name) ? null : String(meta_ad_name).trim(),
    meta_campaign_name: isNil(meta_campaign_name) ? null : String(meta_campaign_name).trim(),
    studio_location: isNil(studio_location) ? null : String(studio_location).trim(),
    package_service: isNil(package_service) ? null : String(package_service).trim(),
    payment_status: isNil(payment_status) ? null : String(payment_status).trim(),
    token_paid: token_paid ? parseFloat(token_paid) || 0 : 0,
    balance_pending: balance_pending ? parseFloat(balance_pending) || 0 : 0,
    razorpay_id: isNil(razorpay_id) ? null : String(razorpay_id).trim(),
    created_at
  };
}

module.exports = {
  parseLeadSpreadsheet,
  sanitizeLeadObject,
  matchFieldHeader,
  cleanPhoneNumber,
  cleanEmail,
  parseDateValue,
  normalizeStatus,
  normalizePriority,
  isInvalidClientName,
  NON_CLIENT_NAMES
};
