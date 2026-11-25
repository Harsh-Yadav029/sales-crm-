import React, { useState, useEffect, useCallback } from 'react';
import {
  FileSpreadsheet, Zap, Link, RefreshCw, SlidersHorizontal, Check, Copy,
  Users, Phone, Mail, MapPin, Layers, Target, Eye, Calendar, Clock, AlertCircle
} from 'lucide-react';
import { P, apiFetch, fmtDate, API, BACKEND_BASE } from '../crmConstants';

export default function GoogleSheetsIntegrationPanel({ addToast }) {
  const [activeSubView, setActiveSubView] = useState('sheets_direct'); // 'sheets_direct' | 'meta_webhook' | 'apps_script'

  // Google Sheets Direct Live Sync State
  const [sheetUrl, setSheetUrl] = useState('');
  const [sheetTab, setSheetTab] = useState('Sheet1');
  const [apiKey, setApiKey] = useState('');
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [config, setConfig] = useState(null);
  const [syncLogs, setSyncLogs] = useState([]);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [savingMapping, setSavingMapping] = useState(false);
  const [headers, setHeaders] = useState([]);
  const [mapping, setMapping] = useState({});
  const [sampleRow, setSampleRow] = useState({});

  // Webhook & Script state
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testingSheet, setTestingSheet] = useState(false);

  const webhookUrl = BACKEND_BASE ? `${BACKEND_BASE}/api/crm/leads/meta-webhook` : `${window.location.protocol}//${window.location.host}/api/crm/leads/meta-webhook`;

  // Fetch active Google Sheets integration config on load
  const loadConfig = useCallback(async () => {
    setLoadingConfig(true);
    try {
      const res = await apiFetch('/google-sheets/config');
      if (res && res.config) {
        setConfig(res.config);
        setSheetUrl(res.config.spreadsheet_id || '');
        setSheetTab(res.config.sheet_name || 'Sheet1');
        setApiKey(res.config.api_key || '');
        let parsedMap = {};
        try {
          parsedMap = typeof res.config.column_mapping === 'string'
            ? JSON.parse(res.config.column_mapping || '{}')
            : (res.config.column_mapping || {});
        } catch { parsedMap = {}; }
        setMapping(parsedMap);
      }
      if (res && res.logs) {
        setSyncLogs(res.logs);
      }
    } catch {
      // Ignored if not configured yet
    } finally {
      setLoadingConfig(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // Connect Google Sheet & Fetch Row 1 Headers
  const handleConnectSheet = async (e) => {
    e?.preventDefault();
    if (!sheetUrl.trim()) {
      addToast('Please enter your Google Spreadsheet URL or ID', 'error');
      return;
    }
    setConnecting(true);
    try {
      const res = await apiFetch('/google-sheets/connect', {
        method: 'POST',
        body: JSON.stringify({
          spreadsheet_url: sheetUrl.trim(),
          sheet_name: sheetTab.trim() || 'Sheet1',
          api_key: apiKey.trim() || null
        })
      });
      addToast(res.message || 'Connected to Google Sheet successfully!', 'success');
      setHeaders(res.headers || []);
      setSampleRow(res.sample_row || {});
      setMapping(res.proposed_mapping || {});
      if (res.config) setConfig(res.config);
      loadConfig();
    } catch (err) {
      addToast('Failed to connect: ' + err.message, 'error');
    } finally {
      setConnecting(false);
    }
  };

  // Re-inspect columns for a tab
  const handleInspectTab = async () => {
    if (!sheetUrl.trim()) {
      addToast('Please provide a Google Spreadsheet URL first', 'error');
      return;
    }
    setConnecting(true);
    try {
      const res = await apiFetch('/google-sheets/inspect-headers', {
        method: 'POST',
        body: JSON.stringify({
          spreadsheet_id: sheetUrl.trim(),
          sheet_name: sheetTab.trim() || 'Sheet1',
          api_key: apiKey.trim() || null
        })
      });
      setHeaders(res.headers || []);
      setSampleRow(res.sample_row || {});
      setMapping(res.proposed_mapping || {});
      addToast(`Detected ${res.headers?.length || 0} column headers in tab "${sheetTab}"`, 'success');
    } catch (err) {
      addToast('Failed to inspect tab: ' + err.message, 'error');
    } finally {
      setConnecting(false);
    }
  };

  // Save Column Mapping
  const handleSaveMapping = async () => {
    setSavingMapping(true);
    try {
      await apiFetch('/google-sheets/save-mapping', {
        method: 'POST',
        body: JSON.stringify({
          mapping,
          sheet_name: sheetTab.trim() || 'Sheet1',
          is_active: 1
        })
      });
      addToast('Column mapping and sheet settings saved!', 'success');
      loadConfig();
    } catch (err) {
      addToast('Failed to save mapping: ' + err.message, 'error');
    } finally {
      setSavingMapping(false);
    }
  };

  // Trigger Manual "Sync Now"
  const handleSyncNow = async () => {
    setSyncing(true);
    try {
      const res = await apiFetch('/google-sheets/sync-now', { method: 'POST' });
      addToast(`Sync Complete! ${res.synced_count} new leads added, ${res.skipped_count} skipped.`, 'success');
      loadConfig();
    } catch (err) {
      addToast('Sync error: ' + err.message, 'error');
    } finally {
      setSyncing(false);
    }
  };

  // Disconnect Google Sheet
  const handleDisconnect = async () => {
    if (!window.confirm('Are you sure you want to pause Google Sheets auto-synchronization?')) return;
    try {
      await apiFetch('/google-sheets/disconnect', { method: 'POST' });
      addToast('Google Sheet disconnected.', 'info');
      loadConfig();
    } catch (err) {
      addToast('Disconnect error: ' + err.message, 'error');
    }
  };

  const copyToClipboard = (text, type) => {
    navigator.clipboard.writeText(text);
    if (type === 'url') {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2500);
      addToast('Webhook URL copied to clipboard!', 'success');
    } else {
      setCopiedScript(true);
      setTimeout(() => setCopiedScript(false), 2500);
      addToast('Google Apps Script code copied to clipboard!', 'success');
    }
  };

  const handleTestLead = async () => {
    setTesting(true);
    try {
      const sample = {
        full_name: 'Aditya Birla (Live Meta Test)',
        phone_number: '+91 98200 12345',
        email: 'aditya.test@walktheplan.com',
        city: 'Mumbai',
        platform: 'ig',
        'what_is_your_floor_plan_status_?': 'Ready CAD Drawing',
        'what_is_your_plot_size_?': '3200 sq.ft Villa',
        ad_name: 'Instagram Video - 1:1 Scale Floor Walk',
        campaign_name: 'Q4 Walkthrough Booking Drive',
        status: 'Pending'
      };

      const res = await fetch(`${API}/leads/meta-webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sample)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Test webhook failed');
      addToast('Success! Live test Meta Lead ingested into CRM database.', 'success');
    } catch (err) {
      addToast('Failed to send test lead: ' + err.message, 'error');
    } finally {
      setTesting(false);
    }
  };

  const sampleAppsScript = `// Walk The Plan CRM — Meta Ads & Google Sheets Live Sync Script (Code.gs)
// Setup: Extensions > Apps Script > Paste this code > Add Trigger: onChangeTrigger (On change)

var WEBHOOK_URL = "${webhookUrl}";
var WEBHOOK_SECRET = ""; // Optional: set if WEBHOOK_SECRET is enabled on backend
var NON_CLIENT_TERMS = [
  "ad a", "ad b", "ad c", "ad 1", "ad 2", "ad name", "ad_name", "ad set",
  "meta ad", "meta ad campaign", "campaign", "campaign name",
  "walk the plan", "walk the plan 1:1", "google sheet live sync",
  "meta customer", "new meta lead", "sheet lead", "rokon", "test", "demo"
];

function onChangeTrigger(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return;

  var props = PropertiesService.getScriptProperties();
  var lastSyncedStr = props.getProperty("LAST_SYNCED_ROW");
  var lastSyncedRow = lastSyncedStr ? parseInt(lastSyncedStr, 10) : 1;

  if (lastRow <= lastSyncedRow) return;

  for (var r = lastSyncedRow + 1; r <= lastRow; r++) {
    syncRowToCRM(sheet, r);
  }
  props.setProperty("LAST_SYNCED_ROW", String(lastRow));
}

function syncRowToCRM(sheet, rowIdx) {
  var lastCol = sheet.getLastColumn();
  if (lastCol < 1) return;

  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var values = sheet.getRange(rowIdx, 1, 1, lastCol).getValues()[0];

  var hasContent = values.some(function(v) { return v !== null && v !== "" && String(v).trim().length > 0; });
  if (!hasContent) return;

  var headerMap = {};
  for (var c = 0; c < headers.length; c++) {
    var h = String(headers[c] || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    if (h) headerMap[h] = c;
  }

  function getByHeader(aliases) {
    for (var i = 0; i < aliases.length; i++) {
      var norm = aliases[i].toLowerCase().replace(/[^a-z0-9]/g, "");
      if (headerMap[norm] !== undefined) {
        var v = values[headerMap[norm]];
        if (v !== null && v !== undefined && String(v).trim() !== "") return String(v).trim();
      }
    }
    return null;
  }

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

  // Content fallback for mismatched or unlabelled columns
  if (!rawEmail || !rawPhone || !rawName) {
    for (var i = 0; i < values.length; i++) {
      var cellVal = values[i];
      if (cellVal === null || cellVal === undefined) continue;
      var str = String(cellVal).trim();
      if (!str) continue;
      if (!rawEmail && str.indexOf("@") !== -1 && /[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,}/i.test(str)) {
        rawEmail = str;
        continue;
      }
      var digitsOnly = str.replace(/\\D/g, "");
      if (!rawPhone && digitsOnly.length >= 10 && digitsOnly.length <= 15 && str.indexOf("@") === -1) {
        rawPhone = str;
        continue;
      }
      if (!rawName && isValidHumanName(str)) {
        rawName = str;
        continue;
      }
      if (!rawCity && isLikelyCity(str)) {
        rawCity = str;
        continue;
      }
    }
  }

  if (!isValidHumanName(rawName)) {
    rawName = null;
    for (var j = 0; j < values.length; j++) {
      var vStr = String(values[j] || "").trim();
      if (isValidHumanName(vStr)) { rawName = vStr; break; }
    }
  }

  var finalName = rawName || (rawPhone ? "Lead (" + rawPhone + ")" : (rawEmail ? "Lead (" + rawEmail.split("@")[0] + ")" : "Meta Customer"));
  var finalPlatform = (rawPlatform && rawPlatform.toLowerCase().indexOf("fb") !== -1) ? "fb" : "ig";
  var parsedDate = rawCreatedAt ? new Date(rawCreatedAt) : new Date();
  var createdAtIso = !isNaN(parsedDate.getTime()) ? parsedDate.toISOString() : new Date().toISOString();

  var payload = {
    full_name: finalName,
    phone_number: rawPhone || null,
    email: rawEmail || null,
    city: rawCity || null,
    platform: finalPlatform,
    lead_category: "meta",
    "what_is_your_floor_plan_status_?": rawFloorPlan || null,
    "what_is_your_plot_size_?": rawPlotSize || null,
    ad_name: rawAdName || "Meta Ad Campaign",
    campaign_name: rawCampaign || "Walk The Plan 1:1",
    status: "Pending",
    created_at: createdAtIso
  };

  var reqHeaders = {};
  if (WEBHOOK_SECRET) reqHeaders["x-webhook-secret"] = WEBHOOK_SECRET;

  UrlFetchApp.fetch(WEBHOOK_URL, {
    method: "post",
    contentType: "application/json",
    headers: reqHeaders,
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
}

function isValidHumanName(str) {
  if (!str) return false;
  var s = String(str).trim().toLowerCase();
  if (s.length < 2 || s.length > 50) return false;
  if (s.indexOf("@") !== -1 || s.indexOf("http") !== -1) return false;
  if (/^\\+?[\\d\\s\\-()]+$/.test(s)) return false;
  for (var i = 0; i < NON_CLIENT_TERMS.length; i++) {
    if (s === NON_CLIENT_TERMS[i]) return false;
  }
  if (/^(ad|adset|campaign|form|page|id|l:|leadgen)[\\s_-]*([a-z0-9]+)?$/i.test(s)) return false;
  if (/^(pending|ready|residential|commercial|instagram|facebook|meta)$/i.test(s)) return false;
  return true;
}

function isLikelyCity(str) {
  if (!str) return false;
  var s = String(str).trim();
  if (s.length < 3 || s.length > 30) return false;
  if (!/^[a-zA-Z\\s.-]+$/.test(s)) return false;
  var sLow = s.toLowerCase();
  if (isValidHumanName(s) && !/^(gurgaon|gurugram|delhi|noida|faridabad|mumbai|bangalore|bengaluru|hyderabad|pune|kolkata|chennai|ahmedabad|jaipur|lucknow|chandigarh|dehradun|varanasi)/i.test(sLow)) {
    return false;
  }
  return true;
}

function testSyncLatestRow() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) { SpreadsheetApp.getUi().alert("No data rows found."); return; }
  syncRowToCRM(sheet, lastRow);
  SpreadsheetApp.getUi().alert("Synced Row " + lastRow + " to Walk The Plan CRM!");
}

function resetSyncRow() {
  var lastRow = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet().getLastRow();
  PropertiesService.getScriptProperties().setProperty("LAST_SYNCED_ROW", String(lastRow));
  SpreadsheetApp.getUi().alert("Sync tracker reset to row " + lastRow + ".");
}`;

  const CRM_FIELDS = [
    { key: 'name', label: 'Customer Full Name', required: true, icon: Users },
    { key: 'phone', label: 'Mobile / WhatsApp Number', required: true, icon: Phone },
    { key: 'email', label: 'Email Address', required: false, icon: Mail },
    { key: 'city', label: 'City / Location', required: false, icon: MapPin },
    { key: 'plot_size', label: 'Plot Size / Area', required: false, icon: Layers },
    { key: 'floor_plan_status', label: 'Floor Plan Status', required: false, icon: FileSpreadsheet },
    { key: 'ad_name', label: 'Meta Ad Name', required: false, icon: Target },
    { key: 'campaign_name', label: 'Meta Campaign Name', required: false, icon: Zap },
    { key: 'platform', label: 'Acquisition Platform (FB/IG)', required: false, icon: Eye },
    { key: 'date', label: 'Submission Date / Timestamp', required: false, icon: Calendar },
  ];

  const isConnected = Boolean(config && config.spreadsheet_id && config.is_active);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1200, margin: '0 auto' }}>

      {/* ── Top Header Navigation Tabs ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: P.text, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <FileSpreadsheet size={24} color={P.green} /> Meta Leads & Google Sheets Live Center
          </h2>
          <div style={{ fontSize: 13, color: P.muted, marginTop: 4 }}>
            Direct real-time lead synchronization between your live Google Sheet, Meta Ads Manager, and Walk The Plan CRM
          </div>
        </div>

        {/* Sub-view switcher pill */}
        <div style={{ display: 'flex', background: P.card2, padding: 4, borderRadius: 10, border: `1px solid ${P.border}` }}>
          <button
            onClick={() => setActiveSubView('sheets_direct')}
            style={{
              padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer',
              background: activeSubView === 'sheets_direct' ? P.green : 'transparent',
              color: activeSubView === 'sheets_direct' ? '#000' : P.muted,
              display: 'flex', alignItems: 'center', gap: 7, transition: 'all 0.15s'
            }}
          >
            <FileSpreadsheet size={15} /> Google Sheets Direct Sync
          </button>
          <button
            onClick={() => setActiveSubView('meta_webhook')}
            style={{
              padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer',
              background: activeSubView === 'meta_webhook' ? P.gold : 'transparent',
              color: activeSubView === 'meta_webhook' ? '#000' : P.muted,
              display: 'flex', alignItems: 'center', gap: 7, transition: 'all 0.15s'
            }}
          >
            <Zap size={15} /> Direct Meta Webhook
          </button>
          <button
            onClick={() => setActiveSubView('apps_script')}
            style={{
              padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer',
              background: activeSubView === 'apps_script' ? '#a855f7' : 'transparent',
              color: activeSubView === 'apps_script' ? '#fff' : P.muted,
              display: 'flex', alignItems: 'center', gap: 7, transition: 'all 0.15s'
            }}
          >
            <Clock size={15} /> Apps Script Push
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════════════ */}
      {/* VIEW 1: GOOGLE SHEETS DIRECT LIVE SYNC (PRIMARY CLIENT REQUIREMENT)           */}
      {/* ══════════════════════════════════════════════════════════════════════════════ */}
      {activeSubView === 'sheets_direct' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Status & Telemetry Bar */}
          <div style={{
            background: isConnected ? 'linear-gradient(135deg, rgba(34,197,94,0.12) 0%, rgba(17,17,19,0.95) 100%)' : P.card,
            border: `1px solid ${isConnected ? P.green + '60' : P.border}`,
            borderRadius: 16, padding: '20px 24px', display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', flexWrap: 'wrap', gap: 16
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 46, height: 46, borderRadius: 12,
                background: isConnected ? 'rgba(34,197,94,0.2)' : 'rgba(161,161,170,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <FileSpreadsheet size={24} color={isConnected ? P.green : P.muted} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 16, fontWeight: 800, color: P.text }}>
                    {isConnected ? 'Google Sheet Live Sync Active' : 'No Google Sheet Connected'}
                  </span>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20,
                    background: isConnected ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)',
                    color: isConnected ? P.green : '#f87171',
                    border: `1px solid ${isConnected ? P.green : '#f87171'}40`
                  }}>
                    {isConnected ? '● CONNECTED' : '○ DISCONNECTED'}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: P.muted, marginTop: 4 }}>
                  {isConnected
                    ? `Tracking Tab: "${config?.sheet_name || 'Sheet1'}" • Auto-syncing background cron runs every 5 minutes`
                    : 'Paste your Google Sheet link below to stream Meta leads into your CRM dashboard automatically.'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              {isConnected && (
                <button
                  onClick={handleSyncNow}
                  disabled={syncing}
                  style={{
                    background: P.green, color: '#000', border: 'none', borderRadius: 9,
                    fontWeight: 700, fontSize: 13, padding: '10px 20px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.15s'
                  }}
                >
                  <RefreshCw size={15} style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }} />
                  {syncing ? 'Syncing Now…' : 'Sync Now (Fetch Leads)'}
                </button>
              )}
              {isConnected && (
                <button
                  onClick={handleDisconnect}
                  style={{
                    background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
                    color: '#f87171', borderRadius: 9, fontWeight: 700, fontSize: 13,
                    padding: '10px 16px', cursor: 'pointer'
                  }}
                >
                  Disconnect
                </button>
              )}
            </div>
          </div>

          {/* Sync Stats Highlights */}
          {isConnected && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
              <div style={{ background: P.card, border: `1px solid ${P.border}`, borderRadius: 12, padding: '16px 20px' }}>
                <div style={{ fontSize: 12, color: P.muted, fontWeight: 600 }}>Total Leads Synced</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: P.green, marginTop: 4 }}>
                  {config?.total_synced_count ? config.total_synced_count.toLocaleString('en-IN') : 0}
                </div>
                <div style={{ fontSize: 11, color: P.muted, marginTop: 4 }}>Deduplicated against database</div>
              </div>

              <div style={{ background: P.card, border: `1px solid ${P.border}`, borderRadius: 12, padding: '16px 20px' }}>
                <div style={{ fontSize: 12, color: P.muted, fontWeight: 600 }}>Last Successful Sync</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: P.text, marginTop: 8 }}>
                  {config?.last_sync_at ? fmtDate(config.last_sync_at) : 'Never'}
                </div>
                <div style={{ fontSize: 11, color: P.muted, marginTop: 4 }}>
                  Status: <span style={{ color: config?.last_sync_status === 'success' ? P.green : P.gold }}>{config?.last_sync_status || 'idle'}</span>
                </div>
              </div>

              <div style={{ background: P.card, border: `1px solid ${P.border}`, borderRadius: 12, padding: '16px 20px' }}>
                <div style={{ fontSize: 12, color: P.muted, fontWeight: 600 }}>Automated Sync Schedule</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: P.gold, marginTop: 8 }}>
                  Every 5 Minutes (node-cron)
                </div>
                <div style={{ fontSize: 11, color: P.muted, marginTop: 4 }}>Silent background ingestion</div>
              </div>
            </div>
          )}

          {/* Step 1: Connect / Attach Google Spreadsheet */}
          <div style={{ background: P.card, border: `1px solid ${P.border}`, borderRadius: 16, padding: 24 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: P.text, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Link size={18} color={P.green} /> 1. Connect Google Spreadsheet
            </div>
            <div style={{ fontSize: 13, color: P.muted, marginBottom: 18 }}>
              Paste the shareable link or ID of your live Google Sheet where Meta leads are added. (Ensure sharing is set to <i>"Anyone with the link can view"</i>).
            </div>

            <form onSubmit={handleConnectSheet} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: P.muted, display: 'block', marginBottom: 6 }}>
                    Google Spreadsheet Link or ID *
                  </label>
                  <input
                    type="text"
                    value={sheetUrl}
                    onChange={(e) => setSheetUrl(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit"
                    style={{
                      width: '100%', background: '#09090b', border: `1px solid ${P.border}`,
                      borderRadius: 8, padding: '11px 14px', color: P.text, fontSize: 13, outline: 'none'
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: P.muted, display: 'block', marginBottom: 6 }}>
                    Sheet / Tab Name *
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="text"
                      value={sheetTab}
                      onChange={(e) => setSheetTab(e.target.value)}
                      placeholder="e.g. Meta Leads, Sheet1, Form Responses"
                      style={{
                        flex: 1, background: '#09090b', border: `1px solid ${P.border}`,
                        borderRadius: 8, padding: '11px 14px', color: P.text, fontSize: 13, outline: 'none'
                      }}
                    />
                    {isConnected && (
                      <button
                        type="button"
                        onClick={handleInspectTab}
                        disabled={connecting}
                        style={{
                          background: P.card2, border: `1px solid ${P.border}`, color: P.text,
                          borderRadius: 8, padding: '0 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer'
                        }}
                      >
                        Inspect
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Advanced API Key toggle for private enterprise sheets */}
              <div style={{ marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => setShowApiKeyInput(!showApiKeyInput)}
                  style={{ background: 'transparent', border: 'none', color: P.gold, fontSize: 12, cursor: 'pointer', padding: 0 }}
                >
                  {showApiKeyInput ? '− Hide Google Sheets API Key (Optional)' : '+ Add Google Sheets API Key (For Private Domain Sheets)'}
                </button>
                {showApiKeyInput && (
                  <div style={{ marginTop: 8 }}>
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="Enter Google Cloud API Key with Google Sheets API enabled (Optional)"
                      style={{
                        width: '100%', background: '#09090b', border: `1px solid ${P.border}`,
                        borderRadius: 8, padding: '9px 12px', color: P.text, fontSize: 12, outline: 'none'
                      }}
                    />
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                <button
                  type="submit"
                  disabled={connecting}
                  style={{
                    background: P.green, color: '#000', border: 'none', borderRadius: 8,
                    padding: '11px 22px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 8
                  }}
                >
                  <RefreshCw size={14} style={{ animation: connecting ? 'spin 1s linear infinite' : 'none' }} />
                  {connecting ? 'Connecting & Reading Sheet…' : (isConnected ? 'Update Sheet & Re-Inspect' : 'Connect & Read Columns')}
                </button>
              </div>
            </form>
          </div>

          {/* Step 2: Flexible Column Mapping Matrix */}
          {(headers.length > 0 || isConnected) && (
            <div style={{ background: P.card, border: `1px solid ${P.border}`, borderRadius: 16, padding: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: P.text, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <SlidersHorizontal size={18} color={P.gold} /> 2. Flexible Lead Column Mapping
                  </div>
                  <div style={{ fontSize: 13, color: P.muted, marginTop: 4 }}>
                    Match Google Sheet columns to CRM lead fields. System automatically detected optimal mappings based on row headers.
                  </div>
                </div>

                <button
                  onClick={handleSaveMapping}
                  disabled={savingMapping}
                  style={{
                    background: P.gold, color: '#000', border: 'none', borderRadius: 8,
                    padding: '9px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 6
                  }}
                >
                  <Check size={15} /> {savingMapping ? 'Saving…' : 'Save Column Mapping'}
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
                {CRM_FIELDS.map(f => {
                  const Icon = f.icon;
                  const currentVal = mapping[f.key] || '';
                  return (
                    <div key={f.key} style={{ background: P.card2, border: `1px solid ${P.border}`, borderRadius: 10, padding: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: P.text }}>
                          <Icon size={14} color={f.required ? P.gold : P.muted} /> {f.label}
                          {f.required && <span style={{ color: '#f87171' }}>*</span>}
                        </div>
                      </div>

                      <select
                        value={currentVal}
                        onChange={(e) => setMapping(prev => ({ ...prev, [f.key]: e.target.value }))}
                        style={{
                          width: '100%', background: '#09090b', border: `1px solid ${currentVal ? P.green + '80' : P.border}`,
                          borderRadius: 7, padding: '8px 10px', color: currentVal ? P.text : P.muted, fontSize: 12, outline: 'none', cursor: 'pointer'
                        }}
                      >
                        <option value="">-- Do Not Import / Not in Sheet --</option>
                        {headers.map(h => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>

              {/* Sample Data Preview Box */}
              {sampleRow && Object.keys(sampleRow).length > 0 && (
                <div style={{ marginTop: 18, background: '#09090b', border: `1px solid ${P.border}`, borderRadius: 10, padding: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: P.muted, marginBottom: 8 }}>
                    Sample Detected Row from Sheet (Row 2):
                  </div>
                  <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 4 }}>
                    {Object.entries(sampleRow).slice(0, 7).map(([k, v]) => (
                      <div key={k} style={{ background: P.card2, padding: '6px 12px', borderRadius: 6, fontSize: 11, flexShrink: 0 }}>
                        <span style={{ color: P.muted }}>{k}:</span> <b style={{ color: P.text }}>{String(v || '—')}</b>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Recent Sync History & Logs */}
          <div style={{ background: P.card, border: `1px solid ${P.border}`, borderRadius: 16, padding: 24 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: P.text, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Clock size={18} color={P.muted} /> 3. Live Sync Audit Trail & Telemetry
            </div>

            {syncLogs.length === 0 ? (
              <div style={{ padding: '24px 0', textAlign: 'center', color: P.muted, fontSize: 13 }}>
                No synchronization events recorded yet. Connect a sheet and click "Sync Now" to start.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${P.border}`, color: P.muted, textAlign: 'left' }}>
                      <th style={{ padding: '8px 12px' }}>Timestamp</th>
                      <th style={{ padding: '8px 12px' }}>Sync Type</th>
                      <th style={{ padding: '8px 12px' }}>New Leads Ingested</th>
                      <th style={{ padding: '8px 12px' }}>Duplicates Skipped</th>
                      <th style={{ padding: '8px 12px' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {syncLogs.slice(0, 8).map(log => (
                      <tr key={log.id} style={{ borderBottom: `1px solid ${P.border}40`, color: P.text }}>
                        <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>{fmtDate(log.created_at)}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{
                            padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                            background: log.sync_type === 'auto' ? 'rgba(59,130,246,0.15)' : 'rgba(245,158,11,0.15)',
                            color: log.sync_type === 'auto' ? '#60a5fa' : P.gold
                          }}>
                            {log.sync_type === 'auto' ? 'Background Cron' : 'Manual Trigger'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', color: P.green, fontWeight: 700 }}>+{log.synced_count}</td>
                        <td style={{ padding: '10px 12px', color: P.muted }}>{log.skipped_count}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ color: log.status === 'success' ? P.green : '#f87171' }}>
                            {log.status === 'success' ? '✓ Success' : '✕ Error'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════════ */}
      {/* VIEW 2: DIRECT META ADS WEBHOOK (IN CASE CLIENT BYPASSES SHEETS LATER)        */}
      {/* ══════════════════════════════════════════════════════════════════════════════ */}
      {activeSubView === 'meta_webhook' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ background: P.card, border: `1px solid ${P.border}`, borderRadius: 16, padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(168,85,247,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Zap size={20} color="#c084fc" />
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: P.text }}>Meta Ads Manager Direct Webhook</div>
                  <div style={{ fontSize: 12, color: P.muted }}>Real-time HTTP webhook for Meta Lead Ads (Facebook & Instagram) or Zapier / Make</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={handleTestLead}
                  disabled={testing}
                  style={{
                    background: 'rgba(168,85,247,0.18)', border: '1px solid #c084fc', borderRadius: 8,
                    color: '#c084fc', fontWeight: 700, fontSize: 13, padding: '8px 16px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 6
                  }}
                >
                  <Zap size={14} /> {testing ? 'Ingesting…' : 'Simulate Meta Lead'}
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 16 }}>
              <div style={{
                flex: 1, background: '#09090b', border: `1px solid ${P.border}`, borderRadius: 8,
                padding: '10px 14px', fontFamily: 'monospace', fontSize: 13, color: '#c084fc', overflowX: 'auto', whiteSpace: 'nowrap'
              }}>
                {webhookUrl}
              </div>
              <button
                onClick={() => copyToClipboard(webhookUrl, 'url')}
                style={{
                  background: copiedUrl ? P.green : P.card2, border: `1px solid ${copiedUrl ? P.green : P.border}`,
                  color: copiedUrl ? '#000' : P.text, borderRadius: 8, padding: '10px 18px', fontSize: 13,
                  fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0
                }}
              >
                {copiedUrl ? <Check size={14} /> : <Copy size={14} />} {copiedUrl ? 'Copied!' : 'Copy Webhook URL'}
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginTop: 18 }}>
              <div style={{ background: P.card2, border: `1px solid ${P.border}`, borderRadius: 10, padding: 14 }}>
                <div style={{ fontSize: 11, color: P.muted, fontWeight: 600, textTransform: 'uppercase' }}>HTTP Method</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: P.text, marginTop: 4 }}>POST (application/json)</div>
              </div>
              <div style={{ background: P.card2, border: `1px solid ${P.border}`, borderRadius: 10, padding: 14 }}>
                <div style={{ fontSize: 11, color: P.muted, fontWeight: 600, textTransform: 'uppercase' }}>Verify Token</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: P.gold, marginTop: 4, fontFamily: 'monospace' }}>walktheplan_meta_secret_2026</div>
              </div>
              <div style={{ background: P.card2, border: `1px solid ${P.border}`, borderRadius: 10, padding: 14 }}>
                <div style={{ fontSize: 11, color: P.muted, fontWeight: 600, textTransform: 'uppercase' }}>Challenge Response</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: P.green, marginTop: 4 }}>hub.challenge Handshake Active</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════════ */}
      {/* VIEW 3: APPS SCRIPT PUSH (ALTERNATIVE LIVE TRIGGER)                           */}
      {/* ══════════════════════════════════════════════════════════════════════════════ */}
      {activeSubView === 'apps_script' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ background: P.card, border: `1px solid ${P.border}`, borderRadius: 16, padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: P.text }}>Google Apps Script Real-Time Push</div>
                <div style={{ fontSize: 12, color: P.muted }}>If you prefer instantaneous row-by-row push directly from Google Sheets via onChange trigger</div>
              </div>
              <button
                onClick={() => copyToClipboard(sampleAppsScript, 'script')}
                style={{
                  background: copiedScript ? P.green : P.card2, border: `1px solid ${copiedScript ? P.green : P.border}`,
                  color: copiedScript ? '#000' : P.text, borderRadius: 8, padding: '8px 16px', fontSize: 12,
                  fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
                }}
              >
                {copiedScript ? <Check size={14} /> : <Copy size={14} />} {copiedScript ? 'Copied Code!' : 'Copy Apps Script Code'}
              </button>
            </div>

            <pre style={{
              background: '#09090b', border: `1px solid ${P.border}`, borderRadius: 10, padding: 16,
              fontSize: 12, color: '#a1a1aa', overflowX: 'auto', fontFamily: 'monospace', lineHeight: 1.5, margin: 0
            }}>
              {sampleAppsScript}
            </pre>
          </div>
        </div>
      )}

    </div>
  );
}
