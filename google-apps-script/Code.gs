/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Walk The Plan CRM — Meta Ads & Google Sheets Live Real-Time Ingestion Script
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * SETUP INSTRUCTIONS:
 * 1. In your Google Sheet, open: Extensions > Apps Script.
 * 2. Delete any existing code and paste this entire script.
 * 3. Click the Save icon (Ctrl + S).
 * 4. In the left sidebar, click "Triggers" (clock icon) > "Add Trigger":
 *    - Choose function to run: onChangeTrigger
 *    - Choose which deployment should run: Head
 *    - Select event source: From spreadsheet
 *    - Select event type: On change
 *    - Failure notification: Daily or Immediate
 *    - Click Save (and grant permissions if prompted).
 * 5. (Optional) Run "testSyncLatestRow" from the dropdown to test with existing data.
 */

var WEBHOOK_URL = "https://walktheplan.in/api/crm/leads/meta-webhook";

// Non-client words to exclude from being treated as human client names
var NON_CLIENT_TERMS = [
  "ad a", "ad b", "ad c", "ad 1", "ad 2", "ad name", "ad_name", "ad set",
  "meta ad", "meta ad campaign", "campaign", "campaign name",
  "walk the plan", "walk the plan 1:1", "google sheet live sync",
  "meta customer", "new meta lead", "sheet lead", "rokon", "test", "demo"
];

/**
 * Main On Change Trigger
 * Fires whenever a new row is appended or inserted into the sheet.
 */
function onChangeTrigger(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    Logger.log("No data rows found in sheet (only header or empty).");
    return;
  }

  var props = PropertiesService.getScriptProperties();
  var lastSyncedStr = props.getProperty("LAST_SYNCED_ROW");
  var lastSyncedRow = lastSyncedStr ? parseInt(lastSyncedStr, 10) : 1;

  // Deduplication check: if no new rows have been appended, exit immediately
  if (lastRow <= lastSyncedRow) {
    Logger.log("Deduplication: Current row (" + lastRow + ") <= last synced row (" + lastSyncedRow + "). Exiting.");
    return;
  }

  // Sync all newly appended rows between (lastSyncedRow + 1) and lastRow
  Logger.log("New rows detected: syncing from row " + (lastSyncedRow + 1) + " to " + lastRow);
  for (var r = lastSyncedRow + 1; r <= lastRow; r++) {
    syncRowToCRM(sheet, r);
  }

  // Update last synced row in script storage
  props.setProperty("LAST_SYNCED_ROW", String(lastRow));
  Logger.log("Updated LAST_SYNCED_ROW to: " + lastRow);
}

/**
 * Extracts lead data from a given sheet row and sends to CRM Webhook
 */
function syncRowToCRM(sheet, rowIdx) {
  var lastCol = sheet.getLastColumn();
  if (lastCol < 1) return;

  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var values = sheet.getRange(rowIdx, 1, 1, lastCol).getValues()[0];

  // Check if row is completely empty
  var hasContent = values.some(function(v) { return v !== null && v !== "" && String(v).trim().length > 0; });
  if (!hasContent) {
    Logger.log("Row " + rowIdx + " is empty. Skipping.");
    return;
  }

  // 1. Build Header Map
  var headerMap = {};
  for (var c = 0; c < headers.length; c++) {
    var h = String(headers[c] || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    if (h) {
      headerMap[h] = c;
    }
  }

  // Helper to get cell by matched header keys
  function getByHeader(aliases) {
    for (var i = 0; i < aliases.length; i++) {
      var norm = aliases[i].toLowerCase().replace(/[^a-z0-9]/g, "");
      if (headerMap[norm] !== undefined) {
        var v = values[headerMap[norm]];
        if (v !== null && v !== undefined && String(v).trim() !== "") {
          return String(v).trim();
        }
      }
    }
    return null;
  }

  // Standard Meta Lead Headers Extraction
  var rawName = getByHeader(["fullname", "full_name", "clientname", "customername", "name"]);
  var rawPhone = getByHeader(["phonenumber", "phone_number", "phone", "phoneno", "mobile", "mobilenumber", "contact", "contactnumber"]);
  var rawEmail = getByHeader(["email", "emailaddress", "email_address", "mail"]);
  var rawCity = getByHeader(["city", "location", "town", "district"]);
  var rawFloorPlan = getByHeader(["whatisyourfloorplanstatus", "whatisyourfloorplanstatus?", "floorplanstatus", "floor_plan_status"]);
  var rawPlotSize = getByHeader(["whatisyourplotsize", "whatisyourplotsize?", "plotsize", "plot_size"]);
  var rawAdName = getByHeader(["adname", "ad_name", "adid"]);
  var rawCampaign = getByHeader(["campaignname", "campaign_name", "campaignid"]);
  var rawPlatform = getByHeader(["platform", "metaplatform"]);
  var rawCreatedAt = getByHeader(["createdtime", "created_time", "createdat", "timestamp", "date"]);

  // 2. Content Fallback (for manual entries or mismatched headers in random columns)
  if (!rawEmail || !rawPhone || !rawName) {
    for (var i = 0; i < values.length; i++) {
      var cellVal = values[i];
      if (cellVal === null || cellVal === undefined) continue;
      var str = String(cellVal).trim();
      if (!str) continue;

      // Detect Email
      if (!rawEmail && str.indexOf("@") !== -1 && /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(str)) {
        rawEmail = str;
        continue;
      }

      // Detect Phone (10+ digits, optionally starting with + or 91)
      var digitsOnly = str.replace(/\D/g, "");
      if (!rawPhone && digitsOnly.length >= 10 && digitsOnly.length <= 15 && str.indexOf("@") === -1) {
        rawPhone = str;
        continue;
      }

      // Detect Human Client Name
      if (!rawName && isValidHumanName(str)) {
        rawName = str;
        continue;
      }

      // Detect City fallback
      if (!rawCity && isLikelyCity(str)) {
        rawCity = str;
        continue;
      }
    }
  }

  // Check if rawName is an invalid ad name or placeholder
  if (!isValidHumanName(rawName)) {
    rawName = null;
    // Attempt second scan for name among non-ad cells
    for (var j = 0; j < values.length; j++) {
      var vStr = String(values[j] || "").trim();
      if (isValidHumanName(vStr)) {
        rawName = vStr;
        break;
      }
    }
  }

  var finalName = rawName || (rawPhone ? "Lead (" + rawPhone + ")" : (rawEmail ? "Lead (" + rawEmail.split("@")[0] + ")" : "Meta Customer"));
  var finalPlatform = (rawPlatform && rawPlatform.toLowerCase().indexOf("fb") !== -1) ? "fb" : "ig";

  // Build Payload
  var payload = {
    full_name: finalName,
    phone_number: rawPhone || null,
    email: rawEmail || null,
    city: rawCity || null,
    platform: finalPlatform,
    "what_is_your_floor_plan_status_?": rawFloorPlan || null,
    "what_is_your_plot_size_?": rawPlotSize || null,
    ad_name: rawAdName || "Meta Ad Campaign",
    campaign_name: rawCampaign || "Walk The Plan 1:1",
    status: "Pending",
    created_at: rawCreatedAt ? new Date(rawCreatedAt).toISOString() : new Date().toISOString()
  };

  Logger.log("Sending payload for Row " + rowIdx + ": " + JSON.stringify(payload));

  var options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    var response = UrlFetchApp.fetch(WEBHOOK_URL, options);
    var code = response.getResponseCode();
    var text = response.getContentText();
    Logger.log("Row " + rowIdx + " Webhook Response: " + code + " " + text);
  } catch (err) {
    Logger.log("Error syncing row " + rowIdx + ": " + err.message);
  }
}

/**
 * Validates whether a string is a genuine client name (and not an ad name, ID, or keyword)
 */
function isValidHumanName(str) {
  if (!str) return false;
  var s = String(str).trim().toLowerCase();
  if (s.length < 2 || s.length > 50) return false;
  if (s.indexOf("@") !== -1 || s.indexOf("http") !== -1) return false;
  if (/^\+?[\d\s\-()]+$/.test(s)) return false; // purely numbers

  for (var i = 0; i < NON_CLIENT_TERMS.length; i++) {
    if (s === NON_CLIENT_TERMS[i]) return false;
  }

  // Patterns like "AD A", "ad_123", "campaign_1", "form_rokon", "id:123"
  if (/^(ad|adset|campaign|form|page|id|l:|leadgen)[\s_-]*([a-z0-9]+)?$/i.test(s)) return false;
  if (/^(pending|ready|residential|commercial|instagram|facebook|meta)$/i.test(s)) return false;

  return true;
}

/**
 * Checks if a string could be a city name
 */
function isLikelyCity(str) {
  if (!str) return false;
  var s = String(str).trim();
  if (s.length < 3 || s.length > 30) return false;
  if (!/^[a-zA-Z\s.-]+$/.test(s)) return false;
  var sLow = s.toLowerCase();
  if (isValidHumanName(s) && !/^(gurgaon|gurugram|delhi|noida|faridabad|mumbai|bangalore|bengaluru|hyderabad|pune|kolkata|chennai|ahmedabad|jaipur|lucknow|chandigarh|dehradun|varanasi)/i.test(sLow)) {
    return false; // prefer treating unknown strings as name first
  }
  return true;
}

/**
 * Utility: Test sync for the latest row currently in the sheet
 */
function testSyncLatestRow() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    SpreadsheetApp.getUi().alert("No data rows found to test. Please add a row first.");
    return;
  }
  syncRowToCRM(sheet, lastRow);
  SpreadsheetApp.getUi().alert("Synced Row " + lastRow + " to Walk The Plan CRM! Check your CRM dashboard.");
}

/**
 * Utility: Reset last synced row tracker (forces re-syncing from current row onwards)
 */
function resetSyncRow() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var lastRow = sheet.getLastRow();
  PropertiesService.getScriptProperties().setProperty("LAST_SYNCED_ROW", String(lastRow));
  Logger.log("Reset LAST_SYNCED_ROW to current last row: " + lastRow);
  SpreadsheetApp.getUi().alert("Sync tracker reset to row " + lastRow + ". Future new rows will sync automatically.");
}
