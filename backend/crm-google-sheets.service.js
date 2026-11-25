// ═══════════════════════════════════════════════════════════════════════════════
// Walk The Plan — CRM Google Sheets Direct Integration Service (v2.0)
// Features: Smart Header Auto-Detection (skips summary/KPI banners), 
// Universal Live Ingestion, Intelligent Column Mapping, Deduplication
// ═══════════════════════════════════════════════════════════════════════════════

const { cleanPhoneNumber, cleanEmail, isInvalidClientName, normalizeStatus } = require('./crm-lead.parser');

/**
 * Extracts standard Google Spreadsheet ID from a URL or raw ID string
 */
function extractSpreadsheetId(input) {
  if (!input) return null;
  const s = String(input).trim();
  const urlMatch = s.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (urlMatch && urlMatch[1]) return urlMatch[1];
  if (/^[a-zA-Z0-9-_]{20,70}$/.test(s)) return s;
  return null;
}

/**
 * Parses CSV text into a 2D matrix of strings
 */
function parseCsvToMatrix(csvText) {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length === 0) return [];

  function parseCsvLine(line) {
    const result = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(cur.trim());
        cur = '';
      } else {
        cur += char;
      }
    }
    result.push(cur.trim());
    return result;
  }

  return lines.map(line => parseCsvLine(line));
}

/**
 * Parses GViz JSON text into a 2D matrix of cell strings
 */
function parseGvizToMatrix(rawText) {
  const jsonStart = rawText.indexOf('{');
  const jsonEnd = rawText.lastIndexOf('}');
  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error('Invalid GViz response format from Google Sheets');
  }
  const jsonStr = rawText.substring(jsonStart, jsonEnd + 1);
  const data = JSON.parse(jsonStr);

  if (data.status === 'error') {
    const errReason = data.errors && data.errors[0] ? data.errors[0].detailed_message || data.errors[0].message : 'Sheet access error';
    throw new Error(`Google Sheet returned error: ${errReason}. Ensure sheet sharing is set to "Anyone with the link can view".`);
  }

  const table = data.table || {};
  const matrix = [];

  // If cols have non-empty labels, add them as Row 0
  const cols = table.cols || [];
  const colLabels = cols.map((col, idx) => {
    return (col.label && col.label.trim()) ? col.label.trim() : (col.id ? String(col.id).trim() : `Column_${idx + 1}`);
  });
  if (colLabels.some(l => !l.startsWith('Column_') && l.length > 1)) {
    matrix.push(colLabels);
  }

  // Add all table rows
  const rows = table.rows || [];
  rows.forEach(r => {
    const cells = r.c || [];
    const rowVals = cells.map(cell => {
      if (cell === null || cell === undefined) return '';
      const val = cell.f !== undefined && cell.f !== null ? cell.f : cell.v;
      return val !== undefined && val !== null ? String(val).trim() : '';
    });
    matrix.push(rowVals);
  });

  return matrix;
}

/**
 * SMART HEADER DETECTOR:
 * Scans the first 15 rows to find the ACTUAL table headers row.
 * Handles sheets that have titles, KPI stats, or summary cards above the table!
 */
const LEAD_KEYWORDS = [
  'fullname', 'clientname', 'customername', 'name', 'phone', 'phonenumber',
  'mobile', 'email', 'contact', 'city', 'plotsize', 'floorplan', 'campaign',
  'adname', 'status', 'leadstatus', 'notes', 'followup'
];

function detectHeaderAndExtractRows(matrix) {
  if (!matrix || matrix.length === 0) return { headers: [], rows: [] };

  let bestScore = 0;
  let bestIdx = 0;

  const maxScan = Math.min(15, matrix.length);
  for (let idx = 0; idx < maxScan; idx++) {
    const row = matrix[idx];
    let score = 0;
    for (const cell of row) {
      const clean = String(cell || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!clean) continue;
      for (const kw of LEAD_KEYWORDS) {
        if (clean.includes(kw) || kw.includes(clean)) {
          score++;
          break;
        }
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestIdx = idx;
    }
  }

  // If at least 2 lead keywords match, use that row. Otherwise fallback to row 0.
  const headerRowIdx = bestScore >= 2 ? bestIdx : 0;
  const rawHeaders = matrix[headerRowIdx] || [];
  const headers = rawHeaders.map((h, i) => String(h || '').trim() || `Column_${i + 1}`);

  const rows = [];
  for (let r = headerRowIdx + 1; r < matrix.length; r++) {
    const rowVals = matrix[r] || [];
    // Skip completely empty rows
    const hasData = rowVals.some(v => v !== null && v !== undefined && String(v).trim().length > 0);
    if (!hasData) continue;

    const rowObj = {};
    headers.forEach((h, colIdx) => {
      const val = rowVals[colIdx];
      rowObj[h] = val !== undefined && val !== null && String(val).trim().length > 0 ? String(val).trim() : null;
    });
    rows.push(rowObj);
  }

  return { headers, rows, headerRowIdx };
}

/**
 * Fetches rows and headers from Google Sheet with automatic format detection
 */
async function fetchSheetData(spreadsheetId, sheetName = '', apiKey = '') {
  if (!spreadsheetId) throw new Error('Spreadsheet ID is required');

  // Method 1: Direct CSV Export endpoint (fastest, preserves all table rows & headers)
  try {
    const sheetParam = sheetName ? `&sheet=${encodeURIComponent(sheetName)}` : '';
    const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv${sheetParam}`;
    const res = await fetch(csvUrl);
    if (res.ok) {
      const csvText = await res.text();
      const matrix = parseCsvToMatrix(csvText);
      const parsed = detectHeaderAndExtractRows(matrix);
      if (parsed.headers && parsed.headers.length > 0) {
        return { headers: parsed.headers, rows: parsed.rows, sourceMethod: 'Google Sheets CSV Live Export' };
      }
    }
  } catch {
    // Fallback to GViz
  }

  // Method 2: GViz endpoint
  try {
    const sheetParam = sheetName ? `&sheet=${encodeURIComponent(sheetName)}` : '';
    const gvizUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json${sheetParam}`;
    const res = await fetch(gvizUrl);
    if (res.ok) {
      const text = await res.text();
      const matrix = parseGvizToMatrix(text);
      const parsed = detectHeaderAndExtractRows(matrix);
      if (parsed.headers && parsed.headers.length > 0) {
        return { headers: parsed.headers, rows: parsed.rows, sourceMethod: 'Google Sheets GViz Live' };
      }
    }
  } catch {
    // Fallback to API
  }

  // Method 3: Google Sheets API v4 (if apiKey is provided)
  if (apiKey) {
    try {
      const range = sheetName ? encodeURIComponent(sheetName) : 'A1:ZZ';
      const apiUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?key=${encodeURIComponent(apiKey)}`;
      const res = await fetch(apiUrl);
      if (res.ok) {
        const data = await res.json();
        const values = data.values || [];
        const parsed = detectHeaderAndExtractRows(values);
        if (parsed.headers && parsed.headers.length > 0) {
          return { headers: parsed.headers, rows: parsed.rows, sourceMethod: 'Google Sheets API v4' };
        }
      }
    } catch {
      // Failed
    }
  }

  throw new Error('Unable to connect to Google Sheet. Ensure sheet sharing is set to "Anyone with the link can view".');
}

/**
 * Intelligent Auto-Detector: Matches Google Sheet headers with CRM Lead fields
 */
function proposeAutoMapping(headers = []) {
  const normMap = {};
  headers.forEach(h => {
    const clean = String(h || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (clean) normMap[clean] = h;
  });

  function findMatch(aliases) {
    // Phase 1: Exact match
    for (const a of aliases) {
      const clean = a.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (normMap[clean]) return normMap[clean];
    }
    // Phase 2: Word / Substring match (avoid false positives like 'ad' in 'address')
    for (const a of aliases) {
      const clean = a.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (clean.length < 3) continue;
      for (const [k, original] of Object.entries(normMap)) {
        if (clean === 'adname' && (k.includes('adname') || k.includes('adid') || k.includes('adset'))) {
          return original;
        }
        if (clean !== 'adname' && clean.length >= 4 && (k.includes(clean) || clean.includes(k))) {
          return original;
        }
      }
    }
    return '';
  }

  return {
    name: findMatch(['fullname', 'clientname', 'customername', 'prospectname', 'name', 'client']),
    phone: findMatch(['phonenumber', 'phone_number', 'phone', 'phoneno', 'mobile', 'mobilenumber', 'contact', 'whatsapp']),
    email: findMatch(['email', 'emailaddress', 'email_address', 'mail', 'emailid']),
    city: findMatch(['city', 'location', 'town', 'district', 'place']),
    floor_plan_status: findMatch(['whatisyourfloorplanstatus', 'whatisyourfloorplanstatus?', 'floorplanstatus', 'floor_plan_status', 'floorplan']),
    plot_size: findMatch(['whatisyourplotsize', 'whatisyourplotsize?', 'plotsize', 'plot_size', 'plotsqyards']),
    ad_name: findMatch(['adname', 'ad_name', 'adid']),
    campaign_name: findMatch(['campaignname', 'campaign_name', 'campaignid', 'campaign']),
    platform: findMatch(['platform', 'metaplatform', 'channel', 'source']),
    status: findMatch(['leadstatus', 'lead_status', 'status', 'stage', 'leadstage']),
    date: findMatch(['followupdate', 'follow_up_date', 'followup', 'createdtime', 'created_time', 'createdat', 'timestamp', 'date']),
    notes: findMatch(['notes', 'remarks', 'comment', 'comments', 'details'])
  };
}

/**
 * Normalizes lead stage strings from Google Sheet (e.g. 'Site Visit Scheduled', 'New', 'Won', 'Lost')
 */
function normalizeSheetStatus(rawStatus) {
  if (!rawStatus) return 'Blank Lead';
  const s = String(rawStatus).trim();
  const lower = s.toLowerCase();
  if (lower === 'hot' || lower === 'hot lead') return 'Hot Lead';
  if (lower === 'warm' || lower === 'warm lead') return 'Warm Lead';
  if (lower === 'cold' || lower === 'cold lead') return 'Cold Lead';
  if (lower.includes('not interest') || lower.includes('lost') || lower.includes('reject')) return 'Cold Lead';
  if (lower.includes('interest')) return 'Warm Lead';
  if (lower === 'pending') return 'Pending';
  if (lower === 'new' || lower === 'live sheet' || lower.includes('blank')) return 'Blank Lead';
  return s || 'Blank Lead';
}

/**
 * Core Live Synchronization Engine:
 * Reads sheet rows, applies mapping, sanitizes, deduplicates, and inserts into crm_leads
 */
async function syncGoogleSheetToCRM(db, config, syncType = 'manual') {
  if (!config || !config.spreadsheet_id) {
    throw new Error('Google Sheet configuration is missing spreadsheet_id.');
  }

  const { spreadsheet_id, sheet_name, api_key } = config;
  let mapping = {};
  try {
    mapping = typeof config.column_mapping === 'string' ? JSON.parse(config.column_mapping || '{}') : (config.column_mapping || {});
  } catch {
    mapping = {};
  }

  const dbGet = (sql, params) => new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
  });

  const dbRun = (sql, params) => new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });

  try {
  // 1. Fetch raw data from Google Sheet using smart header detector
  const { headers, rows, sourceMethod } = await fetchSheetData(spreadsheet_id, sheet_name || '', api_key || '');

  if (!rows || rows.length === 0) {
    return {
      success: true,
      synced_count: 0,
      skipped_count: 0,
      total_rows: 0,
      message: 'Sheet was read successfully, but no client rows were found.'
    };
  }

  // 2. Supplement mapping with smart auto-detector
  const autoMap = proposeAutoMapping(headers);
  const activeMap = { ...autoMap };
  for (const [k, v] of Object.entries(mapping || {})) {
    if (v) activeMap[k] = v;
  }

  let synced_count = 0;
  let skipped_count = 0;
  const newLeadRecords = [];

  // 3. Process every lead row
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    const rawName = activeMap.name && row[activeMap.name] ? String(row[activeMap.name]).trim() : null;
    const rawPhone = activeMap.phone && row[activeMap.phone] ? String(row[activeMap.phone]).trim() : null;
    const rawEmail = activeMap.email && row[activeMap.email] ? String(row[activeMap.email]).trim() : null;
    const rawCity = activeMap.city && row[activeMap.city] ? String(row[activeMap.city]).trim() : null;
    const rawFloorPlan = activeMap.floor_plan_status && row[activeMap.floor_plan_status] ? String(row[activeMap.floor_plan_status]).trim() : null;
    const rawPlotSize = activeMap.plot_size && row[activeMap.plot_size] ? String(row[activeMap.plot_size]).trim() : null;
    const rawAdName = activeMap.ad_name && row[activeMap.ad_name] ? String(row[activeMap.ad_name]).trim() : null;
    const rawCampaign = activeMap.campaign_name && row[activeMap.campaign_name] ? String(row[activeMap.campaign_name]).trim() : null;
    const rawPlatform = activeMap.platform && row[activeMap.platform] ? String(row[activeMap.platform]).trim() : null;
    const rawStatus = activeMap.status && row[activeMap.status] ? String(row[activeMap.status]).trim() : null;
    const rawNotes = activeMap.notes && row[activeMap.notes] ? String(row[activeMap.notes]).trim() : null;
    const rawDate = activeMap.date && row[activeMap.date] ? String(row[activeMap.date]).trim() : null;

    // Normalization & Sanitization
    const cleanedPhone = rawPhone ? cleanPhoneNumber(rawPhone) : null;
    const cleanedEmail = rawEmail ? cleanEmail(rawEmail) : null;

    // Strict validation: Skip ghost row if no name, no phone, AND no email
    if (!rawName && !cleanedPhone && !cleanedEmail) {
      skipped_count++;
      continue;
    }

    let finalName = rawName;
    if (isInvalidClientName(finalName)) {
      finalName = cleanedPhone ? `Lead (${cleanedPhone})` : (cleanedEmail ? `Lead (${cleanedEmail.split('@')[0]})` : null);
    }
    // If still invalid or empty, skip
    if (!finalName && !cleanedPhone && !cleanedEmail) {
      skipped_count++;
      continue;
    }
    if (!finalName) finalName = 'Valued Client';

    let created_at = new Date().toISOString();
    let follow_up_date = null;
    if (rawDate) {
      const parsed = new Date(rawDate);
      if (!isNaN(parsed.getTime())) {
        follow_up_date = parsed.toISOString().split('T')[0];
      } else if (/^\d{4}-\d{2}-\d{2}/.test(rawDate)) {
        follow_up_date = rawDate.split(' ')[0];
      }
    }

    const platform = (rawPlatform && String(rawPlatform).toLowerCase().includes('fb')) ? 'fb' : 'ig';
    const hasMetaFields = Boolean(
      rawFloorPlan ||
      rawPlotSize ||
      rawAdName ||
      rawCampaign ||
      (rawPlatform && /^(fb|facebook|ig|instagram|meta)$/i.test(String(rawPlatform).trim()))
    );
    const source = hasMetaFields
      ? `Meta Ads via Google Sheet (${platform.toUpperCase()})`
      : 'Google Sheet Live Sync';
    const status = normalizeSheetStatus(rawStatus);
    const lead_category = hasMetaFields ? 'meta' : 'google_sheets';

    // 4. Robust De-duplication Check against SQLite crm_leads
    let isDuplicate = false;
    if (cleanedPhone) {
      const phoneDigits = cleanedPhone.replace(/\D/g, '').slice(-10);
      if (phoneDigits.length >= 7) {
        const existing = await dbGet(
          "SELECT id, name FROM crm_leads WHERE REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(phone, '+', ''), ' ', ''), '-', ''), '(', ''), ')', '') LIKE ?",
          [`%${phoneDigits}`]
        );
        if (existing) isDuplicate = true;
      }
    }
    if (!isDuplicate && cleanedEmail) {
      const existing = await dbGet('SELECT id, name FROM crm_leads WHERE LOWER(email) = LOWER(?)', [cleanedEmail]);
      if (existing) isDuplicate = true;
    }

    if (isDuplicate) {
      skipped_count++;
      continue;
    }

    // 5. Insert New Valid Lead into crm_leads
    const insertRes = await dbRun(
      `INSERT INTO crm_leads (
        name, phone, email, city, floor_plan_status, plot_size,
        meta_ad_name, meta_campaign_name, meta_platform, source,
        lead_category, status, pipeline_stage, notes, follow_up_date, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [
        finalName, cleanedPhone, cleanedEmail, rawCity, rawFloorPlan, rawPlotSize,
        rawAdName || 'Meta Ad Campaign', rawCampaign || 'Meta Leads Sheet', platform,
        source, lead_category, status, 'pre_sales', rawNotes, follow_up_date, created_at
      ]
    );

    // Record activity audit trail
    if (insertRes.lastID) {
      await dbRun(
        `INSERT INTO crm_lead_activities (lead_id, action, note, interaction_type, author_name, author_role)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          insertRes.lastID,
          'Lead Auto-Synced',
          `Imported via Google Sheet (${config.sheet_name || 'Active Sheet'}). Status: ${status}`,
          'General Note',
          'Google Sheet Sync Worker',
          'SYSTEM'
        ]
      );
    }

    synced_count++;
    newLeadRecords.push({ id: insertRes.lastID, name: finalName, phone: cleanedPhone, city: rawCity });
  }

  // 6. Update configuration telemetry & logs
  const nowIso = new Date().toISOString();
  await dbRun(
    `UPDATE crm_google_sheets_config
     SET last_sync_at = ?,
         last_sync_status = 'success',
         last_sync_error = NULL,
         total_synced_count = total_synced_count + ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [nowIso, synced_count, config.id]
  );

  await dbRun(
    `INSERT INTO crm_google_sheets_sync_logs (sync_type, synced_count, skipped_count, status, error_message)
     VALUES (?, ?, ?, ?, ?)`,
    [syncType, synced_count, skipped_count, 'success', null]
  );

  return {
    success: true,
    synced_count,
    skipped_count,
    total_rows: rows.length,
    sourceMethod,
    newLeads: newLeadRecords,
    message: `Sync completed successfully: ${synced_count} new leads added, ${skipped_count} skipped/duplicates.`
  };
  } catch (syncErr) {
    try {
      await dbRun(
        `UPDATE crm_google_sheets_config SET last_sync_status = 'error', last_sync_error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [syncErr.message, config.id]
      );
      await dbRun(
        `INSERT INTO crm_google_sheets_sync_logs (sync_type, synced_count, skipped_count, status, error_message) VALUES (?, 0, 0, 'error', ?)`,
        [syncType, syncErr.message]
      );
    } catch (_) {}
    throw syncErr;
  }
}

module.exports = {
  extractSpreadsheetId,
  fetchSheetData,
  proposeAutoMapping,
  syncGoogleSheetToCRM,
  detectHeaderAndExtractRows
};
