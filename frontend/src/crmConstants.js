// ─── Shared CRM Constants, Colors & Utilities ──────────────────────────────

const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
const envBackendUrl = (import.meta.env.VITE_BACKEND_URL || '').replace(/\/$/, '');
export const BACKEND_BASE = envBackendUrl || (isLocal ? 'http://localhost:5000' : '');
export const API = `${BACKEND_BASE}/api/crm`;
export const LEADS_PER_PAGE = 25;

export const P = {
  bg: '#09090b',
  card: '#111113',
  card2: '#18181b',
  border: '#27272a',
  border2: '#3f3f46',
  text: '#fafafa',
  muted: '#a1a1aa',
  gold: '#f59e0b',
  green: '#22c55e',
  blue: '#3b82f6',
  purple: '#a855f7',
  red: '#ef4444',
  accent: '#f59e0b',
};

export const STATUS_META = {
  'Blank Lead': { label: 'Blank Lead', color: '#94a3b8', bg: 'rgba(148,163,184,0.18)', badge: '⚪' },
  'Live Sheet Lead': { label: 'Live Sheet Lead', color: '#10b981', bg: 'rgba(16,185,129,0.18)', badge: '📊' },
  'Pending': { label: 'Pending', color: '#f59e0b', bg: 'rgba(245,158,11,0.18)', badge: '⏳' },
  'Hot Lead': { label: 'Hot Lead', color: '#ef4444', bg: 'rgba(239,68,68,0.18)', badge: '🔥' },
  'Warm Lead': { label: 'Warm Lead', color: '#f97316', bg: 'rgba(249,115,22,0.18)', badge: '☀️' },
  'Cold Lead': { label: 'Cold Lead', color: '#06b6d4', bg: 'rgba(6,182,212,0.18)', badge: '❄️' },
  'Interested': { label: 'Interested', color: '#10b981', bg: 'rgba(16,185,129,0.18)', badge: '👍' },
  'Not Interested': { label: 'Not Interested', color: '#f43f5e', bg: 'rgba(244,63,94,0.18)', badge: '👎' },
  'Design Related': { label: 'Design Related', color: '#8b5cf6', bg: 'rgba(139,92,246,0.18)', badge: '📐' },
  'Details Shared': { label: 'Details Shared', color: '#3b82f6', bg: 'rgba(59,130,246,0.18)', badge: '📩' },
  '50/50': { label: '50/50', color: '#eab308', bg: 'rgba(234,179,8,0.18)', badge: '⚖️' },
  'Not Picked': { label: 'Not Picked', color: '#94a3b8', bg: 'rgba(148,163,184,0.18)', badge: '📵' },
  'Non Relevant': { label: 'Non Relevant', color: '#64748b', bg: 'rgba(100,116,139,0.18)', badge: '❌' },
  'Too Far': { label: 'Too Far', color: '#ec4899', bg: 'rgba(236,72,153,0.18)', badge: '📍' },
  'Too Early': { label: 'Too Early', color: '#a855f7', bg: 'rgba(168,85,247,0.18)', badge: '⏳' },
  'Too Late': { label: 'Too Late', color: '#475569', bg: 'rgba(71,85,105,0.18)', badge: '⏱️' },
  // Compatibility & Aliases
  'pending': { label: 'Pending', color: '#f59e0b', bg: 'rgba(245,158,11,0.18)', badge: '⏳' },
  'not interested': { label: 'Not Interested', color: '#f43f5e', bg: 'rgba(244,63,94,0.18)', badge: '👎' },
  'not_interested': { label: 'Not Interested', color: '#f43f5e', bg: 'rgba(244,63,94,0.18)', badge: '👎' },
  new: { label: 'New', color: '#3b82f6', bg: 'rgba(59,130,246,0.15)', badge: '⭐' },
  contacted: { label: 'Contacted', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', badge: '📞' },
  qualified: { label: 'Qualified', color: '#a855f7', bg: 'rgba(168,85,247,0.15)', badge: '✓' },
  converted: { label: 'Converted', color: '#22c55e', bg: 'rgba(34,197,94,0.15)', badge: '🏆' },
  lost: { label: 'Lost', color: '#ef4444', bg: 'rgba(239,68,68,0.15)', badge: '✕' }
};

export const STATUS_OPTIONS = [
  'Blank Lead',
  'Pending',
  'Hot Lead',
  'Warm Lead',
  'Cold Lead'
];

export const PRIORITY_META = {
  high: { label: 'High', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  medium: { label: 'Medium', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  low: { label: 'Low', color: '#6b7280', bg: 'rgba(107,114,128,0.12)' },
};

export const ROLE_META = {
  admin: { label: 'Admin (All Depts)', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
  sales: { label: 'Sales Executive', color: '#3b82f6', bg: 'rgba(59,130,246,0.15)' },
  marketing: { label: 'Marketing (View-Only)', color: '#a855f7', bg: 'rgba(168,85,247,0.15)' },
  hr: { label: 'Human Resources', color: '#10b981', bg: 'rgba(16,185,129,0.15)' },
  operations: { label: 'Operations', color: '#06b6d4', bg: 'rgba(6,182,212,0.15)' },
  finance: { label: 'Finance', color: '#eab308', bg: 'rgba(234,179,8,0.15)' },
  franchise: { label: 'Franchise Partner', color: '#ec4899', bg: 'rgba(236,72,153,0.15)' },
  manager: { label: 'Sales Manager', color: '#10b981', bg: 'rgba(16,185,129,0.15)' },
  agent: { label: 'Sales Agent', color: '#3b82f6', bg: 'rgba(59,130,246,0.15)' },
  sales_engineer: { label: 'Sales Engineer', color: '#a855f7', bg: 'rgba(168,85,247,0.15)' },
  field_agent: { label: 'Field Agent', color: '#3b82f6', bg: 'rgba(59,130,246,0.15)' }
};

export const DEPARTMENTS = [
  'Sales', 'Marketing', 'Human Resources', 'Operations', 'Finance', 'Franchise', 'Management'
];

export const SOURCE_OPTIONS = [
  'Meta Ads (Facebook)', 'Meta Ads (Instagram)', 'Google Sheet Live Sync',
  'Google Leads Sheet', 'Franchise Application', 'WhatsApp Direct',
  'Google Search', 'Industrial Referral', 'Other'
];

export const authHeaders = () => {
  const token = localStorage.getItem('crm_token');
  return { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
};

export const apiFetch = async (endpoint, options = {}) => {
  const token = localStorage.getItem('crm_token');
  if (!token) {
    window.location.href = '/crm/login';
    return null;
  }
  const headers = { ...authHeaders(), ...(options.headers || {}) };
  try {
    const res = await fetch(`${API}${endpoint}`, {
      ...options,
      headers,
    });
    if (res.status === 401) {
      localStorage.removeItem('crm_token');
      localStorage.removeItem('crm_user');
      window.location.href = '/crm/login';
      return null;
    }
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || `HTTP ${res.status}`);
    }
    return res.json();
  } catch (err) {
    console.warn(`[CRM API] Warning on ${endpoint}:`, err.message);
    throw err;
  }
};

export const fmtDate = (d) => {
  if (!d) return '—';
  let s = String(d).trim();
  // Detect SQLite UTC timestamp "YYYY-MM-DD HH:MM:SS" -> "YYYY-MM-DDTHH:MM:SSZ"
  if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(s)) {
    s = s.replace(' ', 'T') + 'Z';
  } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(s) && !s.endsWith('Z') && !/[+-]\d{2}:\d{2}$/.test(s)) {
    s = s + 'Z';
  }
  const date = new Date(s);
  if (isNaN(date.getTime())) return String(d);
  return date.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
};

export const fmtDateOnly = (d) => {
  if (!d) return '—';
  const s = String(d).split('T')[0].split(' ')[0];
  const date = new Date(s + 'T00:00:00Z');
  if (isNaN(date.getTime())) return s;
  return date.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

export const fmtNum = (n) => (n ?? 0).toLocaleString('en-IN');
export const fmtDuration = (sec) => {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};
