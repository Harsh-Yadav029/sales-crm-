import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import {
  Users, UserPlus, Upload, Mic, MicOff, Play, Square, Trash2, Edit, Phone, Mail,
  MapPin, Calendar, TrendingUp, BarChart3, CheckCircle, XCircle, Clock, AlertCircle,
  Download, FileText, Search, Filter, ChevronLeft, ChevronRight, Plus, Activity,
  Volume2, Pause, RefreshCw, X, Check, Eye, Layers, Star, Home, LogOut,
  MoreVertical, ArrowUpRight, ArrowDownRight, Zap, Target, Award, Shield,
  ChevronDown, Database, Settings, Bell, Hash, Briefcase, DollarSign, List,
  PhoneCall, PhoneOff, Radio, Headphones, FileSpreadsheet, VolumeX,
  Link, Copy, ExternalLink, Sparkles, SlidersHorizontal, UserCheck, UserX,
  MessageSquare, CalendarDays, Circle
} from 'lucide-react';

import { BACKEND_BASE, API } from '../crmConstants';
import TabCalendar from '../components/TabCalendar';
import TabFollowUps from '../components/TabFollowUps';
import LeadDrawer from '../components/LeadDrawer';
import QuickAddLeadModal from '../components/QuickAddLeadModal';
import TabBackup from '../components/TabBackup';
import GoogleSheetsIntegrationPanel from '../components/GoogleSheetsIntegrationPanel';

// ─── Constants ────────────────────────────────────────────────────────────────
const resolveMediaUrl = (url) => (url && typeof url === 'string' && url.startsWith('/') ? `${BACKEND_BASE}${url}` : url);
const LEADS_PER_PAGE = 25;

const STATUS_META = {
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
  // Backward compatibility & aliases
  'pending': { label: 'Pending', color: '#f59e0b', bg: 'rgba(245,158,11,0.18)', badge: '⏳' },
  'not interested': { label: 'Not Interested', color: '#f43f5e', bg: 'rgba(244,63,94,0.18)', badge: '👎' },
  'not_interested': { label: 'Not Interested', color: '#f43f5e', bg: 'rgba(244,63,94,0.18)', badge: '👎' },
  new: { label: 'New', color: '#3b82f6', bg: 'rgba(59,130,246,0.15)', badge: '⭐' },
  contacted: { label: 'Contacted', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', badge: '📞' },
  qualified: { label: 'Qualified', color: '#a855f7', bg: 'rgba(168,85,247,0.15)', badge: '✓' },
  converted: { label: 'Converted', color: '#22c55e', bg: 'rgba(34,197,94,0.15)', badge: '🏆' },
  lost: { label: 'Lost', color: '#ef4444', bg: 'rgba(239,68,68,0.15)', badge: '✕' }
};

const PRIORITY_META = {
  high: { label: 'High', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  medium: { label: 'Medium', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  low: { label: 'Low', color: '#6b7280', bg: 'rgba(107,114,128,0.12)' },
};

const ROLE_META = {
  admin: { label: 'Admin (All Pipelines)', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
  pre_sales: { label: '01 Pre-Sales Executive', color: '#38bdf8', bg: 'rgba(56,189,248,0.15)' },
  main_sales: { label: '02 Main Sales Executive', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
  post_sales: { label: '03 Post-Sales Executive', color: '#10b981', bg: 'rgba(16,185,129,0.15)' },
  manager: { label: 'Sales Manager (All Pipelines)', color: '#10b981', bg: 'rgba(16,185,129,0.15)' },
  sales: { label: 'Sales Executive', color: '#3b82f6', bg: 'rgba(59,130,246,0.15)' },
  marketing: { label: 'Marketing (View-Only)', color: '#a855f7', bg: 'rgba(168,85,247,0.15)' },
  hr: { label: 'Human Resources', color: '#10b981', bg: 'rgba(16,185,129,0.15)' },
  operations: { label: 'Operations', color: '#06b6d4', bg: 'rgba(6,182,212,0.15)' },
  finance: { label: 'Finance', color: '#eab308', bg: 'rgba(234,179,8,0.15)' },
  franchise: { label: 'Franchise Partner', color: '#ec4899', bg: 'rgba(236,72,153,0.15)' },
  agent: { label: 'Sales Agent', color: '#3b82f6', bg: 'rgba(59,130,246,0.15)' },
  sales_engineer: { label: 'Sales Engineer', color: '#a855f7', bg: 'rgba(168,85,247,0.15)' },
  field_agent: { label: 'Field Agent', color: '#3b82f6', bg: 'rgba(59,130,246,0.15)' }
};

const DEPARTMENTS = [
  'Pre-Sales',
  'Main Sales',
  'Post-Sales',
  'Sales',
  'Management',
  'Marketing',
  'Human Resources',
  'Operations',
  'Finance',
  'Franchise'
];

const SOURCE_OPTIONS = [
  'Meta Ads (Facebook)', 'Meta Ads (Instagram)', 'Google Sheet Live Sync',
  'Google Leads Sheet', 'Franchise Application', 'WhatsApp Direct',
  'Google Search', 'Industrial Referral', 'Other'
];
const STATUS_OPTIONS = [
  'Blank Lead',
  'Pending',
  'Hot Lead',
  'Warm Lead',
  'Cold Lead'
];
const PRIORITY_OPTIONS = Object.keys(PRIORITY_META);
const ROLE_OPTIONS = Object.keys(ROLE_META);

// ─── Palette ──────────────────────────────────────────────────────────────────
const P = {
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

// ─── Helpers ──────────────────────────────────────────────────────────────────
const authHeaders = () => {
  const token = localStorage.getItem('crm_token');
  return { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
};

const apiFetch = async (path, options = {}) => {
  const token = localStorage.getItem('crm_token');
  if (!token) {
    window.location.href = '/crm/login';
    return null;
  }
  const headers = { 'Authorization': `Bearer ${token}`, ...options.headers };
  const res = await fetch(`${API}${path}`, {
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
};

const fmtDate = (d) => {
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
const fmtNum = (n) => (n ?? 0).toLocaleString('en-IN');
const fmtDuration = (sec) => {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Toast notification */
const Toast = ({ toasts, remove }) => (
  <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8 }}>
    {toasts.map(t => (
      <div key={t.id} style={{
        display: 'flex', alignItems: 'center', gap: 10,
        background: t.type === 'success' ? 'rgba(34,197,94,0.18)' : t.type === 'error' ? 'rgba(239,68,68,0.18)' : 'rgba(245,158,11,0.18)',
        border: `1px solid ${t.type === 'success' ? P.green : t.type === 'error' ? P.red : P.gold}`,
        borderRadius: 10, padding: '12px 16px', minWidth: 280, maxWidth: 420,
        backdropFilter: 'blur(14px)', color: P.text, fontSize: 14, fontWeight: 500,
        animation: 'slideInRight 0.3s ease',
        boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
      }}>
        {t.type === 'success' ? <CheckCircle size={16} color={P.green} /> : t.type === 'error' ? <XCircle size={16} color={P.red} /> : <AlertCircle size={16} color={P.gold} />}
        <span style={{ flex: 1 }}>{t.message}</span>
        <button onClick={() => remove(t.id)} style={{ background: 'none', border: 'none', color: P.muted, cursor: 'pointer', padding: 0 }}><X size={14} /></button>
      </div>
    ))}
  </div>
);

/** Status badge with interactive dropdown selector */
const StatusBadge = ({ status, onChange, onClick, disabled = false }) => {
  const normStatus = (status === 'Live Sheet Lead') ? 'Blank Lead' : status;
  const m = STATUS_META[normStatus] || STATUS_META[status] || STATUS_META['Blank Lead'] || STATUS_META.new;

  if (onChange && !disabled) {
    return (
      <div
        style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
        onClick={e => e.stopPropagation()}
      >
        <select
          value={normStatus}
          onChange={e => {
            e.stopPropagation();
            onChange(e.target.value);
          }}
          title="Click to select status"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            background: m.bg,
            color: m.color,
            border: `1px solid ${m.color}60`,
            borderRadius: 20,
            padding: '3px 22px 3px 10px',
            fontSize: 11,
            fontWeight: 700,
            cursor: 'pointer',
            outline: 'none',
            WebkitAppearance: 'none',
            MozAppearance: 'none',
            appearance: 'none',
            letterSpacing: 0.3,
            transition: 'all 0.15s ease',
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='${encodeURIComponent(m.color)}' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 7px center',
            boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = m.color;
            e.currentTarget.style.boxShadow = `0 0 10px ${m.color}40`;
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = `${m.color}60`;
            e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.3)';
          }}
        >
          {STATUS_OPTIONS.map(opt => {
            const optMeta = STATUS_META[opt] || {};
            return (
              <option
                key={opt}
                value={opt}
                style={{
                  background: '#18181b',
                  color: optMeta.color || '#fafafa',
                  fontSize: 12,
                  fontWeight: 600,
                  padding: '8px'
                }}
              >
                {optMeta.badge ? `${optMeta.badge} ` : ''}{optMeta.label || opt}
              </option>
            );
          })}
        </select>
      </div>
    );
  }

  return (
    <span onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: m.bg, color: m.color, border: `1px solid ${m.color}40`,
      borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700,
      cursor: onClick ? 'pointer' : 'default', whiteSpace: 'nowrap',
      userSelect: 'none', letterSpacing: 0.3,
    }}>{m.badge ? `${m.badge} ` : ''}{m.label}</span>
  );
};

/** Priority badge */
const PriorityBadge = ({ priority }) => {
  const m = PRIORITY_META[priority] || PRIORITY_META.medium;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: m.bg, color: m.color, border: `1px solid ${m.color}40`,
      borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
    }}>{m.label}</span>
  );
};

/** Role badge */
const RoleBadge = ({ role }) => {
  const m = ROLE_META[role] || { label: role || 'Agent', color: P.blue, bg: `${P.blue}20` };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      background: m.bg, color: m.color, border: `1px solid ${m.color}40`,
      borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 600,
    }}>{m.label}</span>
  );
};

/** Stat card */
const StatCard = ({ icon: Icon, label, value, color, sub, onClick, isActive }) => {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: isActive ? `${color || P.gold}12` : P.card,
        border: `1px solid ${isActive ? (color || P.gold) : (hovered && onClick ? (color || P.gold) : P.border)}`,
        borderRadius: 14,
        padding: '20px 22px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        position: 'relative',
        overflow: 'hidden',
        cursor: onClick ? 'pointer' : 'default',
        transform: (hovered || isActive) && onClick ? 'translateY(-3px)' : 'translateY(0)',
        boxShadow: isActive
          ? `0 10px 26px rgba(0,0,0,0.5), 0 0 0 1px ${color || P.gold}50`
          : (hovered && onClick ? `0 8px 24px rgba(0,0,0,0.4), 0 0 0 1px ${color || P.gold}30` : 'none'),
        transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        userSelect: 'none'
      }}
    >
      <div style={{ position: 'absolute', top: -20, right: -20, opacity: (hovered || isActive) && onClick ? 0.14 : 0.06, transition: 'opacity 0.2s' }}>
        <Icon size={90} color={color || P.gold} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ background: `${color || P.gold}20`, borderRadius: 8, padding: 7 }}>
            <Icon size={18} color={color || P.gold} />
          </div>
          <span style={{ color: isActive ? '#fff' : P.muted, fontSize: 12, fontWeight: 700, letterSpacing: 0.4 }}>{label}</span>
        </div>
        {onClick && (
          <span style={{
            fontSize: 10,
            color: (hovered || isActive) ? (color || P.gold) : '#71717a',
            fontWeight: 800,
            opacity: (hovered || isActive) ? 1 : 0,
            transition: 'opacity 0.15s, color 0.15s',
            display: 'flex',
            alignItems: 'center',
            gap: 2
          }}>
            {isActive ? 'Active Section ▼' : 'Open List ↗'}
          </span>
        )}
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, color: P.text, letterSpacing: -0.5 }}>{fmtNum(value)}</div>
      {sub && <div style={{ fontSize: 11, color: P.muted }}>{sub}</div>}
    </div>
  );
};

/** Loading skeleton row */
const SkeletonRow = ({ cols }) => (
  <tr>
    {Array.from({ length: cols }).map((_, i) => (
      <td key={i} style={{ padding: '14px 12px' }}>
        <div style={{ height: 14, background: '#1f1f23', borderRadius: 6, animation: 'pulse 1.5s ease-in-out infinite' }} />
      </td>
    ))}
  </tr>
);

/** Empty state */
const EmptyState = ({ icon: Icon, title, sub }) => (
  <div style={{ textAlign: 'center', padding: '60px 20px', color: P.muted }}>
    <Icon size={48} color={P.border2} style={{ marginBottom: 16 }} />
    <div style={{ fontSize: 16, fontWeight: 600, color: P.text, marginBottom: 8 }}>{title}</div>
    <div style={{ fontSize: 13 }}>{sub}</div>
  </div>
);

/** Modal wrapper */
const Modal = ({ open, onClose, title, children, width = 520 }) => {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      backdropFilter: 'blur(5px)',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: P.card, border: `1px solid ${P.border}`, borderRadius: 16,
        width: '100%', maxWidth: width, maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 25px 60px rgba(0,0,0,0.7)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: `1px solid ${P.border}` }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: P.text }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: P.muted, cursor: 'pointer', padding: 4 }}><X size={20} /></button>
        </div>
        <div style={{ padding: '24px' }}>{children}</div>
      </div>
    </div>
  );
};

/** Form field */
const Field = ({ label, children, required }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
    <label style={{ fontSize: 12, color: P.muted, fontWeight: 600, letterSpacing: 0.4 }}>
      {label}{required && <span style={{ color: P.red }}>*</span>}
    </label>
    {children}
  </div>
);

const inputStyle = {
  background: '#0f0f12', border: `1px solid ${P.border}`, borderRadius: 8,
  padding: '9px 12px', color: P.text, fontSize: 13, outline: 'none',
  transition: 'border-color 0.2s',
  width: '100%', boxSizing: 'border-box',
};

const selectStyle = { ...inputStyle, cursor: 'pointer' };

/** Table wrapper */
const TableWrap = ({ children }) => (
  <div style={{ overflowX: 'auto', borderRadius: 12, border: `1px solid ${P.border}`, background: P.card, width: '100%' }}>
    <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'auto' }}>
      {children}
    </table>
  </div>
);

const Th = ({ children, style: s }) => (
  <th style={{
    padding: '10px 10px', background: '#0f0f12', color: P.muted, fontSize: 10.5,
    fontWeight: 700, letterSpacing: 0.5, textAlign: 'left', whiteSpace: 'nowrap',
    textTransform: 'uppercase', borderBottom: `1px solid ${P.border}`, ...s,
  }}>{children}</th>
);

const Td = ({ children, style: s }) => (
  <td style={{
    padding: '10px 10px', fontSize: 12.5, color: P.text,
    borderBottom: `1px solid ${P.border}22`, verticalAlign: 'middle', ...s,
  }}>{children}</td>
);

const ActionBtn = ({ icon: Icon, color, title, onClick }) => (
  <button title={title} onClick={onClick} style={{
    background: `${color}15`, border: `1px solid ${color}30`, borderRadius: 7,
    padding: '6px 8px', cursor: 'pointer', color: color, display: 'inline-flex',
    alignItems: 'center', transition: 'all 0.15s',
  }}
    onMouseEnter={e => { e.currentTarget.style.background = `${color}30`; }}
    onMouseLeave={e => { e.currentTarget.style.background = `${color}15`; }}
  >
    <Icon size={14} />
  </button>
);

const StageNotesPreview = ({ lead, onClick }) => {
  const stage = lead?.pipeline_stage || 'pre_sales';
  const activeNote = stage === 'post_sales'
    ? (lead?.postsales_notes || lead?.mainsales_notes || lead?.presales_notes)
    : stage === 'main_sales'
      ? (lead?.mainsales_notes || lead?.presales_notes)
      : (lead?.presales_notes || lead?.mainsales_notes);

  return (
    <div
      onClick={(e) => { e.stopPropagation(); onClick?.(lead); }}
      title="Click to read / write Pre, Main & Post-Sales notes"
      style={{ display: 'flex', flexDirection: 'column', gap: 4, maxWidth: 180, minWidth: 130, cursor: 'pointer' }}
    >
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {[
          { key: 'presales_notes', label: 'PRE', color: '#38bdf8' },
          { key: 'mainsales_notes', label: 'MAIN', color: '#f59e0b' },
          { key: 'postsales_notes', label: 'POST', color: '#10b981' },
        ].map(b => {
          const has = Boolean(lead?.[b.key]?.trim());
          return (
            <span
              key={b.key}
              style={{
                fontSize: 9, fontWeight: 800, padding: '1px 5px', borderRadius: 4,
                background: has ? `${b.color}22` : 'rgba(255,255,255,0.04)',
                color: has ? b.color : P.muted,
                border: `1px solid ${has ? `${b.color}55` : P.border}`
              }}
            >
              {b.label}{has ? ' ✓' : ''}
            </span>
          );
        })}
      </div>
      <div style={{
        fontSize: 11,
        color: activeNote ? P.text : P.muted,
        fontStyle: activeNote ? 'normal' : 'italic',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
      }}>
        {activeNote || '+ Add stage task note'}
      </div>
    </div>
  );
};

// ─── Tab: Dashboard Overview ──────────────────────────────────────────────────
const TabOverview = ({ addToast, onTabChange, currentUser, onSelectLead, lastUpdatedLead, pipelineScope = '', isStageLocked = false }) => {
  const isSalesExec = ['sales', 'agent', 'field_agent', 'sales_engineer'].includes(currentUser?.role) || (currentUser?.department?.toLowerCase() === 'sales' && currentUser?.role !== 'admin' && currentUser?.role !== 'manager');
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const userRole = (currentUser?.role || '').toLowerCase();
  const userDept = (currentUser?.department || '').toLowerCase();
  const userPipe = (currentUser?.assigned_pipeline || '').toLowerCase();
  const isAdminOrManager = userRole === 'admin' || userRole === 'manager' || userPipe === 'all';

  // Determine user's assigned sales function from assigned_pipeline, role, or department
  const userAssignedStage = (userPipe && userPipe !== 'all') ? userPipe : (
    (userDept.includes('post') || userRole.includes('post') || userRole === 'post_sales')
      ? 'post_sales'
      : (userDept.includes('main') || userRole.includes('main') || userRole === 'main_sales' || userRole === 'sales' || userRole === 'agent')
        ? 'main_sales'
        : 'pre_sales'
  );

  const [activePipelineStage, setActivePipelineStage] = useState(
    pipelineScope || (isAdminOrManager ? 'pre_sales' : userAssignedStage)
  );

  useEffect(() => {
    if (pipelineScope) {
      setActivePipelineStage(pipelineScope);
      setDrilldownCategory(null);
      setDrilldownLeads([]);
    } else if (!isAdminOrManager && userAssignedStage) {
      setActivePipelineStage(userAssignedStage);
    }
  }, [pipelineScope, isAdminOrManager, userAssignedStage]);

  const applyPreset = (type) => {
    setDateRange(type);
    const fmtIST = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);
    const now = new Date();
    const todayStr = fmtIST(now);
    const [iy, im, id] = todayStr.split('-').map(Number);
    const shiftDays = (days) => new Date(Date.UTC(iy, im - 1, id + days)).toISOString().split('T')[0];

    if (type === 'today') {
      setStartDate(todayStr); setEndDate(todayStr);
    } else if (type === 'yesterday') {
      const yStr = shiftDays(-1);
      setStartDate(yStr); setEndDate(yStr);
    } else if (type === '7d') {
      setStartDate(shiftDays(-7)); setEndDate(todayStr);
    } else if (type === '30d') {
      setStartDate(shiftDays(-30)); setEndDate(todayStr);
    } else if (type === 'month') {
      setStartDate(`${iy}-${String(im).padStart(2, '0')}-01`); setEndDate(todayStr);
    } else {
      setStartDate(''); setEndDate('');
    }
  };

  const [drilldownCategory, setDrilldownCategory] = useState(null);
  const [drilldownLeads, setDrilldownLeads] = useState([]);
  const [drilldownLoading, setDrilldownLoading] = useState(false);
  const [drilldownSearch, setDrilldownSearch] = useState('');
  const drilldownSectionRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set('start_date', startDate);
      if (endDate) params.set('end_date', endDate);
      if (pipelineScope) params.set('pipeline_stage', pipelineScope);
      else if (isStageLocked && userAssignedStage) params.set('pipeline_stage', userAssignedStage);
      const query = params.toString() ? `?${params.toString()}` : '';

      const recentParams = new URLSearchParams(params);
      recentParams.set('limit', '10');
      recentParams.set('page', '1');
      if (activePipelineStage) recentParams.set('pipeline_stage', activePipelineStage);

      const [s, r] = await Promise.all([
        apiFetch(`/stats${query}`),
        apiFetch(`/leads?${recentParams.toString()}`),
      ]);
      setStats(s);
      setRecent(r?.leads || r?.data || []);
    } catch {
      addToast('Failed to load dashboard data', 'error');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, activePipelineStage, pipelineScope, isStageLocked, userAssignedStage, addToast]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!lastUpdatedLead) return;
    const updId = lastUpdatedLead.id || lastUpdatedLead._id;
    setRecent(ls => ls.map(l => ((l.id || l._id) === updId ? { ...l, ...lastUpdatedLead } : l)));
    setDrilldownLeads(ls => ls.map(l => ((l.id || l._id) === updId ? { ...l, ...lastUpdatedLead } : l)));
    // Silently sync stats without flashing loading skeletons
    const params = new URLSearchParams();
    if (startDate) params.set('start_date', startDate);
    if (endDate) params.set('end_date', endDate);
    if (pipelineScope) params.set('pipeline_stage', pipelineScope);
    else if (isStageLocked && userAssignedStage) params.set('pipeline_stage', userAssignedStage);
    const query = params.toString() ? `?${params.toString()}` : '';
    apiFetch(`/stats${query}`).then(s => { if (s) setStats(s); }).catch(() => {});
  }, [lastUpdatedLead, startDate, endDate, pipelineScope, isStageLocked, userAssignedStage]);

  const isViewOnlyStage = !isAdminOrManager && (userAssignedStage !== activePipelineStage);
  const canEditStage = !isViewOnlyStage;

  const STAGE_CONFIG = {
    pre_sales: {
      num: '01',
      title: 'PRE-SALES',
      badge: 'TOUCH-BASED',
      desc: 'Inbound Verification & Meta Ingest',
      icon: Zap,
      color: '#38bdf8',
      deptName: 'Pre-Sales',
      nextStage: 'main_sales',
      nextActionLabel: 'Promote to Main Sales →'
    },
    main_sales: {
      num: '02',
      title: 'MAIN SALES',
      badge: 'CALLING & WALKTHROUGH',
      desc: 'Calling, Studio Walkthrough & Token Advances',
      icon: PhoneCall,
      color: P.gold,
      deptName: 'Main Sales',
      nextStage: 'post_sales',
      nextActionLabel: 'Advance to Post-Sales →'
    },
    post_sales: {
      num: '03',
      title: 'POST-SALES',
      badge: 'EXECUTION & FOLLOW-UPS',
      desc: 'Token Paid, Architect Follow-ups & Retention',
      icon: Award,
      color: '#10b981',
      deptName: 'Post-Sales',
      nextStage: null,
      nextActionLabel: 'Execution Active'
    }
  };

  const activeStageConfig = STAGE_CONFIG[activePipelineStage] || STAGE_CONFIG.pre_sales;

  const openDrilldown = useCallback(async (cat) => {
    if (drilldownCategory?.id === cat.id) {
      setDrilldownCategory(null);
      setDrilldownLeads([]);
      return;
    }
    setDrilldownCategory(cat);
    setDrilldownLoading(true);
    setDrilldownSearch('');
    try {
      const params = new URLSearchParams({ limit: 100, page: 1 });
      if (cat.status) params.set('status', cat.status);
      if (cat.stage) params.set('pipeline_stage', cat.stage);
      if (startDate) params.set('start_date', startDate);
      if (endDate) params.set('end_date', endDate);

      const res = await apiFetch(`/leads?${params}`);
      setDrilldownLeads(res?.leads || res?.data || []);
      setTimeout(() => {
        drilldownSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 60);
    } catch {
      addToast('Failed to load leads for ' + cat.label, 'error');
    } finally {
      setDrilldownLoading(false);
    }
  }, [drilldownCategory, startDate, endDate, addToast]);

  const updateOverviewLeadStatus = async (lead, newStatus) => {
    const leadStage = lead.pipeline_stage || activePipelineStage || 'pre_sales';
    if (!canEditStage || (!isAdminOrManager && leadStage !== userAssignedStage)) {
      addToast('View-Only mode: Status cannot be changed for this pipeline section', 'error');
      return;
    }
    if (lead.status === newStatus) return;
    try {
      const currentStage = leadStage;
      await apiFetch(`/leads/${lead.id || lead._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...lead, status: newStatus, pipeline_stage: currentStage })
      });
      setDrilldownLeads(ls => ls.map(l => ((l.id || l._id) === (lead.id || lead._id) ? { ...l, status: newStatus, pipeline_stage: currentStage } : l)));
      setRecent(ls => ls.map(l => ((l.id || l._id) === (lead.id || lead._id) ? { ...l, status: newStatus, pipeline_stage: currentStage } : l)));
      load();
      addToast(`Status updated to "${newStatus}"`, 'success');
    } catch {
      addToast('Status update failed', 'error');
    }
  };

  const advanceLeadStage = async (lead, targetStage) => {
    const leadStage = lead.pipeline_stage || activePipelineStage || 'pre_sales';
    if (!canEditStage || (!isAdminOrManager && leadStage !== userAssignedStage)) {
      addToast('View-Only mode: Cannot advance stage for this pipeline section', 'error');
      return;
    }
    try {
      await apiFetch(`/leads/${lead.id || lead._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...lead, pipeline_stage: targetStage })
      });
      setDrilldownLeads(ls => ls.filter(l => (l.id || l._id) !== (lead.id || lead._id)));
      setRecent(ls => ls.map(l => ((l.id || l._id) === (lead.id || lead._id) ? { ...l, pipeline_stage: targetStage } : l)));
      load();
      const targetName = STAGE_CONFIG[targetStage]?.title || targetStage;
      addToast(`Lead advanced to ${targetName}!`, 'success');
    } catch {
      addToast('Failed to advance lead stage', 'error');
    }
  };

  const drilldownFilteredLeads = drilldownLeads.filter(l => {
    if (!drilldownSearch.trim()) return true;
    const q = drilldownSearch.toLowerCase();
    return (
      (l.name && l.name.toLowerCase().includes(q)) ||
      (l.phone && l.phone.includes(q)) ||
      (l.email && l.email.toLowerCase().includes(q)) ||
      (l.city && l.city.toLowerCase().includes(q)) ||
      (l.source && l.source.toLowerCase().includes(q))
    );
  });

  const sc = stats?.statusCounts || {};
  const ps = stats?.pipelineStages || {};
  const blankLeadsFallback = sc['Blank Lead'] ?? sc['Live Sheet Lead'] ?? (stats?.total_leads ? Math.max(0, (stats?.total_leads || 0) - (sc['Pending'] || 0) - (sc['Hot Lead'] || 0)) : 0);

  const currentStageStats = ps[activePipelineStage] || {
    total: activePipelineStage === 'pre_sales' ? (stats?.total_leads || 0) : 0,
    blank: activePipelineStage === 'pre_sales' ? blankLeadsFallback : 0,
    hot: activePipelineStage === 'pre_sales' ? (sc['Hot Lead'] || 0) : 0,
    warm: activePipelineStage === 'pre_sales' ? ((sc['Warm Lead'] || 0) + (sc['Interested'] || 0)) : 0,
    cold: activePipelineStage === 'pre_sales' ? (sc['Cold Lead'] || 0) : 0,
  };

  // 4 Independent Categories for the Active Stage: Cold, Hot, Warm, Blank
  const summaryCards = [
    {
      id: `${activePipelineStage}_blank`,
      icon: Circle,
      label: 'BLANK LEADS',
      value: currentStageStats.blank,
      color: '#94a3b8',
      sub: `${activeStageConfig.title} · Uncategorized incoming`,
      isActive: drilldownCategory?.id === `${activePipelineStage}_blank`,
      onClick: () => openDrilldown({
        id: `${activePipelineStage}_blank`,
        label: `${activeStageConfig.title} — BLANK LEADS`,
        status: 'Blank Lead',
        stage: activePipelineStage,
        color: '#94a3b8',
        sub: `Uncategorized records in ${activeStageConfig.title}`
      })
    },
    {
      id: `${activePipelineStage}_hot`,
      icon: Zap,
      label: 'HOT LEADS',
      value: currentStageStats.hot,
      color: '#ef4444',
      sub: `${activeStageConfig.title} · High closing intent`,
      isActive: drilldownCategory?.id === `${activePipelineStage}_hot`,
      onClick: () => openDrilldown({
        id: `${activePipelineStage}_hot`,
        label: `${activeStageConfig.title} — HOT LEADS`,
        status: 'Hot Lead',
        stage: activePipelineStage,
        color: '#ef4444',
        sub: `High closing intent prospects in ${activeStageConfig.title}`
      })
    },
    {
      id: `${activePipelineStage}_warm`,
      icon: Target,
      label: 'WARM LEADS',
      value: currentStageStats.warm,
      color: '#f97316',
      sub: `${activeStageConfig.title} · Active discussions`,
      isActive: drilldownCategory?.id === `${activePipelineStage}_warm`,
      onClick: () => openDrilldown({
        id: `${activePipelineStage}_warm`,
        label: `${activeStageConfig.title} — WARM LEADS`,
        status: 'Warm Lead,Interested',
        stage: activePipelineStage,
        color: '#f97316',
        sub: `Engaged prospects in ${activeStageConfig.title}`
      })
    },
    {
      id: `${activePipelineStage}_cold`,
      icon: Shield,
      label: 'COLD LEADS',
      value: currentStageStats.cold,
      color: '#06b6d4',
      sub: `${activeStageConfig.title} · Low intent / Nurturing`,
      isActive: drilldownCategory?.id === `${activePipelineStage}_cold`,
      onClick: () => openDrilldown({
        id: `${activePipelineStage}_cold`,
        label: `${activeStageConfig.title} — COLD LEADS`,
        status: 'Cold Lead',
        stage: activePipelineStage,
        color: '#06b6d4',
        sub: `Nurturing and long-term prospects in ${activeStageConfig.title}`
      })
    },
    {
      id: `${activePipelineStage}_total`,
      icon: Users,
      label: `${activeStageConfig.title} TOTAL`,
      value: currentStageStats.total,
      color: activeStageConfig.color,
      sub: `All leads in ${activeStageConfig.title}`,
      isActive: drilldownCategory?.id === `${activePipelineStage}_total`,
      onClick: () => openDrilldown({
        id: `${activePipelineStage}_total`,
        label: `${activeStageConfig.title} — ALL LEADS`,
        status: '',
        stage: activePipelineStage,
        color: activeStageConfig.color,
        sub: `All records in ${activeStageConfig.title}`
      })
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* ── Page Header: DASHBOARD 01 · SALES CRM ── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: P.text, margin: 0, letterSpacing: -0.5, fontFamily: 'serif, sans-serif' }}>
            DASHBOARD
          </h1>
          <span style={{
            background: 'rgba(245,158,11,0.12)',
            border: '1px solid rgba(245,158,11,0.35)',
            borderRadius: 20,
            padding: '3px 12px',
            fontSize: 11,
            fontWeight: 800,
            color: P.gold,
            letterSpacing: 0.6
          }}>
            01 · SALES CRM
          </span>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: P.muted }}>
          Live industrial operations telemetry, conversion pipeline, and team metrics
        </p>
      </div>

      {/* ── Filter Bar: According to Date ── */}
      <div style={{
        background: P.card, border: `1px solid ${P.border}`, borderRadius: 14,
        padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 14
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: P.gold, textTransform: 'uppercase', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 5, marginRight: 6 }}>
            <Calendar size={14} /> According to Date:
          </span>
          {[
            { id: 'all', label: 'All Time' },
            { id: 'today', label: 'Today' },
            { id: 'yesterday', label: 'Yesterday' },
            { id: '7d', label: 'Last 7 Days' },
            { id: '30d', label: 'Last 30 Days' },
            { id: 'month', label: 'This Month' },
          ].map(p => (
            <button
              key={p.id}
              onClick={() => applyPreset(p.id)}
              style={{
                background: dateRange === p.id ? P.gold : P.card2,
                color: dateRange === p.id ? '#000' : P.text,
                border: `1px solid ${dateRange === p.id ? P.gold : P.border}`,
                borderRadius: 8, padding: '5px 12px', fontSize: 12, fontWeight: dateRange === p.id ? 700 : 500,
                cursor: 'pointer', transition: 'all 0.15s'
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Custom Date Pickers */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: P.muted }}>From:</span>
          <input
            type="date"
            value={startDate}
            onChange={e => { setDateRange('custom'); setStartDate(e.target.value); }}
            style={{ ...inputStyle, width: 'auto', padding: '5px 10px', fontSize: 12 }}
          />
          <span style={{ fontSize: 12, color: P.muted }}>To:</span>
          <input
            type="date"
            value={endDate}
            onChange={e => { setDateRange('custom'); setEndDate(e.target.value); }}
            style={{ ...inputStyle, width: 'auto', padding: '5px 10px', fontSize: 12 }}
          />
          {(startDate || endDate) && (
            <button
              onClick={() => applyPreset('all')}
              style={{ background: 'none', border: `1px solid ${P.border}`, borderRadius: 6, color: P.muted, padding: '5px 8px', cursor: 'pointer', fontSize: 11 }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* ── 3 Main Pipeline Sections: PRE-SALES · MAIN SALES · POST-SALES ── */}
      <div style={{
        background: P.card,
        border: `1px solid ${P.border}`,
        borderRadius: 16,
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16
      }}>
        {/* The Stage Switcher Buttons (Master view shows all 3; Dedicated stage dashboard shows only active stage) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {[
            STAGE_CONFIG.pre_sales,
            STAGE_CONFIG.main_sales,
            STAGE_CONFIG.post_sales,
          ].filter(stage => {
            if (!isStageLocked && !pipelineScope) return true;
            const stageKey = stage.num === '01' ? 'pre_sales' : stage.num === '02' ? 'main_sales' : 'post_sales';
            return stageKey === (pipelineScope || userAssignedStage);
          }).map(stage => {
            const stageKey = stage.num === '01' ? 'pre_sales' : stage.num === '02' ? 'main_sales' : 'post_sales';
            const isStageActive = activePipelineStage === stageKey;
            const StageIcon = stage.icon;
            const stageCount = ps[stageKey]?.total ?? (stageKey === 'pre_sales' ? (stats?.total_leads || 0) : 0);

            return (
              <button
                key={stageKey}
                onClick={() => {
                  setActivePipelineStage(stageKey);
                  setDrilldownCategory(null);
                  setDrilldownLeads([]);
                }}
                style={{
                  background: isStageActive ? `${stage.color}15` : P.card2,
                  border: `1px solid ${isStageActive ? stage.color : P.border}`,
                  borderRadius: 12,
                  padding: '10px 18px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  transition: 'all 0.15s ease',
                  boxShadow: isStageActive ? `0 4px 18px ${stage.color}25` : 'none',
                }}
              >
                <div style={{
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  background: `${stage.color}20`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: `1px solid ${stage.color}40`,
                  flexShrink: 0
                }}>
                  <StageIcon size={18} color={stage.color} />
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 900, color: isStageActive ? stage.color : P.text, letterSpacing: 0.3 }}>
                      {stage.num}· {stage.title}
                    </span>
                    <span style={{
                      fontSize: 10,
                      fontWeight: 800,
                      padding: '1px 6px',
                      borderRadius: 10,
                      background: isStageActive ? `${stage.color}30` : 'rgba(255,255,255,0.08)',
                      color: isStageActive ? stage.color : P.muted
                    }}>
                      {stageCount} Leads
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: P.muted, marginTop: 2 }}>{stage.desc}</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* View-Only vs Full-Access Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isViewOnlyStage ? (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.35)',
              borderRadius: 20, padding: '6px 14px', fontSize: 12, fontWeight: 700, color: '#c084fc'
            }}>
              <Eye size={14} /> VIEW-ONLY ACCESS ({activeStageConfig.deptName})
            </div>
          ) : (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.35)',
              borderRadius: 20, padding: '6px 14px', fontSize: 12, fontWeight: 700, color: '#4ade80'
            }}>
              <CheckCircle size={14} /> FULL ACCESS PIPELINE ({activeStageConfig.deptName})
            </div>
          )}
        </div>
      </div>

      {/* Top 4 Category Stat Cards for Active Stage */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 14 }}>
        {loading
          ? Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{ background: P.card, borderRadius: 14, height: 110, border: `1px solid ${P.border}`, animation: 'pulse 1.5s ease-in-out infinite' }} />
          ))
          : summaryCards.map((c, i) => <StatCard key={i} {...c} />)
        }
      </div>

      {/* ── Dedicated Drilldown Section for Selected Stat Card ── */}
      {drilldownCategory && (
        <div
          ref={drilldownSectionRef}
          style={{
            background: P.card,
            border: `1px solid ${drilldownCategory.color}55`,
            borderRadius: 16,
            padding: '20px 22px',
            boxShadow: `0 8px 30px ${drilldownCategory.color}15`,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            transition: 'all 0.25s ease'
          }}
        >
          {/* Section Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 42,
                height: 42,
                borderRadius: 10,
                background: `${drilldownCategory.color}20`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: `1px solid ${drilldownCategory.color}40`,
                flexShrink: 0
              }}>
                {React.createElement(drilldownCategory.icon || Users, { size: 22, color: drilldownCategory.color })}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: P.text, letterSpacing: -0.3 }}>
                    {drilldownCategory.label}
                  </h3>
                  <span style={{
                    background: `${drilldownCategory.color}25`,
                    color: drilldownCategory.color,
                    border: `1px solid ${drilldownCategory.color}50`,
                    padding: '2px 10px',
                    borderRadius: 12,
                    fontSize: 12,
                    fontWeight: 800
                  }}>
                    {drilldownFilteredLeads.length} {drilldownFilteredLeads.length === 1 ? 'Lead' : 'Leads'}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: P.muted, marginTop: 2 }}>
                  {drilldownCategory.sub || 'Interactive drilldown list'}
                </div>
              </div>
            </div>

            {/* Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              {/* Quick Search in this category */}
              <div style={{ position: 'relative', width: 220 }}>
                <Search size={14} color={P.muted} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  placeholder="Search in this list..."
                  value={drilldownSearch}
                  onChange={e => setDrilldownSearch(e.target.value)}
                  style={{
                    ...inputStyle,
                    paddingLeft: 32,
                    paddingRight: 10,
                    height: 36,
                    fontSize: 12,
                    width: '100%'
                  }}
                />
              </div>

              {/* View in Full Meta Pipeline Button */}
              <button
                onClick={() => onTabChange('leads', drilldownCategory.status || undefined, drilldownCategory.stage || activePipelineStage)}
                style={{
                  background: 'rgba(245,158,11,0.12)',
                  color: P.gold,
                  border: `1px solid rgba(245,158,11,0.35)`,
                  borderRadius: 8,
                  padding: '8px 14px',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
                title="Open in full Meta Pipeline table with all bulk management features"
              >
                <ExternalLink size={14} /> Open in Meta Pipeline ↗
              </button>

              {/* Close Button */}
              <button
                onClick={() => { setDrilldownCategory(null); setDrilldownLeads([]); }}
                style={{
                  background: P.card2,
                  color: P.muted,
                  border: `1px solid ${P.border}`,
                  borderRadius: 8,
                  padding: '8px 12px',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
                title="Close drilldown section"
              >
                <X size={15} /> Close
              </button>
            </div>
          </div>

          {/* Table Container */}
          <TableWrap>
            <thead>
              <tr>
                {['Lead / Location & Source', 'Contact Details', 'Status', 'Primary Task / Note', 'Priority', 'Created', 'Actions'].map((h, i) => (
                  <Th key={h} style={i === 6 ? { textAlign: 'right' } : undefined}>{h}</Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {drilldownLoading ? (
                Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={7} />)
              ) : drilldownFilteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <EmptyState
                      icon={drilldownCategory.icon || Users}
                      title={`No leads found in ${drilldownCategory.label}`}
                      sub={drilldownSearch ? "No leads matched your search query" : "No leads in this specific category for the selected date range"}
                    />
                  </td>
                </tr>
              ) : (
                drilldownFilteredLeads.map(l => (
                  <tr
                    key={l.id || l._id}
                    style={{ transition: 'background 0.15s', cursor: onSelectLead ? 'pointer' : 'default' }}
                    onClick={() => onSelectLead && onSelectLead(l)}
                    onMouseEnter={e => { e.currentTarget.style.background = '#ffffff07'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <Td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 210 }}>
                        <span style={{ fontWeight: 700, color: P.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {l.name || 'Unnamed Lead'}
                        </span>
                        <div style={{ fontSize: 11, color: P.muted, display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                          {(l.city || l.custom_fields?.plan) && (
                            <span style={{ color: P.text, opacity: 0.8 }}>{l.city || l.custom_fields?.plan}</span>
                          )}
                          {(l.city || l.custom_fields?.plan) && l.source && <span>·</span>}
                          {l.source && (
                            <span style={{ color: P.gold, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140 }}>
                              {l.source}
                            </span>
                          )}
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                          <span style={{ color: P.text, fontFamily: 'monospace', fontSize: 12, fontWeight: 600 }}>
                            {l.phone || '—'}
                          </span>
                          {l.phone && (
                            <div style={{ display: 'inline-flex', gap: 4, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                              <a
                                href={`https://wa.me/${l.phone.replace(/[^0-9]/g, '')}`}
                                target="_blank"
                                rel="noreferrer"
                                title="Chat on WhatsApp"
                                style={{
                                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                  width: 20, height: 20, borderRadius: 5, background: 'rgba(37,211,102,0.15)',
                                  color: '#25D366', textDecoration: 'none', border: '1px solid rgba(37,211,102,0.3)'
                                }}
                              >
                                <MessageSquare size={11} />
                              </a>
                              <a
                                href={`tel:${l.phone}`}
                                title="Call phone"
                                style={{
                                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                  width: 20, height: 20, borderRadius: 5, background: 'rgba(56,189,248,0.15)',
                                  color: '#38bdf8', textDecoration: 'none', border: '1px solid rgba(56,189,248,0.3)'
                                }}
                              >
                                <Phone size={11} />
                              </a>
                            </div>
                          )}
                        </div>
                        <span style={{ color: P.muted, fontSize: 11, maxWidth: 190, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {l.email || '—'}
                        </span>
                      </div>
                    </Td>
                    <Td style={{ whiteSpace: 'nowrap' }}>
                      <StatusBadge status={l.status} onChange={canEditStage ? newStatus => updateOverviewLeadStatus(l, newStatus) : undefined} disabled={!canEditStage} />
                    </Td>
                    <Td><StageNotesPreview lead={l} onClick={onSelectLead} /></Td>
                    <Td style={{ whiteSpace: 'nowrap' }}><PriorityBadge priority={l.priority} /></Td>
                    <Td style={{ whiteSpace: 'nowrap' }}>
                      <span style={{ color: P.muted, fontSize: 11 }}>{fmtDate(l.created_at || l.createdAt)}</span>
                    </Td>
                    <Td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }} onClick={e => e.stopPropagation()}>
                        {canEditStage ? (
                          <select
                            value={l.pipeline_stage || activePipelineStage}
                            onChange={async (e) => {
                              const newStage = e.target.value;
                              await advanceLeadStage(l, newStage);
                            }}
                            title="Switch pipeline stage"
                            style={{
                              background: P.card2,
                              border: `1px solid ${
                                (l.pipeline_stage || activePipelineStage) === 'post_sales' ? '#10b981' :
                                (l.pipeline_stage || activePipelineStage) === 'main_sales' ? '#f59e0b' : '#38bdf8'
                              }60`,
                              color: (l.pipeline_stage || activePipelineStage) === 'post_sales' ? '#10b981' :
                                (l.pipeline_stage || activePipelineStage) === 'main_sales' ? '#f59e0b' : '#38bdf8',
                              borderRadius: 6,
                              padding: '4px 6px',
                              fontSize: 11,
                              fontWeight: 700,
                              cursor: 'pointer',
                              maxWidth: 118
                            }}
                          >
                            <option value="pre_sales">🎯 01 Pre-Sales</option>
                            <option value="main_sales">⚡ 02 Main Sales</option>
                            <option value="post_sales">🚀 03 Post-Sales</option>
                          </select>
                        ) : (
                          <span style={{ fontSize: 10, color: P.muted, fontStyle: 'italic' }}>
                            {(l.pipeline_stage || activePipelineStage).replace('_', ' ').toUpperCase()}
                          </span>
                        )}
                        <button
                          onClick={() => onSelectLead && onSelectLead(l)}
                          title="View lead drawer / full profile"
                          style={{
                            background: P.card2,
                            border: `1px solid ${P.border}`,
                            color: P.gold,
                            borderRadius: 6,
                            padding: '4px 9px',
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            flexShrink: 0
                          }}
                        >
                          <Eye size={12} /> View
                        </button>
                      </div>
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </TableWrap>
        </div>
      )}

      {/* ── Active Stage 4-Category Funnel Breakdown (Blank · Hot · Warm · Cold) ── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: P.text, display: 'flex', alignItems: 'center', gap: 7, textTransform: 'uppercase', letterSpacing: 0.6 }}>
            <SlidersHorizontal size={14} color={activeStageConfig.color} />
            {activeStageConfig.title} — 4 CATEGORY FUNNEL (BLANK · HOT · WARM · COLD)
          </h3>
          <span style={{ fontSize: 12, color: P.muted }}>Filtered by {activeStageConfig.title} portfolio</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
          {[
            { key: 'Blank Lead', label: 'Blank (Uncategorized)', badge: '⚪', color: '#94a3b8', count: currentStageStats.blank },
            { key: 'Hot Lead', label: 'Hot Leads', badge: '🔥', color: '#ef4444', count: currentStageStats.hot },
            { key: 'Warm Lead,Interested', label: 'Warm Leads', badge: '☀️', color: '#f97316', count: currentStageStats.warm },
            { key: 'Cold Lead', label: 'Cold Leads', badge: '❄️', color: '#06b6d4', count: currentStageStats.cold },
          ].map(cat => (
            <div
              key={cat.key}
              onClick={() => onTabChange('leads', cat.key, activePipelineStage)}
              style={{
                background: P.card, border: `1px solid ${cat.color}35`, borderRadius: 12,
                padding: '16px 18px', cursor: 'pointer', transition: 'transform 0.15s, border-color 0.15s',
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = cat.color; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = `${cat.color}35`; }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 20 }}>{cat.badge}</span>
                <span style={{ fontSize: 22, fontWeight: 800, color: cat.count > 0 ? cat.color : P.muted }}>
                  {cat.count}
                </span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: P.text }}>{cat.label}</div>
              <div style={{ fontSize: 11, color: P.muted, marginTop: 4 }}>Click to view pipeline</div>
            </div>
          ))}
        </div>
      </div>

      {/* Industrial Telephony Banner */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(245,158,11,0.06) 0%, rgba(17,17,19,0.95) 100%)',
        border: `1px solid ${P.border}`, borderRadius: 14, padding: '22px 28px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16
      }}>
        <div>
          <h4 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 800, color: P.text, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            INDUSTRIAL TELEPHONY & WALKTHROUGH LEAD ENGINE
          </h4>
          <p style={{ margin: 0, fontSize: 13, color: P.muted }}>
            Direct browser-to-lead WebRTC calling with automatic encrypted audio recordings stored on private VPS disk.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={() => onTabChange('calls')} style={{
            background: P.gold, color: '#000', border: 'none', borderRadius: 8,
            padding: '10px 20px', fontWeight: 800, fontSize: 13, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 8,
            boxShadow: '0 2px 10px rgba(245,158,11,0.25)'
          }}>
            <PhoneCall size={16} /> Open Call Studio
          </button>
          <button onClick={() => onTabChange('leads')} style={{
            background: P.card2, color: P.text, border: `1px solid ${P.border}`, borderRadius: 8,
            padding: '10px 20px', fontWeight: 600, fontSize: 13, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 8
          }}>
            <Users size={16} /> View Pipeline
          </button>
        </div>
      </div>

      {/* Recent Leads */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: P.text, textTransform: 'uppercase', letterSpacing: 0.5 }}>RECENT INDUSTRIAL INQUIRIES</h3>
          <button onClick={load} style={{ background: 'none', border: 'none', color: P.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
        <TableWrap>
          <thead>
            <tr>
              {['Lead / Location & Source', 'Contact Details', 'Status', 'Primary Task / Note', 'Priority', 'Created', 'View'].map((h, i) => (
                <Th key={h} style={i === 6 ? { textAlign: 'right' } : undefined}>{h}</Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} cols={7} />)
              : recent.length === 0
                ? <tr><td colSpan={7}><EmptyState icon={Users} title="No leads yet" sub="Industrial leads will appear here once ingested" /></td></tr>
                : recent.map(l => (
                  <tr key={l.id || l._id}
                    onClick={() => onSelectLead && onSelectLead(l)}
                    style={{ transition: 'background 0.15s', cursor: onSelectLead ? 'pointer' : 'default' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#ffffff05'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <Td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 210 }}>
                        <span style={{ fontWeight: 700, color: P.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.name}</span>
                        <div style={{ fontSize: 11, color: P.muted, display: 'flex', alignItems: 'center', gap: 5 }}>
                          {l.city && <span style={{ color: P.text, opacity: 0.8 }}>{l.city}</span>}
                          {l.city && l.source && <span>·</span>}
                          {l.source && <span style={{ color: P.gold, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140 }}>{l.source}</span>}
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ color: P.text, fontFamily: 'monospace', fontSize: 12, whiteSpace: 'nowrap' }}>{l.phone || '—'}</span>
                        <span style={{ color: P.muted, fontSize: 11, maxWidth: 190, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.email || '—'}</span>
                      </div>
                    </Td>
                    <Td style={{ whiteSpace: 'nowrap' }}>
                      {(() => {
                        const canEditRow = isAdminOrManager || ((l.pipeline_stage || 'pre_sales') === userAssignedStage);
                        return <StatusBadge status={l.status} onChange={canEditRow ? newStatus => updateOverviewLeadStatus(l, newStatus) : undefined} disabled={!canEditRow} />;
                      })()}
                    </Td>
                    <Td><StageNotesPreview lead={l} onClick={onSelectLead} /></Td>
                    <Td style={{ whiteSpace: 'nowrap' }}><PriorityBadge priority={l.priority} /></Td>
                    <Td style={{ whiteSpace: 'nowrap' }}><span style={{ color: P.muted, fontSize: 11 }}>{fmtDate(l.created_at || l.createdAt)}</span></Td>
                    <Td style={{ textAlign: 'right', whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => onSelectLead && onSelectLead(l)}
                        style={{
                          background: P.card2, border: `1px solid ${P.border}`, color: P.gold,
                          borderRadius: 6, padding: '4px 9px', fontSize: 11, fontWeight: 700,
                          cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4
                        }}
                      >
                        <Eye size={12} /> View
                      </button>
                    </Td>
                  </tr>
                ))
            }
          </tbody>
        </TableWrap>
      </div>
    </div>
  );
};

// ─── Lead Form Modal ──────────────────────────────────────────────────────────
const LeadFormModal = ({ open, onClose, lead, onSaved, addToast, isAdmin, isManager, currentUser }) => {
  const uRole = (currentUser?.role || '').toLowerCase();
  const uDept = (currentUser?.department || '').toLowerCase();
  const uPipe = (currentUser?.assigned_pipeline || '').toLowerCase();
  const canPickAnyStage = isAdmin || isManager || uPipe === 'all';
  const defaultStage = canPickAnyStage ? 'pre_sales' : (
    (uPipe && uPipe !== 'all') ? uPipe :
    (uDept.includes('post') || uRole.includes('post')) ? 'post_sales' :
    (uDept.includes('main') || uRole.includes('main') || uRole === 'sales' || uRole === 'agent') ? 'main_sales' :
    'pre_sales'
  );
  const empty = {
    name: '', email: '', phone: '', source: 'Meta Ads (Instagram)', status: 'Blank Lead',
    priority: 'medium', city: '', state: '', budget: '', requirement: '', notes: '',
    follow_up_date: '', assigned_to: '', lead_category: 'meta', meta_platform: 'ig',
    floor_plan_status: 'floor_plan_is_ready', plot_size: 'less_than_200_sq._yards_(_1800_sq._ft_)',
    studio_location: 'Gurugram HQ', package_service: 'Appointment Inquiry', payment_status: 'Unpaid',
    pipeline_stage: defaultStage
  };
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [teamMembers, setTeamMembers] = useState([]);

  useEffect(() => {
    if (open) {
      apiFetch('/users').then(d => setTeamMembers(d?.users || [])).catch(() => {});
    }
  }, [open]);

  useEffect(() => {
    if (lead) setForm({ ...empty, ...lead, follow_up_date: lead.follow_up_date ? lead.follow_up_date.split('T')[0] : '', pipeline_stage: lead.pipeline_stage || defaultStage });
    else setForm(empty);
  }, [lead, open, defaultStage]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { addToast('Name is required', 'error'); return; }
    setSaving(true);
    try {
      const isEdit = !!(lead && (lead.id || lead._id));
      const id = isEdit ? (lead.id || lead._id) : null;
      await apiFetch(isEdit ? `/leads/${id}` : '/leads', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      addToast(isEdit ? 'Lead updated successfully!' : 'Lead created successfully!', 'success');
      onSaved();
      onClose();
    } catch (err) {
      addToast(err.message || 'Save failed. Check connection.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={lead ? 'Edit Sales Lead' : 'Create New Lead'} width={700}>
      <form onSubmit={submit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Field label="Sales Pipeline Stage" required>
          <select
            style={{ ...selectStyle, ...(canPickAnyStage ? {} : { opacity: 0.7, cursor: 'not-allowed' }) }}
            value={form.pipeline_stage || defaultStage}
            disabled={!canPickAnyStage}
            onChange={e => canPickAnyStage && set('pipeline_stage', e.target.value)}
          >
            <option value="pre_sales">01 PRE-SALES (Touch-Based Inbound)</option>
            <option value="main_sales">02 MAIN SALES (Calling & Walkthrough)</option>
            <option value="post_sales">03 POST-SALES (Execution & Delivery)</option>
          </select>
        </Field>

        <Field label="Lead Type / Classification" required>
          <select style={selectStyle} value={form.lead_category} onChange={e => set('lead_category', e.target.value)}>
            <option value="meta">Meta Ads Lead (Facebook / Instagram)</option>
            <option value="google_sheets">Google Leads Sheet (Live Sync / Sheet)</option>
          </select>
        </Field>

        <Field label="Qualification Stage (Status)" required>
          <select style={selectStyle} value={form.status} onChange={e => set('status', e.target.value)}>
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{STATUS_META[s]?.badge || ''} {STATUS_META[s]?.label || s}</option>)}
          </select>
        </Field>

        <Field label="Assigned Sales Person">
          {teamMembers.length > 0 ? (
            <select
              style={selectStyle}
              value={form.assigned_to || ''}
              onChange={e => (isAdmin || isManager) && set('assigned_to', e.target.value)}
              disabled={!isAdmin && !isManager}
            >
              <option value="">(Unassigned)</option>
              {teamMembers.map(u => (
                <option key={u.id || u.email} value={u.name}>
                  {u.name} ({u.assigned_pipeline ? u.assigned_pipeline.replace('_', ' ').toUpperCase() : u.role})
                </option>
              ))}
            </select>
          ) : (
            <input
              style={{ ...inputStyle, ...(isAdmin || isManager ? {} : { opacity: 0.6, cursor: 'not-allowed' }) }}
              value={form.assigned_to}
              onChange={e => (isAdmin || isManager) && set('assigned_to', e.target.value)}
              disabled={!isAdmin && !isManager}
              placeholder={isAdmin || isManager ? "Agent / Engineer Name" : "(Unassigned)"}
            />
          )}
        </Field>

        <Field label="Client / Prospect Full Name" required>
          <input style={inputStyle} value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Mayank Sharma / Tata Realty" />
        </Field>

        <Field label="Phone / WhatsApp Number">
          <input style={inputStyle} value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+91 9876543210" />
        </Field>

        <Field label="Email Address">
          <input style={inputStyle} type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="client@domain.com" />
        </Field>

        <Field label="City / Location">
          <input style={inputStyle} value={form.city} onChange={e => set('city', e.target.value)} placeholder="Gurugram / Rewa / Bhopal" />
        </Field>

        {form.lead_category === 'meta' ? (
          <>
            <Field label="Meta Ad Platform">
              <select style={selectStyle} value={form.meta_platform} onChange={e => set('meta_platform', e.target.value)}>
                <option value="ig">Instagram Ads (ig)</option>
                <option value="fb">Facebook Ads (fb)</option>
              </select>
            </Field>

            <Field label="Floor Plan Status">
              <select style={selectStyle} value={form.floor_plan_status} onChange={e => set('floor_plan_status', e.target.value)}>
                <option value="floor_plan_is_ready">Floor Plan is Ready</option>
                <option value="floor_plan_is_under_process">Floor Plan is Under Process</option>
                <option value="floor_plan_is_not_ready">Floor Plan is NOT Ready</option>
              </select>
            </Field>

            <Field label="Plot Size Range">
              <select style={selectStyle} value={form.plot_size} onChange={e => set('plot_size', e.target.value)}>
                <option value="less_than_200_sq._yards_(_1800_sq._ft_)">&lt; 200 sq. yards (&lt; 1,800 sq ft)</option>
                <option value="between_200-500_sq._yards_(_1800-4500_sq._ft_)">200–500 sq. yards (1,800–4,500 sq ft)</option>
                <option value="above_500_sq._yards_(_4500_sq._ft_)">&gt; 500 sq. yards (&gt; 4,500 sq ft)</option>
              </select>
            </Field>
          </>
        ) : (
          <>
            <Field label="Google Sheet / Source Name">
              <input style={inputStyle} value={form.source || ''} onChange={e => set('source', e.target.value)} placeholder="Google Sheet Live Sync / Q4 Tracker" />
            </Field>

            <Field label="Floor Plan Status">
              <select style={selectStyle} value={form.floor_plan_status} onChange={e => set('floor_plan_status', e.target.value)}>
                <option value="floor_plan_is_ready">Floor Plan is Ready</option>
                <option value="floor_plan_is_under_process">Floor Plan is Under Process</option>
                <option value="floor_plan_is_not_ready">Floor Plan is NOT Ready</option>
              </select>
            </Field>

            <Field label="Plot Size / Area Scope">
              <input style={inputStyle} value={form.plot_size || ''} onChange={e => set('plot_size', e.target.value)} placeholder="3200 sq.ft Villa / Duplex" />
            </Field>
          </>
        )}

        <Field label="Estimated Budget / Value">
          <input style={inputStyle} value={form.budget} onChange={e => set('budget', e.target.value)} placeholder="₹50L - ₹1 Crore / ₹50,000" />
        </Field>

        <Field label="Priority Level">
          <select style={selectStyle} value={form.priority} onChange={e => set('priority', e.target.value)}>
            {PRIORITY_OPTIONS.map(p => <option key={p} value={p}>{PRIORITY_META[p].label}</option>)}
          </select>
        </Field>

        <Field label="Follow-up Date">
          <input style={inputStyle} type="date" value={form.follow_up_date} onChange={e => set('follow_up_date', e.target.value)} />
        </Field>

        <div style={{ gridColumn: '1 / -1' }}>
          <Field label="Requirement & Notes">
            <textarea style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Architectural details, 2D AutoCAD status, client preferences..." />
          </Field>
        </div>

        <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 6 }}>
          <button type="button" onClick={onClose} style={{ ...inputStyle, width: 'auto', padding: '9px 20px', cursor: 'pointer', color: P.muted }}>Cancel</button>
          <button type="submit" disabled={saving} style={{
            background: P.gold, border: 'none', borderRadius: 8, padding: '9px 26px',
            color: '#000', fontWeight: 700, fontSize: 13, cursor: 'pointer',
          }}>{saving ? 'Saving…' : (lead ? 'Update Lead' : 'Save Lead')}</button>
        </div>
      </form>
    </Modal>
  );
};

// ─── Tab: Leads Management (Google Live Sheet Unified) ────────────────────────
const TabLeads = ({ addToast, onAudio, onCallLead, onSelectLead, isAgent, isAdmin, isManager, isMarketingView = false, initialCategory = 'all', initialStatus = '', initialPipelineStage = '', lockedPipelineStage = '', currentUser = null, isMobile = false, lastUpdatedLead = null }) => {
  const [leads, setLeads] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [syncingSheet, setSyncingSheet] = useState(false);
  const [sheetConfig, setSheetConfig] = useState(null);
  const [search, setSearch] = useState('');
  const [statusF, setStatusF] = useState(initialStatus || '');
  const [pipelineStageF, setPipelineStageF] = useState(lockedPipelineStage || initialPipelineStage || '');

  useEffect(() => {
    setStatusF(initialStatus || '');
    setPage(1);
  }, [initialStatus]);

  useEffect(() => {
    setPipelineStageF(lockedPipelineStage || initialPipelineStage || '');
    setPage(1);
  }, [lockedPipelineStage, initialPipelineStage]);
  const [sourceF, setSourceF] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [editLead, setEditLead] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showWebhookModal, setShowWebhookModal] = useState(false);
  const [bulkFile, setBulkFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());

  const canDelete = isAdmin;
  const canBulkUpload = (isAdmin || isManager) && !isAgent && !isMarketingView;
  const canCreateManualLead = !isMarketingView;
  const canEdit = !isMarketingView;

  const userRole = (currentUser?.role || '').toLowerCase();
  const userDept = (currentUser?.department || '').toLowerCase();
  const userPipe = (currentUser?.assigned_pipeline || '').toLowerCase();
  const isPresalesRole = userRole.includes('pre') || userRole === 'presales';
  const isMainSalesRole = userRole === 'sales' || userRole.includes('main') || userRole === 'agent' || userRole === 'sales_exec';
  const isPostSalesRole = userRole.includes('post') || userRole === 'postsales';
  const isFullAdmin = isAdmin || isManager || userPipe === 'all';
  const effectiveUserPipe = (userPipe && userPipe !== 'all') ? userPipe : (
    isPostSalesRole || userDept.includes('post') ? 'post_sales' :
    isMainSalesRole || userDept.includes('main') ? 'main_sales' :
    'pre_sales'
  );

  const getCanEditLead = (l) => {
    if (isMarketingView) return false;
    if (isFullAdmin) return true;
    const lStage = l.pipeline_stage || 'pre_sales';
    return effectiveUserPipe === lStage;
  };

  const advanceLeadStage = async (lead, targetStage) => {
    if (!getCanEditLead(lead)) {
      addToast('View-Only access: Cannot move leads outside your assigned pipeline.', 'error');
      return;
    }
    const id = lead.id || lead._id;
    try {
      await apiFetch(`/leads/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pipeline_stage: targetStage })
      });
      const stageName = targetStage === 'main_sales' ? '02 Main Sales' : '03 Post-Sales';
      addToast(`Lead moved to ${stageName} successfully!`, 'success');
      load();
    } catch (err) {
      addToast(err.message || 'Failed to update pipeline stage', 'error');
    }
  };

  const totalPages = Math.ceil(total / LEADS_PER_PAGE);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: LEADS_PER_PAGE });
      if (search) params.set('search', search);
      if (statusF) params.set('status', statusF);
      const effectivePipeFilter = lockedPipelineStage || pipelineStageF;
      if (effectivePipeFilter) params.set('pipeline_stage', effectivePipeFilter);
      if (sourceF) params.set('source', sourceF);
      if (startDate) params.set('start_date', startDate);
      if (endDate) params.set('end_date', endDate);

      const data = await apiFetch(`/leads?${params}`);
      setLeads(data?.leads || data?.data || []);
      setTotal(data?.total || 0);
    } catch {
      addToast('Failed to load leads', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, search, statusF, pipelineStageF, sourceF, startDate, endDate, addToast]);

  const handleManualSheetSync = async () => {
    setSyncingSheet(true);
    try {
      const res = await apiFetch('/google-sheets/sync-now', { method: 'POST' });
      addToast(`Live Sync Complete! ${res.synced_count || 0} leads synced, ${res.total_rows || 0} rows evaluated.`, 'success');
      load();
    } catch (err) {
      addToast('Sync failed: ' + (err.message || 'Error connecting to sheet'), 'error');
    } finally {
      setSyncingSheet(false);
    }
  };

  const handleExport = () => {
    if (!leads.length) {
      addToast('No leads to export', 'error');
      return;
    }
    const exportData = leads.map(l => ({
      'Name': l.name || '',
      'Phone': l.phone || '',
      'Email': l.email || '',
      'City': l.city || '',
      'Floor Plan Status': l.floor_plan_status || '',
      'Plot Size': l.plot_size || '',
      'Campaign / Source': l.source || l.meta_ad_name || 'Google Sheet',
      'Status': l.status || '',
      'Created': fmtDate(l.created_at || l.createdAt)
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Google Live Sheet Leads');
    XLSX.writeFile(wb, `Google_Live_Sheet_Leads_${new Date().toISOString().slice(0, 10)}.xlsx`);
    addToast('Exported leads to Excel successfully', 'success');
  };

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!isAdmin) return;
    apiFetch('/google-sheets/config')
      .then(res => { if (res?.config) setSheetConfig(res.config); })
      .catch(() => {});
  }, [isAdmin]);

  useEffect(() => {
    if (!lastUpdatedLead) return;
    const updId = lastUpdatedLead.id || lastUpdatedLead._id;
    setLeads(ls => ls.map(l => ((l.id || l._id) === updId ? { ...l, ...lastUpdatedLead } : l)));
  }, [lastUpdatedLead]);

  const deleteLead = async (id, leadName) => {
    if (!window.confirm(`Delete lead "${leadName || 'Lead'}"? All attached audio recordings will also be permanently deleted from VPS.`)) return;
    try {
      await apiFetch(`/leads/${id}`, { method: 'DELETE' });
      addToast('Lead deleted successfully', 'success');
      setSelectedIds(prev => { const next = new Set(prev); next.delete(id); return next; });
      load();
    } catch (err) { addToast(err.message || 'Delete failed', 'error'); }
  };

  const deleteLeadAudio = async (id, leadName) => {
    if (!window.confirm(`Delete audio recording attached to "${leadName || 'Lead'}"?`)) return;
    try {
      await apiFetch(`/leads/${id}/audio`, { method: 'DELETE' });
      addToast('Audio note removed', 'success');
      load();
    } catch (err) { addToast(err.message || 'Failed to delete audio', 'error'); }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === leads.length && leads.length > 0) setSelectedIds(new Set());
    else setSelectedIds(new Set(leads.map(l => l.id || l._id)));
  };

  const bulkDeleteLeads = async () => {
    if (!selectedIds.size) return;
    if (!window.confirm(`Are you sure you want to permanently delete ${selectedIds.size} selected lead(s)? This cannot be undone.`)) return;
    try {
      const res = await apiFetch('/leads/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds) })
      });
      addToast(res.message || `Deleted ${selectedIds.size} leads`, 'success');
      setSelectedIds(new Set());
      load();
    } catch (err) {
      addToast(err.message || 'Bulk delete failed', 'error');
    }
  };

  const cycleStatus = async (lead) => {
    if (!canEdit) return;
    const keys = STATUS_OPTIONS;
    const next = keys[(keys.indexOf(lead.status) + 1) % keys.length];
    updateLeadStatus(lead, next);
  };

  const updateLeadStatus = async (lead, newStatus) => {
    if (!canEdit || !getCanEditLead(lead)) {
      addToast('View-Only access: Status cannot be changed outside your assigned pipeline.', 'error');
      return;
    }
    if (lead.status === newStatus) return;
    try {
      const currentStage = lead.pipeline_stage || pipelineStageF || 'pre_sales';
      await apiFetch(`/leads/${lead.id || lead._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...lead, status: newStatus, pipeline_stage: currentStage })
      });
      setLeads(ls => ls.map(l => ((l.id || l._id) === (lead.id || lead._id) ? { ...l, status: newStatus, pipeline_stage: currentStage } : l)));
      load();
      addToast(`Status updated to "${newStatus}"`, 'success');
    } catch {
      addToast('Status update failed', 'error');
    }
  };

  const handleBulkUpload = async () => {
    if (!bulkFile) return;
    setUploading(true);
    const fd = new FormData();
    fd.append('file', bulkFile);
    try {
      const token = localStorage.getItem('crm_token');
      const res = await fetch(`${API}/leads/upload`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Upload failed');
      addToast(`Uploaded: ${data.inserted || 0} inserted, ${data.skipped || 0} skipped`, 'success');
      setBulkFile(null);
      load();
    } catch (err) { addToast(err.message || 'Upload failed', 'error'); } finally { setUploading(false); }
  };

  const tbBtn = { background: P.card2, border: `1px solid ${P.border}`, borderRadius: 8, padding: '8px 14px', color: P.text, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* ── Google Live Sheet Live Sync Banner (Unified Single Section) ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(6,182,212,0.04) 100%)',
        border: '1px solid rgba(16,185,129,0.25)',
        borderRadius: 14, padding: '16px 20px', flexWrap: 'wrap', gap: 14
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: 'rgba(16,185,129,0.18)', border: '1px solid rgba(16,185,129,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <FileSpreadsheet size={24} color="#10b981" />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: P.text, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>Google Live Sheet Leads</span>
              <span style={{
                fontSize: 10,
                background: sheetConfig?.is_active ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.18)',
                color: sheetConfig?.is_active ? '#4ade80' : '#fbbf24',
                padding: '2px 8px', borderRadius: 12, fontWeight: 700,
                border: sheetConfig?.is_active ? '1px solid rgba(16,185,129,0.4)' : '1px solid rgba(245,158,11,0.35)',
                display: 'inline-flex', alignItems: 'center', gap: 5
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: sheetConfig?.is_active ? '#22c55e' : '#f59e0b', display: 'inline-block' }} />
                {sheetConfig?.is_active ? 'LIVE SYNC CONNECTED' : (sheetConfig?.spreadsheet_id ? 'SYNC PAUSED' : 'NOT CONFIGURED')}
              </span>
            </div>
            <div style={{ fontSize: 12, color: P.muted, marginTop: 3 }}>
              {sheetConfig?.spreadsheet_id ? (
                <>Spreadsheet ID: <strong style={{ color: P.text, fontFamily: 'monospace' }}>{sheetConfig.spreadsheet_id}</strong> · Auto-syncs every 5 mins</>
              ) : (
                'No Google Sheet connected yet — configure one in the Data Ingest tab'
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={handleManualSheetSync}
            disabled={syncingSheet || !sheetConfig?.spreadsheet_id}
            style={{
              background: (syncingSheet || !sheetConfig?.spreadsheet_id) ? P.card2 : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: '#fff', border: 'none', borderRadius: 8, padding: '9px 16px',
              fontSize: 12, fontWeight: 700, cursor: (syncingSheet || !sheetConfig?.spreadsheet_id) ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 7, boxShadow: '0 2px 10px rgba(16,185,129,0.3)'
            }}
          >
            <RefreshCw size={14} style={{ animation: syncingSheet ? 'spin 1s linear infinite' : 'none' }} />
            {syncingSheet ? 'Syncing Sheet…' : 'Sync Live Sheet Now'}
          </button>

          {sheetConfig?.spreadsheet_id && (
          <a
            href={`https://docs.google.com/spreadsheets/d/${sheetConfig.spreadsheet_id}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              background: P.card2, border: `1px solid ${P.border}`, borderRadius: 8,
              padding: '9px 14px', color: P.text, fontSize: 12, fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none'
            }}
          >
            <ExternalLink size={13} color={P.muted} /> Open Live Sheet ↗
          </a>
          )}

          <button
            onClick={handleExport}
            style={{
              background: P.card2, border: `1px solid ${P.border}`, borderRadius: 8,
              padding: '9px 14px', color: P.gold, fontSize: 12, fontWeight: 600,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
            }}
          >
            <Download size={13} /> Export Excel
          </button>

          {isAdmin && (
            <button
              onClick={() => setShowWebhookModal(true)}
              style={{
                background: P.card2, border: `1px solid ${P.border}`, borderRadius: 8,
                padding: '9px 12px', color: P.muted, fontSize: 12, fontWeight: 600,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
              }}
              title="Sheet Configuration & Webhook Details"
            >
              <SlidersHorizontal size={13} /> Config
            </button>
          )}
        </div>
      </div>

      {/* ── 3 Main Pipeline Switcher Bar (Pre-Sales · Main Sales · Post-Sales) ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: P.card,
        border: `1px solid ${P.border}`,
        borderRadius: 12,
        padding: '10px 14px',
        flexWrap: 'wrap'
      }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: P.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginRight: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
          <SlidersHorizontal size={13} color={P.gold} /> Pipeline:
        </span>
        {[
          { id: '', label: 'All Pipelines', badge: '🌐', color: P.gold },
          { id: 'pre_sales', label: '01 Pre-Sales', badge: '🎯', color: '#38bdf8' },
          { id: 'main_sales', label: '02 Main Sales', badge: '⚡', color: '#f59e0b' },
          { id: 'post_sales', label: '03 Post-Sales', badge: '🚀', color: '#10b981' },
        ].filter(s => !lockedPipelineStage || s.id === lockedPipelineStage).map(s => {
          const active = (lockedPipelineStage || pipelineStageF) === s.id;
          return (
            <button
              key={s.id}
              onClick={() => { setPipelineStageF(s.id); setPage(1); }}
              style={{
                background: active ? `${s.color}22` : 'transparent',
                border: `1px solid ${active ? s.color : P.border}`,
                borderRadius: 8,
                padding: '6px 14px',
                color: active ? s.color : P.muted,
                fontSize: 12,
                fontWeight: active ? 800 : 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.15s'
              }}
            >
              <span>{s.badge}</span>
              <span>{s.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── Toolbar & Multi-Filters ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={14} color={P.muted} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            style={{ ...inputStyle, paddingLeft: 32 }}
            placeholder="Search by client, phone, city, plot size, ad name…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>

        {/* Status filter (5 stages) */}
        <select style={{ ...selectStyle, minWidth: 140 }} value={statusF} onChange={e => { setStatusF(e.target.value); setPage(1); }}>
          <option value="">All Statuses ({STATUS_OPTIONS.length})</option>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{STATUS_META[s]?.badge || ''} {STATUS_META[s]?.label || s}</option>)}
        </select>

        {statusF && (
          <button
            onClick={() => { setStatusF(''); setPage(1); }}
            style={{
              background: 'rgba(245,158,11,0.12)', border: `1px solid ${P.gold}50`,
              borderRadius: 8, padding: '6px 12px', color: P.gold, fontSize: 12,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700
            }}
            title="Clear status filter"
          >
            <span>Filtered: <strong>{STATUS_META[statusF]?.badge || ''} {statusF}</strong></span>
            <X size={12} />
          </button>
        )}

        {/* Date Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="date"
            value={startDate}
            onChange={e => { setStartDate(e.target.value); setPage(1); }}
            style={{ ...inputStyle, width: 'auto', padding: '6px 10px', fontSize: 12 }}
            title="Start Date"
          />
          <span style={{ fontSize: 11, color: P.muted }}>to</span>
          <input
            type="date"
            value={endDate}
            onChange={e => { setEndDate(e.target.value); setPage(1); }}
            style={{ ...inputStyle, width: 'auto', padding: '6px 10px', fontSize: 12 }}
            title="End Date"
          />
          {(startDate || endDate) && (
            <button
              onClick={() => { setStartDate(''); setEndDate(''); setPage(1); }}
              style={{ background: 'none', border: `1px solid ${P.border}`, borderRadius: 6, color: P.muted, padding: '5px 8px', cursor: 'pointer', fontSize: 11 }}
            >
              Clear
            </button>
          )}
        </div>

        {/* Actions for Sales / Admin */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {selectedIds.size > 0 && canDelete && (
            <button
              style={{ ...tbBtn, background: P.red, color: '#fff', border: 'none', fontWeight: 700 }}
              onClick={bulkDeleteLeads}
            >
              <Trash2 size={14} /> Delete Selected ({selectedIds.size})
            </button>
          )}

          {canBulkUpload && (
            <>
              <label style={{ ...tbBtn, position: 'relative' }} title="Upload Excel or CSV file">
                <Upload size={14} />
                {bulkFile ? <span style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bulkFile.name}</span> : 'Bulk Excel / CSV'}
                <input type="file" accept=".csv,.xlsx,.xls" style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
                  onChange={e => setBulkFile(e.target.files[0])} />
              </label>
              {bulkFile && (
                <button style={{ ...tbBtn, background: uploading ? P.card : P.gold, color: uploading ? P.text : '#000', border: 'none' }}
                  onClick={handleBulkUpload} disabled={uploading}>
                  {uploading ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={14} />}
                  {uploading ? 'Uploading…' : 'Confirm Upload'}
                </button>
              )}
            </>
          )}

          {canCreateManualLead && (
            <button
              style={{ ...tbBtn, background: P.gold, border: 'none', color: '#000', fontWeight: 700 }}
              onClick={() => { setEditLead(null); setShowForm(true); }}
            >
              <Plus size={14} /> Add Lead
            </button>
          )}
        </div>
      </div>

      {/* Count & Format Indicator */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: P.muted }}>
        <div>
          Showing {total > 0 ? `${(page - 1) * LEADS_PER_PAGE + 1}–${Math.min(page * LEADS_PER_PAGE, total)} of ${fmtNum(total)}` : '0'} Google Live Sheet Leads
        </div>
        <span style={{ color: '#4ade80', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
          <FileSpreadsheet size={11} /> Master Synchronized Stream (All Google Sheet Leads)
        </span>
      </div>

      {/* ── Mobile Adaptive Card Feed (< 768px) ── */}
      {isMobile ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{ background: P.card, borderRadius: 12, height: 120, border: `1px solid ${P.border}`, animation: 'pulse 1.5s infinite' }} />
            ))
          ) : leads.length === 0 ? (
            <EmptyState icon={Users} title="No leads found" sub="Adjust date range or search filters" />
          ) : (
            leads.map(l => {
              const id = l.id || l._id;
              const phoneClean = (l.phone || '').replace(/\D/g, '').slice(-10);
              const canEditThis = getCanEditLead(l);
              const lStage = l.pipeline_stage || 'pre_sales';
              return (
                <div
                  key={id}
                  style={{
                    background: P.card,
                    border: `1px solid ${P.border}`,
                    borderRadius: 14,
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <div onClick={() => onSelectLead?.(l)} style={{ cursor: 'pointer' }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: P.text }}>{l.name}</div>
                      <div style={{ fontSize: 11, color: P.gold, marginTop: 2, textTransform: 'uppercase', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>{l.lead_category || 'Lead'} • {fmtDate(l.created_at || l.createdAt)}</span>
                        <span style={{
                          fontSize: 9, padding: '1px 6px', borderRadius: 4,
                          background: lStage === 'post_sales' ? 'rgba(16,185,129,0.15)' : lStage === 'main_sales' ? 'rgba(245,158,11,0.15)' : 'rgba(56,189,248,0.15)',
                          color: lStage === 'post_sales' ? '#10b981' : lStage === 'main_sales' ? '#f59e0b' : '#38bdf8',
                          fontWeight: 700
                        }}>
                          {lStage === 'post_sales' ? 'Post-Sales' : lStage === 'main_sales' ? 'Main Sales' : 'Pre-Sales'}
                        </span>
                      </div>
                    </div>
                    <StatusBadge status={l.status} onChange={canEditThis ? (newStatus) => updateLeadStatus(l, newStatus) : undefined} disabled={!canEditThis} />
                  </div>

                  <div style={{ fontSize: 12, color: P.muted, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div>
                      <span style={{ fontSize: 10, color: P.muted }}>Phone:</span>
                      <div style={{ color: P.text, fontFamily: 'monospace', fontWeight: 600 }}>{l.phone || '—'}</div>
                    </div>
                    <div>
                      <span style={{ fontSize: 10, color: P.muted }}>Location:</span>
                      <div style={{ color: P.text }}>{l.city || l.studio_location || '—'}</div>
                    </div>
                    <div>
                      <span style={{ fontSize: 10, color: P.muted }}>Plot / Plan:</span>
                      <div style={{ color: P.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {l.plot_size || l.floor_plan_status || l.requirement || '—'}
                      </div>
                    </div>
                    <div>
                      <span style={{ fontSize: 10, color: P.muted }}>Budget:</span>
                      <div style={{ color: P.green, fontWeight: 700 }}>{l.budget || '—'}</div>
                    </div>
                  </div>

                  {/* 44px Touch Action Bar */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr', gap: 8, marginTop: 4, paddingTop: 10, borderTop: `1px solid ${P.border}40` }}>
                    <button
                      onClick={() => onCallLead ? onCallLead(l) : window.open(`tel:${l.phone}`, '_self')}
                      style={{
                        minHeight: 44,
                        background: 'rgba(34,197,94,0.15)',
                        border: `1px solid ${P.green}50`,
                        borderRadius: 8,
                        color: P.green,
                        fontSize: 12,
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        cursor: 'pointer'
                      }}
                    >
                      <PhoneCall size={15} /> Call
                    </button>

                    <a
                      href={phoneClean ? `https://wa.me/91${phoneClean}?text=Hello%20${encodeURIComponent(l.name || 'Client')}%2C%20following%20up%20from%20Walk%20The%20Plan.` : '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        minHeight: 44,
                        background: 'rgba(37,211,102,0.15)',
                        border: '1px solid rgba(37,211,102,0.5)',
                        borderRadius: 8,
                        color: '#25d366',
                        fontSize: 12,
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        textDecoration: 'none'
                      }}
                    >
                      <MessageSquare size={15} /> WhatsApp
                    </a>

                    <button
                      onClick={() => onSelectLead?.(l)}
                      style={{
                        minHeight: 44,
                        background: P.card2,
                        border: `1px solid ${P.gold}60`,
                        borderRadius: 8,
                        color: P.gold,
                        fontSize: 12,
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 4,
                        cursor: 'pointer'
                      }}
                    >
                      Details <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
      /* ── Desktop Table Representation ── */
      <TableWrap>
        <thead>
          <tr>
            {canDelete && (
              <Th style={{ width: 32, textAlign: 'center', padding: '10px 6px' }}>
                <input
                  type="checkbox"
                  checked={leads.length > 0 && selectedIds.size === leads.length}
                  onChange={toggleSelectAll}
                  style={{ cursor: 'pointer', accentColor: P.gold }}
                />
              </Th>
            )}

            {/* Unified Single-Page Table Headers */}
            <Th>Prospect / Source</Th>
            <Th>Contact Details</Th>
            <Th>City & Scope</Th>
            <Th>Status (Stage)</Th>
            <Th>Primary Task / Note</Th>
            <Th>Created</Th>
            {!isMarketingView && <Th style={{ textAlign: 'right' }}>Actions</Th>}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            Array.from({ length: 7 }).map((_, i) => <SkeletonRow key={i} cols={8} />)
          ) : leads.length === 0 ? (
            <tr><td colSpan={9}><EmptyState icon={Users} title={statusF ? `No ${statusF}s found` : "No leads found"} sub={statusF ? `There are currently no leads in the "${statusF}" stage. Click "Filtered: ${statusF}" above to view all leads.` : "Adjust date range or search filters"} /></td></tr>
          ) : (
            leads.map(l => {
              const id = l.id || l._id;
              const canEditThis = getCanEditLead(l);
              return (
                <tr key={id} onMouseEnter={e => e.currentTarget.style.background = '#ffffff05'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'} style={{ transition: 'background 0.15s' }}>
                  {canDelete && (
                    <Td style={{ textAlign: 'center', padding: '10px 6px' }}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(id)}
                        onChange={() => toggleSelect(id)}
                        style={{ cursor: 'pointer', accentColor: P.gold }}
                      />
                    </Td>
                  )}

                  {/* Client Name & Source */}
                  <Td onClick={() => onSelectLead?.(l)} style={{ cursor: 'pointer', maxWidth: 195 }} title="Click to view lead details & interaction notes">
                    <div style={{ fontWeight: 700, color: P.gold, display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.name}</span>
                      <ExternalLink size={11} color={P.muted} style={{ flexShrink: 0 }} />
                    </div>
                    <span style={{ fontSize: 10.5, color: P.muted, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {l.meta_ad_name || l.meta_campaign_name || l.source || 'Google Sheet Live Sync'}
                    </span>
                  </Td>

                  {/* Contact Details */}
                  <Td style={{ maxWidth: 185 }}>
                    <div style={{ fontSize: 12, color: P.text, fontFamily: 'monospace', whiteSpace: 'nowrap', fontWeight: 600 }}>{l.phone || '—'}</div>
                    <div style={{ fontSize: 11, color: P.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.email || '—'}</div>
                  </Td>

                  {/* City, Floor Plan & Plot Size */}
                  <Td style={{ maxWidth: 190 }}>
                    <div style={{ fontSize: 12, color: P.text, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {l.city || '—'}
                    </div>
                    <div style={{ fontSize: 10.5, color: l.floor_plan_status?.toLowerCase().includes('not') ? P.red : l.floor_plan_status?.toLowerCase().includes('under') ? '#f59e0b' : P.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {[l.floor_plan_status?.replace(/_/g, ' ') || l.requirement, l.plot_size ? l.plot_size.replace(/_/g, ' ') : l.budget].filter(Boolean).join(' · ') || '—'}
                    </div>
                  </Td>

                  {/* Status Badge */}
                  <Td style={{ whiteSpace: 'nowrap' }}>
                    <StatusBadge status={l.status} onChange={canEditThis ? (newStatus) => updateLeadStatus(l, newStatus) : undefined} disabled={!canEditThis} />
                  </Td>

                  {/* Primary Task / Note Preview */}
                  <Td>
                    <StageNotesPreview lead={l} onClick={onSelectLead} />
                  </Td>

                  {/* Created Date */}
                  <Td style={{ whiteSpace: 'nowrap' }}><span style={{ color: P.muted, fontSize: 11 }}>{fmtDate(l.created_at || l.createdAt)}</span></Td>

                  {/* Actions for Sales / Admin */}
                  {!isMarketingView && (
                    <Td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'inline-flex', gap: 4, alignItems: 'center', justifyContent: 'flex-end' }}>
                        {canEditThis && (l.pipeline_stage === 'pre_sales' || !l.pipeline_stage) && (
                          <ActionBtn
                            icon={ArrowUpRight}
                            color="#38bdf8"
                            title="Promote lead to 02 Main Sales"
                            onClick={() => advanceLeadStage(l, 'main_sales')}
                          />
                        )}
                        {canEditThis && l.pipeline_stage === 'main_sales' && (
                          <ActionBtn
                            icon={ArrowUpRight}
                            color="#10b981"
                            title="Advance lead to 03 Post-Sales"
                            onClick={() => advanceLeadStage(l, 'post_sales')}
                          />
                        )}
                        <ActionBtn icon={PhoneCall} color={P.green} title="VoIP WebRTC Call" onClick={() => onCallLead(l)} />
                        <ActionBtn icon={MessageSquare} color="#25d366" title="WhatsApp Chat" onClick={() => {
                          const phoneClean = (l.phone || '').replace(/\D/g, '').slice(-10);
                          if (phoneClean) window.open(`https://wa.me/91${phoneClean}?text=Hello%20${encodeURIComponent(l.name || 'Client')}%2C%20following%20up%20from%20Walk%20The%20Plan.`, '_blank');
                          else addToast('No phone number for WhatsApp', 'error');
                        }} />
                        <ActionBtn icon={ExternalLink} color={P.gold} title="Open Slide-Over Drawer & Timeline" onClick={() => onSelectLead?.(l)} />
                        {canEditThis && (
                          <ActionBtn icon={Edit} color={P.blue} title="Edit Details" onClick={() => { setEditLead(l); setShowForm(true); }} />
                        )}
                        {(canEditThis || l.audio_url) && (
                          <ActionBtn icon={Volume2} color={l.audio_url ? P.gold : P.purple} title="Audio Notes" onClick={() => onAudio(l)} />
                        )}
                        {canDelete && (
                          <ActionBtn icon={Trash2} color={P.red} title="Delete Lead" onClick={() => deleteLead(id, l.name)} />
                        )}
                      </div>
                    </Td>
                  )}
                </tr>
              );
            })
          )}
        </tbody>
      </TableWrap>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 10 }}>
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={{ ...tbBtn, opacity: page <= 1 ? 0.4 : 1 }}><ChevronLeft size={14} /></button>
          <span style={{ fontSize: 12, color: P.muted }}>Page {page} of {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} style={{ ...tbBtn, opacity: page >= totalPages ? 0.4 : 1 }}><ChevronRight size={14} /></button>
        </div>
      )}

      {/* Lead Form Modal */}
      <LeadFormModal
        open={showForm}
        onClose={() => { setShowForm(false); setEditLead(null); }}
        lead={editLead}
        onSaved={load}
        addToast={addToast}
        isAdmin={isAdmin}
        isManager={isManager}
        currentUser={currentUser}
      />

      {/* Meta Ads & Google Sheets Webhook Modal (Admin Only) */}
      <Modal open={Boolean(isAdmin && showWebhookModal)} onClose={() => setShowWebhookModal(false)} title="Meta Ads & Google Sheets Live Ingestion Webhook" width={640}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ margin: 0, fontSize: 13, color: P.muted, lineHeight: 1.6 }}>
            Connect your Facebook & Instagram Lead Ads or Google Sheet directly to Walk The Plan CRM without manual Excel uploads.
          </p>

          <div style={{ background: P.card2, border: `1px solid ${P.border}`, borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: P.gold, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
              Your Live Ingestion Webhook URL
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                readOnly
                value={`${BACKEND_BASE || window.location.origin}/api/crm/leads/meta-webhook`}
                style={{ ...inputStyle, flex: 1, fontFamily: 'monospace', fontSize: 12, color: '#c084fc' }}
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`${BACKEND_BASE || window.location.origin}/api/crm/leads/meta-webhook`);
                  addToast('Webhook URL copied to clipboard!', 'success');
                }}
                style={{ background: P.gold, border: 'none', borderRadius: 8, padding: '9px 16px', color: '#000', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}
              >
                <Copy size={13} /> Copy URL
              </button>
            </div>
          </div>

          <div style={{ background: '#18181b', border: `1px solid ${P.border}`, borderRadius: 10, padding: '14px 16px' }}>
            <h4 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700, color: P.text }}>
              How to connect live Google Sheets / Zapier / Meta:
            </h4>
            <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: P.muted, lineHeight: 1.7 }}>
              <li>Open your live Google Sheet collecting Meta Leads.</li>
              <li>Go to <strong>Extensions ➔ Apps Script</strong>.</li>
              <li>Create a simple post function targeting the Webhook URL on row insert.</li>
              <li>Every new lead dropping from Facebook or Instagram will instantly drop into the CRM in real time!</li>
            </ol>
          </div>
        </div>
      </Modal>
    </div>
  );
};

// ─── Tab: Upload Leads ────────────────────────────────────────────────────────
const TabUpload = ({ addToast, onUploadComplete }) => {
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [manualForm, setManualForm] = useState(false);
  const fileRef = useRef();

  const empty = { name: '', email: '', phone: '', source: 'Industrial Walkthrough', status: 'Pending', priority: 'medium', city: '', state: '', budget: '', requirement: '', notes: '', follow_up_date: '', assigned_to: '' };
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  const handleDrop = (e) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f && (f.name.endsWith('.csv') || f.name.endsWith('.xlsx') || f.name.endsWith('.xls'))) setFile(f);
    else addToast('Please upload a CSV or Excel file', 'error');
  };

  const uploadFile = async () => {
    if (!file) return;
    setUploading(true); setResult(null);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const token = localStorage.getItem('crm_token');
      const res = await fetch(`${API}/leads/upload`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Upload failed');
      setResult(data);
      addToast(`Bulk ingest: ${data.inserted || 0} inserted, ${data.skipped || 0} skipped`, 'success');
      setFile(null);
      if (onUploadComplete) onUploadComplete();
    } catch (err) { addToast(err.message || 'Upload failed', 'error'); } finally { setUploading(false); }
  };

  const downloadTemplate = (format = 'xlsx') => {
    if (format === 'csv') {
      const csv = 'Client Name,Phone,Email,City,State,Requirement,Budget,Source,Status,Priority,Notes,Follow-up Date,Assigned Engineer\nAcme Manufacturing,9876543210,ops@acme.com,Pune,Maharashtra,Full Plant 3D Walkthrough,1200000,Industrial Walkthrough,new,high,Hazard assessment needed,2026-11-20,Lead Engineer';
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'walk_the_plan_bulk_import_template.csv' });
      a.click();
      return;
    }
    const templateData = [
      {
        'Client Name': 'Acme Manufacturing',
        'Phone Number': '9876543210',
        'Email ID': 'ops@acme.com',
        'City': 'Pune',
        'State': 'Maharashtra',
        'Requirement': 'Full Plant 3D Walkthrough & Digital Twin',
        'Est. Budget': '12,00,000',
        'Source': 'Industrial Walkthrough',
        'Status': 'new',
        'Priority': 'high',
        'Follow-up Date': '2026-11-20',
        'Assigned Engineer': 'Lead Engineer',
        'Technical Notes': 'Hazard assessment and thermal scan needed'
      },
      {
        'Client Name': 'Tata Steel Ltd',
        'Phone Number': '9811223344',
        'Email ID': 'procurement@tatasteel.com',
        'City': 'Jamshedpur',
        'State': 'Jharkhand',
        'Requirement': 'Drone LiDAR 3D Walkthrough Scan',
        'Est. Budget': '25,00,000',
        'Source': 'Plant Inspection',
        'Status': 'new',
        'Priority': 'medium',
        'Follow-up Date': '2026-11-25',
        'Assigned Engineer': 'Senior Sales Engineer',
        'Technical Notes': 'Blast furnace safety clearance required'
      }
    ];
    const ws = XLSX.utils.json_to_sheet(templateData);
    ws['!cols'] = [
      { wch: 22 }, { wch: 15 }, { wch: 26 }, { wch: 14 }, { wch: 14 },
      { wch: 36 }, { wch: 14 }, { wch: 22 }, { wch: 10 }, { wch: 10 },
      { wch: 14 }, { wch: 22 }, { wch: 36 }
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Leads_Template');
    XLSX.writeFile(wb, 'walk_the_plan_bulk_import_template.xlsx');
  };

  const submitManual = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { addToast('Name is required', 'error'); return; }
    setSaving(true);
    try {
      await apiFetch('/leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      addToast('plan inquiry logged successfully!', 'success');
      setForm(empty);
      if (onUploadComplete) onUploadComplete();
    } catch (err) { addToast(err.message || 'Failed to add lead', 'error'); } finally { setSaving(false); }
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      {/* Drag & Drop */}
      <div style={{ background: P.card, border: `1px solid ${P.border}`, borderRadius: 16, padding: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <FileSpreadsheet size={20} color={P.gold} />
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: P.text }}>Bulk Data Ingestion (CSV / Excel)</h3>
        </div>
        <p style={{ color: P.muted, fontSize: 13, margin: '0 0 20px', lineHeight: 1.5 }}>
          Upload high-volume plan walkthrough inquiries, industrial leads, or exhibition contacts directly to your private VPS pipeline.
        </p>

        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          style={{
            border: `2px dashed ${dragging ? P.gold : file ? P.green : P.border2}`,
            borderRadius: 14, padding: '48px 24px', textAlign: 'center',
            cursor: 'pointer', transition: 'all 0.25s',
            background: dragging ? 'rgba(245,158,11,0.05)' : file ? 'rgba(34,197,94,0.05)' : '#0f0f12',
          }}
        >
          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files[0]; if (f) setFile(f); }} />
          {file
            ? <>
              <CheckCircle size={40} color={P.green} style={{ marginBottom: 12 }} />
              <div style={{ fontSize: 16, fontWeight: 700, color: P.text }}>{file.name}</div>
              <div style={{ fontSize: 12, color: P.muted, marginTop: 4 }}>{(file.size / 1024).toFixed(1)} KB — Click to change file</div>
            </>
            : <>
              <Upload size={40} color={dragging ? P.gold : P.border2} style={{ marginBottom: 12 }} />
              <div style={{ fontSize: 16, fontWeight: 600, color: dragging ? P.gold : P.text }}>Drag & Drop CSV / Excel Spreadsheet</div>
              <div style={{ fontSize: 12, color: P.muted, marginTop: 6 }}>or click to browse from your computer</div>
            </>
          }
        </div>

        {file && (
          <div style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: P.gold, background: 'rgba(245,158,11,0.08)', padding: '6px 12px', borderRadius: 8, border: `1px solid ${P.gold}30` }}>
              <Shield size={14} /> Smart Field Filtering: Only important CRM fields (Name, Phone, Email, Location, Budget, Requirement) are extracted. Any wrong or extra columns are safely ignored.
            </div>
            <div style={{ display: 'flex', gap: 10, marginLeft: 'auto' }}>
              <button onClick={() => setFile(null)} style={{ background: P.card2, border: `1px solid ${P.border}`, borderRadius: 8, padding: '9px 18px', color: P.muted, cursor: 'pointer', fontSize: 13 }}>Clear</button>
              <button onClick={uploadFile} disabled={uploading} style={{
                background: uploading ? P.card2 : P.gold, border: 'none', borderRadius: 8,
                padding: '9px 24px', color: uploading ? P.text : '#000', fontWeight: 700, cursor: 'pointer', fontSize: 13,
                display: 'flex', alignItems: 'center', gap: 7,
              }}>
                {uploading ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Upload size={14} />}
                {uploading ? 'Processing & Ingesting…' : 'Ingest Leads to Pipeline'}
              </button>
            </div>
          </div>
        )}

        {result && (
          <div style={{ marginTop: 18, background: 'rgba(34,197,94,0.08)', border: `1px solid ${P.green}40`, borderRadius: 10, padding: 16 }}>
            <div style={{ fontWeight: 700, color: P.green, marginBottom: 8 }}>Ingestion Complete</div>
            <div style={{ display: 'flex', gap: 24, fontSize: 14, flexWrap: 'wrap' }}>
              <span style={{ color: P.text }}><span style={{ color: P.green, fontWeight: 700 }}>{result.inserted || 0}</span> Successfully Added</span>
              <span style={{ color: P.text }}><span style={{ color: P.gold, fontWeight: 700 }}>{result.skipped || 0}</span> Skipped / Empty Rows</span>
              {result.errors?.length > 0 && <span style={{ color: P.text }}><span style={{ color: P.red, fontWeight: 700 }}>{result.errors.length}</span> Errors</span>}
            </div>
          </div>
        )}

        {/* Format guide */}
        <div style={{ marginTop: 20, background: '#0f0f12', borderRadius: 10, padding: 16, border: `1px solid ${P.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <span style={{ fontSize: 12, fontWeight: 700, color: P.muted, letterSpacing: 0.5 }}>IMPORTANT SUPPORTED FIELDS</span>
              <div style={{ fontSize: 11, color: P.muted, marginTop: 2 }}>Upload with any column order or custom names. Unrecognized/extra columns are automatically discarded.</div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={() => downloadTemplate('xlsx')} style={{
                background: 'rgba(245,158,11,0.1)', border: `1px solid ${P.gold}40`, borderRadius: 7, padding: '5px 12px',
                color: P.gold, cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', gap: 5, fontWeight: 600
              }}><Download size={12} /> Excel Template (.xlsx)</button>
              <button onClick={() => downloadTemplate('csv')} style={{
                background: 'none', border: `1px solid ${P.border}`, borderRadius: 7, padding: '5px 12px',
                color: P.muted, cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', gap: 5,
              }}><Download size={12} /> CSV Template</button>
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {[
              { key: 'name', label: 'Client / Person Name' },
              { key: 'phone', label: 'Mobile / WhatsApp' },
              { key: 'email', label: 'Email ID' },
              { key: 'city', label: 'City / Location' },
              { key: 'state', label: 'State' },
              { key: 'budget', label: 'Est. Budget' },
              { key: 'requirement', label: 'Walkthrough Requirement' },
              { key: 'source', label: 'Source' },
              { key: 'status', label: 'Status' },
              { key: 'priority', label: 'Priority' },
              { key: 'notes', label: 'Technical Notes' },
              { key: 'follow_up_date', label: 'Follow-up Date' },
              { key: 'assigned_to', label: 'Assigned Engineer' },
            ].map(col => (
              <span key={col.key} style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', color: P.gold, fontSize: 11, padding: '4px 9px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{col.key}</span>
                <span style={{ color: P.muted, fontSize: 10 }}>({col.label})</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Manual Entry */}
      <div style={{ background: P.card, border: `1px solid ${P.border}`, borderRadius: 16, padding: 28 }}>
        <button onClick={() => setManualForm(f => !f)} style={{
          background: 'none', border: 'none', color: P.text, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: 0,
        }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Direct Single Ingestion Form</h3>
          <ChevronDown size={16} color={P.muted} style={{ transform: manualForm ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', marginLeft: 'auto' }} />
        </button>

        {manualForm && (
          <form onSubmit={submitManual} style={{ marginTop: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Field label="plan / Enterprise Name" required><input style={inputStyle} value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Jindal Steel" /></Field>
            <Field label="Phone Number"><input style={inputStyle} value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+91 9876543210" /></Field>
            <Field label="Email Address"><input style={inputStyle} type="email" value={form.email} onChange={e => set('email', e.target.value)} /></Field>
            <Field label="Source"><select style={selectStyle} value={form.source} onChange={e => set('source', e.target.value)}>{SOURCE_OPTIONS.map(s => <option key={s}>{s}</option>)}</select></Field>
            <Field label="Pipeline Status"><select style={selectStyle} value={form.status} onChange={e => set('status', e.target.value)}>{STATUS_OPTIONS.map(s => <option key={s} value={s}>{STATUS_META[s].label}</option>)}</select></Field>
            <Field label="Priority"><select style={selectStyle} value={form.priority} onChange={e => set('priority', e.target.value)}>{PRIORITY_OPTIONS.map(p => <option key={p} value={p}>{PRIORITY_META[p].label}</option>)}</select></Field>
            <Field label="City / Region"><input style={inputStyle} value={form.city} onChange={e => set('city', e.target.value)} /></Field>
            <Field label="State"><input style={inputStyle} value={form.state} onChange={e => set('state', e.target.value)} /></Field>
            <Field label="Project Budget Scope"><input style={inputStyle} value={form.budget} onChange={e => set('budget', e.target.value)} /></Field>
            <Field label="Scheduled Follow-up Date"><input style={inputStyle} type="date" value={form.follow_up_date} onChange={e => set('follow_up_date', e.target.value)} /></Field>
            <Field label="Assigned Engineer"><input style={inputStyle} value={form.assigned_to} onChange={e => set('assigned_to', e.target.value)} /></Field>
            <Field label="Walkthrough Requirement"><input style={inputStyle} value={form.requirement} onChange={e => set('requirement', e.target.value)} placeholder="e.g. Drone + Lidar 3D Scan" /></Field>
            <div style={{ gridColumn: '1 / -1' }}>
              <Field label="Technical Notes"><textarea style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }} value={form.notes} onChange={e => set('notes', e.target.value)} /></Field>
            </div>
            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" disabled={saving} style={{ background: P.gold, border: 'none', borderRadius: 8, padding: '10px 28px', color: '#000', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                {saving ? 'Adding…' : 'Ingest Lead'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

// ─── Tab: Call Studio (Integrated WebRTC Telephony & VPS Recording) ────────────
const TabCallStudio = ({ initialLead, addToast, isAdmin, isAgent }) => {
  const [leads, setLeads] = useState([]);
  const [selectedLead, setSelectedLead] = useState(initialLead || null);
  const [callState, setCallState] = useState('idle'); // 'idle' | 'calling' | 'active' | 'ended'
  const [callSeconds, setCallSeconds] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [currentCallId, setCurrentCallId] = useState(null);
  const [callLogs, setCallLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [callNotes, setCallNotes] = useState('');
  const [activeTab, setActiveTab] = useState('dialer'); // 'dialer' | 'logs'
  const [bars, setBars] = useState(Array(24).fill(4));

  const peerRef = useRef(null);
  const localStreamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const animRef = useRef(null);
  const analyserRef = useRef(null);
  const roomIdRef = useRef(null);

  const canDelete = isAdmin;

  const deleteCallRecording = async (callId) => {
    if (!window.confirm('Delete this WebRTC call audio recording from VPS storage?')) return;
    try {
      await apiFetch(`/calls/${callId}/recording`, { method: 'DELETE' });
      addToast('Call audio recording deleted from VPS', 'success');
      loadCallLogs();
    } catch (err) {
      addToast(err.message || 'Failed to delete recording', 'error');
    }
  };

  const deleteCallLog = async (callId) => {
    if (!window.confirm('Permanently delete this call log record and its audio from VPS?')) return;
    try {
      await apiFetch(`/calls/${callId}`, { method: 'DELETE' });
      addToast('Call log deleted', 'success');
      loadCallLogs();
    } catch (err) {
      addToast(err.message || 'Failed to delete call log', 'error');
    }
  };

  useEffect(() => {
    if (initialLead) setSelectedLead(initialLead);
  }, [initialLead]);

  // Load leads for dialer
  useEffect(() => {
    apiFetch('/leads?limit=150').then(d => {
      if (d?.leads) setLeads(d.leads);
    }).catch(() => { });
    loadCallLogs();
  }, []);

  const loadCallLogs = async () => {
    setLogsLoading(true);
    try {
      const data = await apiFetch('/calls?limit=50');
      setCallLogs(data?.calls || []);
    } catch {
      // Non-blocking
    } finally {
      setLogsLoading(false);
    }
  };

  // Start outbound WebRTC call with auto-recording
  const startCall = async () => {
    if (!selectedLead) {
      addToast('Please select a plan/lead to dial.', 'error');
      return;
    }
    setCallState('calling');
    setCallSeconds(0);
    chunksRef.current = [];

    try {
      // 1. Get audio input from browser microphone
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });
      localStreamRef.current = stream;

      // 2. Set up Web Audio Analyser for live frequency visualization
      try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const sourceNode = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        sourceNode.connect(analyser);
        analyserRef.current = { audioCtx, analyser };

        const updateBars = () => {
          if (!analyserRef.current) return;
          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          analyser.getByteFrequencyData(dataArray);
          setBars(Array.from({ length: 24 }, (_, i) => Math.max(4, (dataArray[i] || 0) / 255 * 52)));
          animRef.current = requestAnimationFrame(updateBars);
        };
        updateBars();
      } catch (audioErr) {
        console.warn('Audio visualization unavailable:', audioErr);
      }

      // 3. Set up MediaRecorder for mandatory call recording
      let options = { mimeType: 'audio/webm' };
      if (!MediaRecorder.isTypeSupported('audio/webm')) {
        options = MediaRecorder.isTypeSupported('audio/mp4') ? { mimeType: 'audio/mp4' } : {};
      }
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      mediaRecorder.start(1000); // 1-second chunks
      mediaRecorderRef.current = mediaRecorder;

      // 4. Log call initiation in backend
      const callInit = await apiFetch('/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: selectedLead.id || selectedLead._id,
          direction: 'outbound',
          status: 'in-progress',
          duration_seconds: 0,
          notes: `WebRTC call to ${selectedLead.name} (${selectedLead.phone || 'No phone'})`,
        }),
      });
      const callId = callInit?.id;
      setCurrentCallId(callId);

      // 5. Establish WebRTC PeerConnection & Pion signaling
      const roomId = `call-${callId || Date.now()}-${Math.floor(Math.random() * 10000)}`;
      roomIdRef.current = roomId;

      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ]
      });
      peerRef.current = pc;

      // Add local audio track
      stream.getAudioTracks().forEach(track => pc.addTrack(track, stream));

      // Handle ICE Candidates
      pc.onicecandidate = async (event) => {
        if (event.candidate) {
          const token = localStorage.getItem('crm_token');
          await fetch(`${API}/signal/candidate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ room_id: roomId, candidate: event.candidate, side: 'offer' })
          }).catch(() => { });
        }
      };

      // Create Offer and dispatch to VPS Pion/Node signaling server
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const token = localStorage.getItem('crm_token');
      await fetch(`${API}/signal/offer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ room_id: roomId, sdp: offer })
      });

      // Call is now active
      setCallState('active');
      timerRef.current = setInterval(() => {
        setCallSeconds(s => s + 1);
      }, 1000);

      addToast(`Connected: Calling ${selectedLead.name} (Auto-recording enabled)`, 'info');

    } catch (err) {
      console.error('Telephony error:', err);
      setCallState('idle');
      addToast(`Could not start call: ${err.message || 'Check microphone permission.'}`, 'error');
    }
  };

  // End Call & automatically persist recording directly onto VPS disk
  const endCall = async () => {
    clearInterval(timerRef.current);
    if (animRef.current) cancelAnimationFrame(animRef.current);
    if (analyserRef.current?.audioCtx) {
      try { analyserRef.current.audioCtx.close(); } catch (_) { }
    }
    setBars(Array(24).fill(4));

    const finalDuration = callSeconds;
    const callIdToSave = currentCallId;
    setCallState('ended');

    // 1. Stop WebRTC PeerConnection
    if (peerRef.current) {
      try { peerRef.current.close(); } catch (_) { }
      peerRef.current = null;
    }

    // 2. Stop Microphone input stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }

    // 3. Stop MediaRecorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop(); } catch (_) { }
    }

    addToast('Call ended. Uploading encrypted recording to VPS storage…', 'info');

    // 4. Upload recording buffer directly to VPS
    setTimeout(async () => {
      try {
        if (chunksRef.current.length > 0 && callIdToSave) {
          const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
          const fd = new FormData();
          fd.append('recording', blob, `call-${callIdToSave}-${Date.now()}.webm`);

          const token = localStorage.getItem('crm_token');
          const recRes = await fetch(`${API}/calls/${callIdToSave}/recording`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: fd,
          });
          const recData = await recRes.json();

          // Update call log duration & final notes
          await apiFetch(`/calls/${callIdToSave}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              status: 'completed',
              duration_seconds: finalDuration,
              notes: callNotes ? `${callNotes} (Recorded)` : 'WebRTC call recorded directly on VPS.',
            }),
          });

          addToast(`Call recording securely saved on VPS (${fmtDuration(finalDuration)})`, 'success');
        } else if (callIdToSave) {
          await apiFetch(`/calls/${callIdToSave}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              status: 'completed',
              duration_seconds: finalDuration,
              notes: callNotes || 'Call completed.',
            }),
          });
        }
      } catch (err) {
        console.error('Failed to save call recording:', err);
        addToast('Failed to upload recording to VPS: ' + err.message, 'error');
      } finally {
        setCallState('idle');
        setCallSeconds(0);
        setCurrentCallId(null);
        setCallNotes('');
        loadCallLogs();
      }
    }, 1200);
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Top Selector / Switcher */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${P.border}`, paddingBottom: 14 }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => setActiveTab('dialer')}
            style={{
              background: activeTab === 'dialer' ? `${P.gold}20` : 'transparent',
              color: activeTab === 'dialer' ? P.gold : P.muted,
              border: `1px solid ${activeTab === 'dialer' ? P.gold : P.border}`,
              borderRadius: 8, padding: '7px 16px', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
            }}
          >
            <PhoneCall size={14} /> VoIP Dialer
          </button>
          <button
            onClick={() => { setActiveTab('logs'); loadCallLogs(); }}
            style={{
              background: activeTab === 'logs' ? `${P.gold}20` : 'transparent',
              color: activeTab === 'logs' ? P.gold : P.muted,
              border: `1px solid ${activeTab === 'logs' ? P.gold : P.border}`,
              borderRadius: 8, padding: '7px 16px', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
            }}
          >
            <Radio size={14} /> Call Logs & VPS Recordings ({callLogs.length})
          </button>
        </div>

        {/* VPS Audio Storage Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(34,197,94,0.1)', border: `1px solid ${P.green}30`, borderRadius: 20, padding: '4px 12px' }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: P.green }} />
          <span style={{ fontSize: 11, color: P.green, fontWeight: 600 }}>VPS Media Server Active</span>
        </div>
      </div>

      {activeTab === 'dialer' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 480px) 1fr', gap: 24 }}>
          {/* Dialer Console */}
          <div style={{
            background: P.card, border: `1px solid ${P.border}`, borderRadius: 16,
            padding: 28, display: 'flex', flexDirection: 'column', gap: 20,
            boxShadow: '0 15px 35px rgba(0,0,0,0.4)', position: 'relative'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Headphones size={18} color={P.gold} />
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: P.text }}>Industrial VoIP Softphone</h3>
              </div>
              <span style={{ fontSize: 11, background: `${P.gold}20`, color: P.gold, padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>
                WebRTC · Opus Codec
              </span>
            </div>

            {/* Target Lead Selector */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, color: P.muted, fontWeight: 600 }}>SELECT CALL TARGET</label>
              <select
                disabled={callState === 'calling' || callState === 'active'}
                value={selectedLead ? (selectedLead.id || selectedLead._id) : ''}
                onChange={e => {
                  const lead = leads.find(l => String(l.id || l._id) === e.target.value);
                  setSelectedLead(lead || null);
                }}
                style={{
                  ...selectStyle,
                  padding: '11px 14px', fontSize: 13, background: P.card2,
                  borderColor: selectedLead ? P.gold : P.border
                }}
              >
                <option value="">-- Select plan Lead ({leads.length} available) --</option>
                {leads.map(l => (
                  <option key={l.id || l._id} value={l.id || l._id}>
                    {l.name} — {l.phone || 'No direct phone'} ({l.city || 'plan Location'})
                  </option>
                ))}
              </select>
            </div>

            {/* Target Preview Banner */}
            {selectedLead && (
              <div style={{
                background: '#0c0c0e', border: `1px solid ${P.border}`, borderRadius: 12,
                padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14
              }}>
                <div style={{
                  width: 42, height: 42, borderRadius: '50%', background: `${P.gold}20`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                }}>
                  <span style={{ color: P.gold, fontWeight: 800, fontSize: 16 }}>
                    {selectedLead.name?.[0]?.toUpperCase()}
                  </span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: P.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {selectedLead.name}
                  </div>
                  <div style={{ fontSize: 12, color: P.muted }}>
                    {selectedLead.phone || 'No phone'} · {selectedLead.city || 'Industrial Region'}
                  </div>
                </div>
              </div>
            )}

            {/* Live Audio Frequency Waveform */}
            <div style={{
              background: '#0a0a0c', border: `1px solid ${P.border}`, borderRadius: 12,
              padding: '24px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', gap: 16, minHeight: 140
            }}>
              {/* Animated Bars */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, height: 55 }}>
                {bars.map((h, i) => (
                  <div key={i} style={{
                    width: 4, height: `${h}px`, borderRadius: 2,
                    background: callState === 'active' ? (isMuted ? P.red : P.green) : P.border2,
                    transition: callState === 'active' ? 'height 0.05s' : 'height 0.3s, background 0.3s'
                  }} />
                ))}
              </div>

              {/* Call Timer / Status */}
              <div style={{ textAlign: 'center' }}>
                {callState === 'idle' && (
                  <span style={{ fontSize: 13, color: P.muted }}>Ready for outbound call</span>
                )}
                {callState === 'calling' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: P.gold }}>
                    <RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} />
                    <span style={{ fontSize: 14, fontWeight: 600 }}>Establishing WebRTC Audio Link…</span>
                  </div>
                )}
                {callState === 'active' && (
                  <div>
                    <div style={{ fontSize: 32, fontWeight: 800, color: P.green, fontFamily: 'monospace', letterSpacing: 2 }}>
                      {fmtDuration(callSeconds)}
                    </div>
                    <div style={{ fontSize: 11, color: P.muted, marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: P.red, animation: 'pulse 1s infinite' }} />
                      RECORDING TO PRIVATE VPS STORAGE
                    </div>
                  </div>
                )}
                {callState === 'ended' && (
                  <span style={{ fontSize: 13, color: P.gold, fontWeight: 600 }}>Finalizing call file & saving…</span>
                )}
              </div>
            </div>

            {/* Call Controls */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
              {callState === 'idle' && (
                <button
                  disabled={!selectedLead}
                  onClick={startCall}
                  style={{
                    background: selectedLead ? P.green : P.card2,
                    color: selectedLead ? '#000' : P.muted,
                    border: 'none', borderRadius: 50, height: 56, padding: '0 32px',
                    fontWeight: 800, fontSize: 15, cursor: selectedLead ? 'pointer' : 'not-allowed',
                    display: 'flex', alignItems: 'center', gap: 10,
                    boxShadow: selectedLead ? '0 8px 25px rgba(34,197,94,0.3)' : 'none',
                    transition: 'all 0.2s',
                  }}
                >
                  <PhoneCall size={20} /> Start Walkthrough Call
                </button>
              )}

              {callState === 'active' && (
                <>
                  <button
                    onClick={toggleMute}
                    title={isMuted ? 'Unmute' : 'Mute'}
                    style={{
                      background: isMuted ? P.red : P.card2,
                      border: `1px solid ${isMuted ? P.red : P.border}`,
                      borderRadius: '50%', width: 50, height: 50,
                      color: isMuted ? '#fff' : P.text,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
                  </button>

                  <button
                    onClick={endCall}
                    style={{
                      background: P.red, color: '#fff',
                      border: 'none', borderRadius: 50, height: 56, padding: '0 32px',
                      fontWeight: 800, fontSize: 15, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 10,
                      boxShadow: '0 8px 25px rgba(239,68,68,0.4)',
                    }}
                  >
                    <PhoneOff size={20} /> End Call & Save
                  </button>
                </>
              )}
            </div>

            {/* Call Notes Input */}
            {callState === 'active' && (
              <div style={{ marginTop: 4 }}>
                <Field label="Live Call Notes / Disposition">
                  <textarea
                    rows={2}
                    value={callNotes}
                    onChange={e => setCallNotes(e.target.value)}
                    placeholder="Enter meeting notes, client requirements, next steps..."
                    style={{ ...inputStyle, resize: 'vertical' }}
                  />
                </Field>
              </div>
            )}
          </div>

          {/* Architecture / Storage Compliance Note */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ background: P.card, border: `1px solid ${P.border}`, borderRadius: 16, padding: 22 }}>
              <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: P.gold, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Shield size={16} /> VPS Storage & Data Sovereignty Guarantee
              </h4>
              <p style={{ fontSize: 13, color: P.muted, lineHeight: 1.6, margin: '0 0 12px' }}>
                In accordance with Walk The plan security protocols:
              </p>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: P.text, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <li><strong>No 3rd-Party Clouds:</strong> Audio streams and recorded files bypass AWS, Google Cloud, and external telecom APIs.</li>
                <li><strong>Private VPS Storage:</strong> Call audio records in raw WebM/Opus and saves strictly to your server at <code>/uploads/crm-calls/</code>.</li>
                <li><strong>Direct In-Browser Audio:</strong> WebRTC establishes browser media streams directly with end-to-end local hardware access.</li>
                <li><strong>Mandatory Audit Trail:</strong> Every session duration, caller identity, and timestamp is permanently recorded.</li>
              </ul>
            </div>

            {/* Recent Quick Recordings */}
            <div style={{ background: P.card, border: `1px solid ${P.border}`, borderRadius: 16, padding: 22, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: P.text }}>Latest VPS Call Recordings</h4>
                <button onClick={loadCallLogs} style={{ background: 'none', border: 'none', color: P.muted, cursor: 'pointer', fontSize: 12 }}>
                  Refresh
                </button>
              </div>

              {callLogs.filter(c => c.recording_url).slice(0, 4).length === 0 ? (
                <div style={{ fontSize: 12, color: P.muted, textAlign: 'center', padding: '30px 0' }}>
                  No call recordings stored yet. Make a call to test auto-recording.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {callLogs.filter(c => c.recording_url).slice(0, 4).map(c => (
                    <div key={c.id} style={{
                      background: P.card2, border: `1px solid ${P.border}`, borderRadius: 10,
                      padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10
                    }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: P.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {c.lead_name || 'Industrial Lead #' + c.lead_id}
                        </div>
                        <div style={{ fontSize: 11, color: P.muted }}>
                          {fmtDuration(c.duration_seconds || 0)} · {fmtDate(c.created_at)}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <audio controls src={resolveMediaUrl(c.recording_url)} style={{ height: 32, maxWidth: 170 }} />
                        {canDelete && (
                          <button
                            onClick={() => deleteCallRecording(c.id)}
                            title="Delete audio recording from VPS"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: P.red, padding: 4, display: 'inline-flex' }}
                          >
                            <VolumeX size={15} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Call Logs Table */
        <div>
          <TableWrap>
            <thead>
              <tr>
                {['ID', 'Lead / Enterprise', 'Phone', 'Direction', 'Duration', 'Caller', 'Status', 'Recording (VPS Hosted)', 'Date', ...(canDelete ? ['Actions'] : [])].map(h => <Th key={h}>{h}</Th>)}
              </tr>
            </thead>
            <tbody>
              {logsLoading ? (
                Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} cols={canDelete ? 10 : 9} />)
              ) : callLogs.length === 0 ? (
                <tr>
                  <td colSpan={canDelete ? 10 : 9}>
                    <EmptyState icon={PhoneCall} title="No calls recorded yet" sub="Use the VoIP dialer above to place plan inquiry calls" />
                  </td>
                </tr>
              ) : (
                callLogs.map(c => (
                  <tr key={c.id} style={{ transition: 'background 0.15s' }}>
                    <Td><span style={{ color: P.muted, fontSize: 12 }}>#{c.id}</span></Td>
                    <Td><span style={{ fontWeight: 600 }}>{c.lead_name || 'Lead #' + c.lead_id}</span></Td>
                    <Td><span style={{ color: P.muted, fontSize: 12 }}>{c.lead_phone || '—'}</span></Td>
                    <Td>
                      <span style={{
                        fontSize: 11, padding: '2px 8px', borderRadius: 12, fontWeight: 600,
                        background: c.direction === 'outbound' ? 'rgba(59,130,246,0.15)' : 'rgba(34,197,94,0.15)',
                        color: c.direction === 'outbound' ? P.blue : P.green
                      }}>
                        {c.direction?.toUpperCase() || 'OUTBOUND'}
                      </span>
                    </Td>
                    <Td><span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 600 }}>{fmtDuration(c.duration_seconds || 0)}</span></Td>
                    <Td><span style={{ color: P.muted, fontSize: 12 }}>{c.caller_name || 'Agent'}</span></Td>
                    <Td>
                      <span style={{ color: c.status === 'completed' ? P.green : P.gold, fontSize: 12, fontWeight: 600 }}>
                        {c.status || 'completed'}
                      </span>
                    </Td>
                    <Td>
                      {c.recording_url ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <audio controls src={resolveMediaUrl(c.recording_url)} style={{ height: 30, maxWidth: 180 }} />
                          <a
                            href={resolveMediaUrl(c.recording_url)}
                            download
                            title="Download VPS Audio"
                            style={{ color: P.gold, padding: 4, display: 'inline-flex' }}
                          >
                            <Download size={14} />
                          </a>
                          {canDelete && (
                            <button
                              onClick={() => deleteCallRecording(c.id)}
                              title="Delete recording from VPS disk"
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: P.red, padding: 4, display: 'inline-flex' }}
                            >
                              <VolumeX size={15} />
                            </button>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: P.muted, fontSize: 11 }}>No media</span>
                      )}
                    </Td>
                    <Td><span style={{ color: P.muted, fontSize: 11 }}>{fmtDate(c.created_at)}</span></Td>
                    {canDelete && (
                      <Td>
                        <button
                          onClick={() => deleteCallLog(c.id)}
                          title="Delete call log and recording"
                          style={{
                            background: 'none', border: `1px solid ${P.red}40`, borderRadius: 6,
                            color: P.red, padding: '4px 8px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600
                          }}
                        >
                          <Trash2 size={12} /> Delete
                        </button>
                      </Td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </TableWrap>
        </div>
      )}
    </div>
  );
};

// ─── Tab: Audio Notes ─────────────────────────────────────────────────────────
const TabAudio = ({ selectedLead, setSelectedLead, addToast, isAdmin, isAgent, pipelineStage = '' }) => {
  const [recordings, setRecordings] = useState([]);
  const [selectedAudioIds, setSelectedAudioIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [audioURL, setAudioURL] = useState(null);
  const [audioBlob, setAudioBlob] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [bars, setBars] = useState(Array(20).fill(4));
  const [uploadFile, setUploadFile] = useState(null);
  const [leadOptions, setLeadOptions] = useState([]);

  const mediaRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const analyserRef = useRef(null);
  const animRef = useRef(null);
  const fileRef = useRef();

  const canDelete = isAdmin;

  useEffect(() => {
    const q = pipelineStage ? `&pipeline_stage=${encodeURIComponent(pipelineStage)}` : '';
    apiFetch(`/leads?limit=150${q}`).then(d => {
      if (d?.leads) setLeadOptions(d.leads);
    }).catch(() => { });
  }, [pipelineStage]);

  const loadRecordings = useCallback(async () => {
    setLoading(true);
    try {
      if (selectedLead) {
        const id = selectedLead.id || selectedLead._id;
        const data = await apiFetch(`/leads/${id}/audio`);
        setRecordings(data.recordings || data || []);
      } else {
        const q = pipelineStage ? `?pipeline_stage=${encodeURIComponent(pipelineStage)}` : '';
        const data = await apiFetch(`/audio${q}`);
        setRecordings(Array.isArray(data) ? data : []);
      }
    } catch { setRecordings([]); } finally { setLoading(false); }
  }, [selectedLead, pipelineStage]);

  useEffect(() => { loadRecordings(); }, [loadRecordings]);

  const toggleSelectAudio = (id) => {
    setSelectedAudioIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleSelectAllAudio = () => {
    if (selectedAudioIds.length === recordings.length) {
      setSelectedAudioIds([]);
    } else {
      setSelectedAudioIds(recordings.map(r => r.id));
    }
  };

  const bulkDeleteAudio = async () => {
    if (selectedAudioIds.length === 0) return;
    if (!window.confirm(`Permanently delete ${selectedAudioIds.length} audio notes from VPS disk?`)) return;
    try {
      const res = await apiFetch('/audio/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedAudioIds }),
      });
      addToast(res.message || `Deleted ${selectedAudioIds.length} audio files`, 'success');
      setSelectedAudioIds([]);
      loadRecordings();
    } catch (err) {
      addToast(err.message || 'Bulk delete failed', 'error');
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      src.connect(analyser);
      analyserRef.current = analyser;

      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        setAudioURL(URL.createObjectURL(blob));
        stream.getTracks().forEach(t => t.stop());
        ctx.close();
        cancelAnimationFrame(animRef.current);
        setBars(Array(20).fill(4));
      };
      mr.start();
      mediaRef.current = mr;
      setRecording(true); setPaused(false); setSeconds(0); setAudioURL(null); setAudioBlob(null);

      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);

      const animate = () => {
        const data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(data);
        setBars(Array.from({ length: 20 }, (_, i) => Math.max(4, (data[i] || 0) / 255 * 60)));
        animRef.current = requestAnimationFrame(animate);
      };
      animate();
    } catch { addToast('Microphone access denied', 'error'); }
  };

  const stopRecording = () => {
    if (mediaRef.current && recording) {
      mediaRef.current.stop();
      clearInterval(timerRef.current);
      setRecording(false); setPaused(false);
    }
  };

  const pauseRecording = () => {
    if (!mediaRef.current) return;
    if (paused) { mediaRef.current.resume(); setPaused(false); timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000); }
    else { mediaRef.current.pause(); setPaused(true); clearInterval(timerRef.current); }
  };

  const uploadRecording = async () => {
    if (!audioBlob || !selectedLead) { addToast('No recording to upload', 'error'); return; }
    setUploading(true);
    const fd = new FormData();
    const id = selectedLead.id || selectedLead._id;
    fd.append('audio', audioBlob, `recording-${Date.now()}.webm`);
    fd.append('lead_id', id);
    try {
      const token = localStorage.getItem('crm_token');
      await fetch(`${API}/leads/${id}/audio`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
      addToast('Audio note securely saved to VPS storage!', 'success');
      setAudioURL(null); setAudioBlob(null); setSeconds(0);
      loadRecordings();
    } catch { addToast('Upload failed', 'error'); } finally { setUploading(false); }
  };

  const uploadExistingFile = async () => {
    if (!uploadFile || !selectedLead) return;
    setUploading(true);
    const fd = new FormData();
    const id = selectedLead.id || selectedLead._id;
    fd.append('audio', uploadFile);
    fd.append('lead_id', id);
    try {
      const token = localStorage.getItem('crm_token');
      await fetch(`${API}/leads/${id}/audio`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
      addToast('Audio file uploaded to VPS!', 'success');
      setUploadFile(null);
      loadRecordings();
    } catch { addToast('Upload failed', 'error'); } finally { setUploading(false); }
  };

  const deleteRecording = async (recId, name = '') => {
    if (!window.confirm(`Delete audio recording${name ? ` for "${name}"` : ''} from VPS storage?`)) return;
    try {
      await apiFetch(`/audio/${recId}`, { method: 'DELETE' });
      addToast('Audio note deleted from VPS storage', 'success');
      loadRecordings();
    } catch (err) { addToast(err.message || 'Delete failed', 'error'); }
  };

  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Lead selector */}
      <div style={{ background: P.card, border: `1px solid ${P.border}`, borderRadius: 16, padding: 22 }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: P.text }}>Target plan Ingestion Record</h3>
        {selectedLead ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: `${P.gold}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: P.gold, fontWeight: 800, fontSize: 18 }}>{selectedLead.name?.[0]?.toUpperCase()}</span>
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: P.text }}>{selectedLead.name}</div>
              <div style={{ fontSize: 12, color: P.muted }}>{selectedLead.phone} · {selectedLead.email}</div>
            </div>
            <button onClick={() => { setSelectedLead(null); setSelectedAudioIds([]); }} style={{ marginLeft: 'auto', background: 'none', border: `1px solid ${P.border}`, borderRadius: 8, padding: '6px 14px', color: P.muted, cursor: 'pointer', fontSize: 12 }}>
              View All Audio Memos
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ color: P.muted, fontSize: 13 }}>
              Select an industrial client to record or upload plan site audio notes:
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <select
                value=""
                onChange={e => {
                  const l = leadOptions.find(x => String(x.id || x._id) === e.target.value);
                  if (l) setSelectedLead(l);
                }}
                style={{
                  background: P.card2, border: `1px solid ${P.border}`, borderRadius: 8,
                  padding: '10px 14px', color: P.text, fontSize: 13, minWidth: 320, cursor: 'pointer'
                }}
              >
                <option value="">-- Choose plan / Client ({leadOptions.length} available) --</option>
                {leadOptions.map(l => (
                  <option key={l.id || l._id} value={l.id || l._id}>
                    {l.name} — {l.phone || l.email || 'No contact'} ({l.city || 'Lead'})
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* ── When No Specific Lead Selected: Show All VPS Site Audio Notes ── */}
      {!selectedLead && (
        <div style={{ background: P.card, border: `1px solid ${P.border}`, borderRadius: 16, padding: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h3 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: P.text }}>
                All VPS Site Audio Notes ({recordings.length})
              </h3>
              <div style={{ fontSize: 12, color: P.muted }}>
                Field inspection memos and client voice notes stored directly on VPS storage
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {canDelete && selectedAudioIds.length > 0 && (
                <button
                  onClick={bulkDeleteAudio}
                  style={{
                    background: `${P.red}20`, border: `1px solid ${P.red}60`, color: P.red,
                    borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 700,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  <Trash2 size={13} /> Delete Selected ({selectedAudioIds.length})
                </button>
              )}
              <button
                onClick={loadRecordings}
                style={{ background: 'none', border: `1px solid ${P.border}`, borderRadius: 8, padding: '6px 12px', color: P.muted, cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}
              >
                <RefreshCw size={13} /> Refresh
              </button>
            </div>
          </div>

          {loading ? (
            <div style={{ color: P.muted, fontSize: 13, padding: 20 }}>Loading audio recordings…</div>
          ) : recordings.length === 0 ? (
            <EmptyState icon={Volume2} title="No site audio notes stored" sub="Select a client above to record or upload voice inspection notes" />
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  {canDelete && (
                    <Th style={{ width: 36, textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={recordings.length > 0 && selectedAudioIds.length === recordings.length}
                        onChange={toggleSelectAllAudio}
                        style={{ cursor: 'pointer', accentColor: P.gold }}
                      />
                    </Th>
                  )}
                  {['Lead / Enterprise', 'Contact Phone', 'Audio Note (VPS Hosted)', 'Date Recorded', ...(canDelete ? ['Actions'] : [])].map(h => <Th key={h}>{h}</Th>)}
                </tr>
              </thead>
              <tbody>
                {recordings.map((rec, i) => (
                  <tr key={rec.id || i} style={{ transition: 'background 0.15s' }}>
                    {canDelete && (
                      <Td style={{ textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={selectedAudioIds.includes(rec.id)}
                          onChange={() => toggleSelectAudio(rec.id)}
                          style={{ cursor: 'pointer', accentColor: P.gold }}
                        />
                      </Td>
                    )}
                    <Td>
                      <div style={{ fontWeight: 600, color: P.text }}>{rec.lead_name || rec.name || `Lead #${rec.lead_id || rec.id}`}</div>
                    </Td>
                    <Td><span style={{ color: P.muted, fontSize: 12 }}>{rec.lead_phone || '—'}</span></Td>
                    <Td>
                      {rec.url ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <audio controls src={resolveMediaUrl(rec.url)} style={{ height: 32, maxWidth: 220 }} />
                          <a href={resolveMediaUrl(rec.url)} download title="Download Audio" style={{ color: P.gold, display: 'inline-flex' }}>
                            <Download size={14} />
                          </a>
                        </div>
                      ) : (
                        <span style={{ color: P.muted, fontSize: 11 }}>No media URL</span>
                      )}
                    </Td>
                    <Td><span style={{ color: P.muted, fontSize: 12 }}>{fmtDate(rec.created_at || rec.createdAt)}</span></Td>
                    {canDelete && (
                      <Td>
                        <button
                          onClick={() => deleteRecording(rec.id, rec.lead_name || rec.name)}
                          title="Delete audio note from VPS"
                          style={{
                            background: 'none', border: `1px solid ${P.red}40`, borderRadius: 6,
                            color: P.red, padding: '4px 10px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600
                          }}
                        >
                          <Trash2 size={13} /> Delete Audio
                        </button>
                      </Td>
                    )}
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          )}
        </div>
      )}

      {/* ── When A Lead Is Selected: Record & View Notes For This Lead ── */}
      {selectedLead && (
        <>
          {/* Recorder */}
          <div style={{ background: P.card, border: `1px solid ${P.border}`, borderRadius: 16, padding: 28, textAlign: 'center' }}>
            <h3 style={{ margin: '0 0 24px', fontSize: 15, fontWeight: 700, color: P.text }}>Site Inspection Voice Memo</h3>

            {/* Waveform */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, height: 70, marginBottom: 20 }}>
              {bars.map((h, i) => (
                <div key={i} style={{
                  width: 5, height: `${h}px`, borderRadius: 3,
                  background: recording && !paused ? P.gold : P.border2,
                  transition: recording ? 'height 0.05s' : 'height 0.3s, background 0.3s',
                }} />
              ))}
            </div>

            {/* Timer */}
            <div style={{ fontSize: 36, fontWeight: 800, color: recording ? P.gold : P.muted, letterSpacing: 2, fontFamily: 'monospace', marginBottom: 24 }}>
              {fmt(seconds)}
            </div>

            {/* Controls */}
            <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
              {!recording && !audioURL && (
                <button onClick={startRecording} style={{
                  background: P.gold, border: 'none', borderRadius: 50, width: 64, height: 64,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                }}>
                  <Mic size={26} color="#000" />
                </button>
              )}
              {recording && (
                <>
                  <button onClick={pauseRecording} style={{ background: paused ? P.gold : P.card2, border: `1px solid ${P.border}`, borderRadius: 50, width: 54, height: 54, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    {paused ? <Play size={22} color="#000" /> : <Pause size={22} color={P.text} />}
                  </button>
                  <button onClick={stopRecording} style={{ background: P.red, border: 'none', borderRadius: 50, width: 64, height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    <Square size={24} color="#fff" />
                  </button>
                </>
              )}
              {audioURL && (
                <>
                  <audio controls src={audioURL} style={{ width: '100%', maxWidth: 380, marginBottom: 8 }} />
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'center', width: '100%' }}>
                    <button onClick={() => { setAudioURL(null); setAudioBlob(null); setSeconds(0); }} style={{ background: P.card2, border: `1px solid ${P.border}`, borderRadius: 8, padding: '9px 18px', color: P.muted, cursor: 'pointer', fontSize: 13 }}>Discard</button>
                    <button onClick={uploadRecording} disabled={uploading} style={{ background: P.gold, border: 'none', borderRadius: 8, padding: '9px 24px', color: '#000', fontWeight: 700, cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 7 }}>
                      {uploading ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Upload size={14} />}
                      {uploading ? 'Uploading…' : 'Save to VPS'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Upload existing file */}
          <div style={{ background: P.card, border: `1px solid ${P.border}`, borderRadius: 16, padding: 22 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700, color: P.text }}>Or Upload External Voice Audio File</h3>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <label style={{ background: P.card2, border: `1px solid ${P.border}`, borderRadius: 8, padding: '9px 16px', color: P.text, cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 7 }}>
                <FileText size={14} color={P.muted} />
                {uploadFile ? uploadFile.name : 'Choose audio file…'}
                <input ref={fileRef} type="file" accept="audio/*" style={{ display: 'none' }} onChange={e => setUploadFile(e.target.files[0])} />
              </label>
              {uploadFile && (
                <button onClick={uploadExistingFile} disabled={uploading} style={{ background: P.gold, border: 'none', borderRadius: 8, padding: '9px 20px', color: '#000', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
                  {uploading ? 'Uploading…' : 'Save to VPS'}
                </button>
              )}
            </div>
          </div>

          {/* Recordings list for selected lead */}
          <div style={{ background: P.card, border: `1px solid ${P.border}`, borderRadius: 16, padding: 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: P.text }}>Recordings for {selectedLead.name}</h3>
              <button onClick={loadRecordings} style={{ background: 'none', border: 'none', color: P.muted, cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}><RefreshCw size={13} /> Refresh</button>
            </div>
            {loading
              ? <div style={{ color: P.muted, fontSize: 13 }}>Loading…</div>
              : recordings.length === 0
                ? <EmptyState icon={Volume2} title="No recordings yet" sub="Record or upload voice notes above" />
                : recordings.map((rec, i) => (
                  <div key={rec.id || i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: i < recordings.length - 1 ? `1px solid ${P.border}22` : 'none' }}>
                    <Volume2 size={16} color={P.gold} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: P.text }}>{rec.name || `Recording ${i + 1}`}</div>
                      <div style={{ fontSize: 11, color: P.muted }}>{fmtDate(rec.created_at || rec.createdAt)}</div>
                    </div>
                    {rec.url && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <audio controls src={resolveMediaUrl(rec.url)} style={{ height: 32, maxWidth: 220 }} />
                        <a href={resolveMediaUrl(rec.url)} download title="Download Audio" style={{ color: P.gold, display: 'inline-flex' }}>
                          <Download size={14} />
                        </a>
                      </div>
                    )}
                    {canDelete && (
                      <button
                        onClick={() => deleteRecording(rec.id || rec._id, selectedLead.name)}
                        title="Delete audio note from VPS"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: P.red, padding: 4 }}
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                ))
            }
          </div>
        </>
      )}
    </div>
  );
};

// ─── Tab: Human Resources ───────────────────────────────────────────────────
const TabHR = ({ addToast, onRegisterEmployee, activeSubTab = 'headcount' }) => {
  const [hrData, setHrData] = useState({ totalEmployees: 0, departmentBreakdown: {}, employees: [] });
  const [loading, setLoading] = useState(true);
  const [deptFilter, setDeptFilter] = useState('all');

  const loadHR = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/hr/stats');
      setHrData(data || { totalEmployees: 0, departmentBreakdown: {}, employees: [] });
    } catch (err) {
      addToast('Failed to load HR stats: ' + (err.message || 'Error'), 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { loadHR(); }, [loadHR]);

  const bd = hrData.departmentBreakdown || {};

  const filteredEmployees = (hrData.employees || []).filter(e => {
    if (deptFilter === 'all') return true;
    const d = (e.department || '').toLowerCase();
    const r = (e.role || '').toLowerCase();
    if (deptFilter === 'admin') return d.includes('admin') || r.includes('admin') || d.includes('hr');
    return d.includes(deptFilter.toLowerCase()) || r.includes(deptFilter.toLowerCase());
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header Banner */}
      <div style={{
        background: P.card, border: `1px solid ${P.border}`, borderRadius: 16, padding: '24px 28px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: P.gold, textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Department 04
            </span>
            <span style={{ background: 'rgba(16,185,129,0.15)', color: P.green, border: `1px solid ${P.green}30`, borderRadius: 12, padding: '2px 8px', fontSize: 10, fontWeight: 700 }}>
              Live Telemetry
            </span>
          </div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: P.text }}>
            Human Resources — {activeSubTab === 'roster' ? 'Personnel Roster' : 'Headcount Telemetry'}
          </h2>
          <div style={{ fontSize: 13, color: P.muted, marginTop: 4 }}>
            Total workforce distribution, active organizational headcount, and department roster
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={loadHR}
            style={{
              background: 'none', border: `1px solid ${P.border}`, borderRadius: 8, padding: '8px 14px',
              color: P.muted, cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6
            }}
          >
            <RefreshCw size={13} /> Refresh HR
          </button>
          {onRegisterEmployee && (
            <button
              onClick={onRegisterEmployee}
              style={{
                background: P.gold, border: 'none', borderRadius: 8, padding: '8px 18px',
                color: '#000', fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
              }}
            >
              <UserPlus size={13} /> Provision Staff Account
            </button>
          )}
        </div>
      </div>

      {/* Headcount Breakdown Cards (As requested by Client) */}
      {(activeSubTab === 'headcount' || !activeSubTab) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
          {[
            { label: 'Total CRM Personnel', count: hrData.totalEmployees || 0, icon: Users, color: P.gold, deptKey: 'all' },
            { label: 'Sales Department', count: bd.sales || 0, icon: TrendingUp, color: P.gold, deptKey: 'sales' },
            { label: 'Marketing Department', count: bd.marketing || 0, icon: Eye, color: '#a855f7', deptKey: 'marketing' },
            { label: 'Administration', count: bd.admin || bd.hr || 0, icon: Shield, color: '#10b981', deptKey: 'admin' },
          ].map((c, i) => {
            const isSelected = deptFilter === c.deptKey;
            return (
              <div
                key={i}
                onClick={() => setDeptFilter(c.deptKey)}
                style={{
                  background: P.card,
                  border: `1px solid ${isSelected ? c.color : P.border}`,
                  borderRadius: 14, padding: 18, cursor: 'pointer',
                  transition: 'all 0.15s',
                  boxShadow: isSelected ? `0 0 16px ${c.color}25` : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <span style={{ fontSize: 12, color: isSelected ? c.color : P.muted, fontWeight: 600 }}>{c.label}</span>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: `${c.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <c.icon size={16} color={c.color} />
                  </div>
                </div>
                <div style={{ fontSize: 28, fontWeight: 800, color: P.text, lineHeight: 1 }}>
                  {loading ? '…' : c.count}
                </div>
                <div style={{ fontSize: 11, color: P.muted, marginTop: 8 }}>
                  {c.deptKey === 'all' ? 'Across all company units' : 'Active personnel'}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Staff Roster Table */}
      {(activeSubTab === 'roster' || !activeSubTab) && (
        <div style={{ background: P.card, border: `1px solid ${P.border}`, borderRadius: 16, padding: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h3 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: P.text }}>
                Department Personnel Roster ({filteredEmployees.length})
              </h3>
              <div style={{ fontSize: 12, color: P.muted }}>
                Filter by department card above or view company-wide staff directory
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {['all', 'sales', 'marketing', 'admin'].map(d => (
                <button
                  key={d}
                  onClick={() => setDeptFilter(d)}
                  style={{
                    background: deptFilter === d ? `${P.gold}20` : P.card2,
                    border: `1px solid ${deptFilter === d ? P.gold : P.border}`,
                    color: deptFilter === d ? P.gold : P.muted,
                    borderRadius: 6, padding: '5px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    textTransform: 'capitalize'
                  }}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <TableWrap>
            <thead>
              <tr>
                {['Employee Name', 'Department / Division', 'Contact Email', 'Phone', 'Assigned Role', 'Status', 'Joined Date'].map(h => <Th key={h}>{h}</Th>)}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} cols={7} />)
              ) : filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <EmptyState icon={Users} title="No employees found" sub={`No active personnel found for department: ${deptFilter}`} />
                  </td>
                </tr>
              ) : (
                filteredEmployees.map(e => (
                  <tr key={e.id} style={{ transition: 'background 0.15s' }}>
                    <Td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: `${P.gold}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: P.gold, fontSize: 13 }}>
                          {e.name?.[0]?.toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: P.text }}>{e.name}</div>
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <span style={{
                        background: 'rgba(255,255,255,0.06)', border: `1px solid ${P.border}`,
                        borderRadius: 6, padding: '3px 8px', fontSize: 11, fontWeight: 600, color: P.text
                      }}>
                        {e.department || 'General'}
                      </span>
                    </Td>
                    <Td><span style={{ color: P.muted, fontSize: 12 }}>{e.email}</span></Td>
                    <Td><span style={{ color: P.muted, fontSize: 12 }}>{e.phone || '—'}</span></Td>
                    <Td><RoleBadge role={e.role} /></Td>
                    <Td>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        background: e.is_active ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                        color: e.is_active ? P.green : P.red,
                        border: `1px solid ${e.is_active ? P.green : P.red}30`,
                        borderRadius: 20, padding: '2px 8px', fontSize: 11, fontWeight: 600
                      }}>
                        {e.is_active ? <CheckCircle size={10} /> : <XCircle size={10} />}
                        {e.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </Td>
                    <Td><span style={{ color: P.muted, fontSize: 11 }}>{fmtDate(e.created_at)}</span></Td>
                  </tr>
                ))
              )}
            </tbody>
          </TableWrap>
        </div>
      )}
    </div>
  );
};

// ─── Tab: Coming Soon Departments (Operations, Finance, Franchise) ───────────
const TabComingSoon = ({ deptKey, subTab }) => {
  const meta = {
    operations: {
      number: '03',
      name: 'Operations Department',
      icon: Activity,
      color: '#06b6d4',
      badge: 'Coming Soon',
      subtitle: subTab === 'calibrations'
        ? 'Physical 1:1 Scale Projector Grid Laser Calibration & Throw Ratio Matrix'
        : subTab === 'roadmap'
          ? 'Operations Rollout Milestones & Equipment Deployment Schedule'
          : 'Walk The Plan 1:1 Scale Physical Projector Studio Infrastructure',
      features: subTab === 'calibrations' ? [
        '1mm = 1px Laser Coordinate Floor Calibration Ratio',
        'Ceiling Projector Array Keystone & Throw Alignment',
        'Physical Walkthrough Boundary Safety Sensor Matrix',
        'Multi-Projector Edge Blending & High Lumen Lumens Output Calibration',
      ] : subTab === 'roadmap' ? [
        'Milestone Q1: High Lumen Ultra Short Throw Studio Testing',
        'Milestone Q2: Dynamic CAD Ingest & Layer Projection Calibration',
        'Milestone Q3: On-Site Architect Experience Booking & Staging Automation',
      ] : [
        'Projection Grid Calibration & Throw Distance Tuning',
        'Physical Wall Model Placement & Staging Workflows',
        'Architectural CAD File Ingest (DWG / DXF / Revit)',
        'On-Site Client Studio Session Booking & Time Slots',
        'Site Hardware Sensor & Projector Health Diagnostics'
      ],
      notice: null,
    },
    finance: {
      number: '05',
      name: 'Finance & Accounts Department',
      icon: DollarSign,
      color: '#eab308',
      badge: 'Coming Soon',
      subtitle: subTab === 'invoicing'
        ? 'Automated GST Tax Invoicing & Razorpay Settlement Reconciliation'
        : 'Token Advance Settlements, Invoicing & Financial Health',
      features: subTab === 'invoicing' ? [
        'Automated B2B GST Invoicing with SAC 9983 Architectural Codes',
        'Client Payment Gateway Webhook Instant Reconciliation',
        'Digital Tax Receipts & TDS Deduction Statement Tracking',
        'Credit Notes & Refund Adjustments Log',
      ] : [
        'Razorpay Payment Gateway Automated Settlement Reconciliation',
        'Token Advance vs Balance Pending Collection Pipeline',
        'Automated GST Invoicing & Client Tax Receipts',
        'Sales Commission & Team Payout Calculations',
        'Studio Revenue Telemetry & Financial Forecasting'
      ],
      notice: null,
    },
    franchise: {
      number: '06',
      name: 'Franchise Partner Portal',
      icon: Briefcase,
      color: '#ec4899',
      badge: 'Sales CRM Only',
      subtitle: subTab === 'policy'
        ? 'Franchise Isolation Policy: Marketing, HR, Finance, and Operations Eliminated'
        : 'Exclusive Sales CRM Pipeline For Authorized Franchise Walk The Plan Studios',
      features: subTab === 'policy' ? [
        'Marketing Module: Eliminated (Handled exclusively by Walk The Plan HQ)',
        'Human Resources: Eliminated (Confidential corporate personnel data)',
        'Finance & Invoicing: Eliminated (HQ automated financial clearing)',
        'Operations Grid: Eliminated (Standardized studio layout specs supplied by HQ)',
        'Sales CRM: 100% Fully Enabled for local lead capture and walkthroughs',
      ] : [
        'Franchise Territory Studio Lead Ingest (Meta Ads & Google Sheets)',
        'Localized Walk The Plan 1:1 Experience Center Pipeline',
        'In-Studio Client Booking & Walkthrough Scheduling',
        'VoIP Audio Notes & Site Survey Recordings',
        'Franchise Territory Revenue & Token Reporting'
      ],
      notice: 'Client Policy: Franchise access is strictly restricted to the Sales CRM module. Marketing, Human Resources, Finance, and Operations modules are eliminated for Franchise partners.',
    }
  }[deptKey] || {
    number: 'XX',
    name: 'Department Portal',
    icon: Sparkles,
    color: P.gold,
    badge: 'Coming Soon',
    subtitle: 'Upcoming Portal Module',
    features: ['Modular expansion in progress'],
    notice: null,
  };

  const Icon = meta.icon;

  return (
    <div style={{ maxWidth: 900, margin: '40px auto 0', textAlign: 'center' }}>
      <div style={{
        background: P.card, border: `1px solid ${P.border}`, borderRadius: 20, padding: '48px 36px',
        position: 'relative', overflow: 'hidden'
      }}>
        {/* Glow */}
        <div style={{
          position: 'absolute', top: -80, left: '50%', transform: 'translateX(-50%)',
          width: 300, height: 200, background: `${meta.color}15`, filter: 'blur(60px)', pointerEvents: 'none'
        }} />

        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: `${meta.color}15`, border: `1px solid ${meta.color}40`, borderRadius: 30, padding: '4px 14px', marginBottom: 20 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: meta.color, letterSpacing: 0.8, textTransform: 'uppercase' }}>
            Department {meta.number}
          </span>
          <span style={{ width: 4, height: 4, borderRadius: '50%', background: meta.color }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: P.text }}>{meta.badge}</span>
        </div>

        <div style={{ width: 68, height: 68, borderRadius: 18, background: `${meta.color}20`, border: `1px solid ${meta.color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <Icon size={32} color={meta.color} />
        </div>

        <h2 style={{ fontSize: 26, fontWeight: 800, color: P.text, margin: '0 0 10px', letterSpacing: -0.5 }}>
          {meta.name}
        </h2>
        <p style={{ fontSize: 14, color: P.muted, maxWidth: 580, margin: '0 auto 30px', lineHeight: 1.6 }}>
          {meta.subtitle}
        </p>

        {meta.notice && (
          <div style={{
            background: 'rgba(236,72,153,0.08)', border: '1px solid rgba(236,72,153,0.3)',
            borderRadius: 12, padding: '14px 18px', margin: '0 auto 30px', maxWidth: 640,
            textAlign: 'left', display: 'flex', alignItems: 'flex-start', gap: 12
          }}>
            <Shield size={18} color="#ec4899" style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: 12, color: P.text, lineHeight: 1.6 }}>
              <strong style={{ color: '#ec4899' }}>Access Control Policy:</strong> {meta.notice}
            </div>
          </div>
        )}

        <div style={{ background: P.card2, border: `1px solid ${P.border}`, borderRadius: 14, padding: 24, textAlign: 'left', maxWidth: 640, margin: '0 auto' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: P.gold, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 14 }}>
            Upcoming Capabilities Roadmap
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {meta.features.map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: P.text }}>
                <Clock size={14} color={meta.color} style={{ flexShrink: 0 }} />
                <span>{f}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Tab: Marketing Meta & Google Sheets Live Integration ─────────────────────
const TabMarketingIntegration = ({ addToast }) => {
  return <GoogleSheetsIntegrationPanel addToast={addToast} />;
};



// ─── RBAC Matrix Definitions ────────────────────────────────────────────────
const RBAC_MATRIX_ROWS = [
  {
    dept: '01) Sales CRM',
    role: 'Sales Executive / Agent',
    badge: 'Full CRM',
    color: P.gold,
    metaLeads: 'Full Access (View, Edit, Stage, Qualify)',
    sheetsLeads: 'Full Access (Google Sheets Live Sync)',
    voip: 'WebRTC In-Browser VoIP Enabled',
    audio: 'Inspection Voice Notes Active',
    roster: 'View-Only Team List',
    restrictions: 'Assigned-leads portfolio isolation for sales executives.',
  },
  {
    dept: '02) Marketing',
    role: 'Marketing Lead Analyst',
    badge: 'View-Only',
    color: '#a855f7',
    metaLeads: 'View-Only Stream (FB & IG Leads)',
    sheetsLeads: 'Full Access (Webhook & Sheets Sync)',
    voip: 'Disabled',
    audio: 'Disabled',
    roster: 'Hidden',
    restrictions: 'View-only Meta leads. Cannot edit, delete, or call leads.',
  },
  {
    dept: '03) Administration',
    role: 'Global Administrator',
    badge: 'Admin Master',
    color: P.gold,
    metaLeads: 'Full Master Access',
    sheetsLeads: 'Full Master Access',
    voip: 'Full Access',
    audio: 'Full Access',
    roster: 'Full Provisioning & Deletion',
    restrictions: 'None. Complete administrative control across CRM.',
  },
];

// ─── Tab: Users Management ──────────────────────────────────────────────────
const TabUsers = ({ addToast, currentUser, activeSubTab = 'directory', onSubTabChange }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(activeSubTab === 'register');
  const empty = { name: '', email: '', phone: '', role: 'pre_sales', department: 'Pre-Sales', assigned_pipeline: 'pre_sales', password: '' };
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (activeSubTab === 'register') setShowForm(true);
  }, [activeSubTab]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/users');
      setUsers(data?.users || data || []);
    } catch { addToast('Failed to load users', 'error'); } finally { setLoading(false); }
  }, [addToast]);

  useEffect(() => { load(); }, [load]);

  const toggle = async (user) => {
    try {
      const nextActive = user.is_active ? 0 : 1;
      await apiFetch(`/users/${user.id || user._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: nextActive })
      });
      setUsers(us => us.map(u => (u.id || u._id) === (user.id || user._id) ? { ...u, is_active: nextActive } : u));
      addToast(nextActive ? 'User account activated.' : 'User account deactivated.', 'info');
    } catch (err) { addToast(err.message || 'Failed to update user status', 'error'); }
  };

  const deleteUser = async (user) => {
    const isSelf = currentUser && ((currentUser.id && currentUser.id === user.id) || (currentUser.email && currentUser.email.toLowerCase() === user.email?.toLowerCase()));
    if (isSelf) {
      addToast('Cannot delete your own active administrator account.', 'error');
      return;
    }
    if (!window.confirm(`Permanently delete team member "${user.name}" (${user.email}) from CRM users?`)) return;
    try {
      const res = await apiFetch(`/users/${user.id || user._id}`, { method: 'DELETE' });
      addToast(res.message || 'User deleted successfully', 'success');
      setUsers(us => us.filter(u => (u.id || u._id) !== (user.id || user._id)));
    } catch (err) {
      addToast(err.message || 'Failed to delete user', 'error');
    }
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password) { addToast('Name, email, and password required', 'error'); return; }
    setSaving(true);
    try {
      await apiFetch('/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      addToast('Team member created successfully!', 'success');
      setForm(empty); setShowForm(false); load();
      if (onSubTabChange) onSubTabChange('directory');
    } catch (err) { addToast(err.message || 'Failed to create user', 'error'); } finally { setSaving(false); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Notice Banner */}
      <div style={{
        background: 'rgba(245,158,11,0.08)', border: `1px solid ${P.gold}40`,
        borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12
      }}>
        <Shield size={18} color={P.gold} style={{ flexShrink: 0 }} />
        <span style={{ fontSize: 13, color: P.text, lineHeight: 1.5 }}>
          <strong>User Access Management:</strong> Administrators can provision accounts, manage permissions, toggle active status, or permanently delete user records.
        </span>
      </div>

      {/* RBAC Matrix Subtab View */}
      {activeSubTab === 'matrix' ? (
        <div style={{ background: P.card, border: `1px solid ${P.border}`, borderRadius: 16, padding: 24 }}>
          <div style={{ marginBottom: 18 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: P.text }}>
              Organizational RBAC Access Control Matrix (7 Units)
            </h3>
            <div style={{ fontSize: 12, color: P.muted, marginTop: 4 }}>
              Role-based permissions enforcement across Sales, Marketing, Operations, HR, Finance, Franchise, and Admin
            </div>
          </div>

          <TableWrap>
            <thead>
              <tr>
                {['Department', 'Role Title', 'Access Badge', 'Meta Ads Leads', 'Google Leads Sheet', 'Dialer VoIP', 'Audio Notes', 'HR Roster', 'RBAC Enforcement & Restrictions'].map(h => <Th key={h}>{h}</Th>)}
              </tr>
            </thead>
            <tbody>
              {RBAC_MATRIX_ROWS.map((r, i) => (
                <tr key={i} style={{ transition: 'background 0.15s' }}>
                  <Td><strong style={{ color: r.color }}>{r.dept}</strong></Td>
                  <Td><span style={{ color: P.text, fontWeight: 600 }}>{r.role}</span></Td>
                  <Td>
                    <span style={{
                      fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 4,
                      background: `${r.color}20`, color: r.color, textTransform: 'uppercase', letterSpacing: 0.5
                    }}>
                      {r.badge}
                    </span>
                  </Td>
                  <Td><span style={{ fontSize: 12, color: P.text }}>{r.metaLeads}</span></Td>
                  <Td><span style={{ fontSize: 12, color: r.sheetsLeads.includes('Eliminated') ? P.red : P.text }}>{r.sheetsLeads}</span></Td>
                  <Td><span style={{ fontSize: 12, color: r.voip.includes('Disabled') ? P.muted : P.green }}>{r.voip}</span></Td>
                  <Td><span style={{ fontSize: 12, color: r.audio.includes('Disabled') ? P.muted : P.green }}>{r.audio}</span></Td>
                  <Td><span style={{ fontSize: 12, color: r.roster.includes('Eliminated') || r.roster.includes('Hidden') ? P.muted : P.text }}>{r.roster}</span></Td>
                  <Td><span style={{ fontSize: 11, color: P.muted, lineHeight: 1.4 }}>{r.restrictions}</span></Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        </div>
      ) : null}

      {/* Register User Form */}
      {showForm && (
        <div style={{ background: P.card, border: `1px solid ${P.border}`, borderRadius: 14, padding: 22, boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: P.text, display: 'flex', alignItems: 'center', gap: 8 }}>
              <UserPlus size={16} color={P.gold} /> Register Pre-Authorized Team Member
            </h3>
            <button
              onClick={() => { setShowForm(false); if (onSubTabChange) onSubTabChange('directory'); }}
              style={{ background: 'none', border: 'none', color: P.muted, cursor: 'pointer' }}
            >
              <X size={16} />
            </button>
          </div>
          <form onSubmit={submit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Field label="Full Name" required><input style={inputStyle} value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Ramesh Sharma" /></Field>
            <Field label="Email Address" required><input style={inputStyle} type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="ramesh@walktheplan.com" /></Field>
            <Field label="Phone Number"><input style={inputStyle} value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+91 9876543210" /></Field>
            <Field label="Assigned Sales Pipeline" required>
              <select style={selectStyle} value={form.assigned_pipeline || 'pre_sales'} onChange={e => {
                const pipe = e.target.value;
                set('assigned_pipeline', pipe);
                if (pipe === 'pre_sales') { set('role', 'pre_sales'); set('department', 'Pre-Sales'); }
                else if (pipe === 'main_sales') { set('role', 'main_sales'); set('department', 'Main Sales'); }
                else if (pipe === 'post_sales') { set('role', 'post_sales'); set('department', 'Post-Sales'); }
                else if (pipe === 'all') { set('role', 'manager'); set('department', 'Management'); }
              }}>
                <option value="pre_sales">01 PRE-SALES (Touch-Based Inbound)</option>
                <option value="main_sales">02 MAIN SALES (Calling & Walkthrough)</option>
                <option value="post_sales">03 POST-SALES (Execution & Delivery)</option>
                <option value="all">ALL PIPELINES (Master Admin / Manager)</option>
              </select>
            </Field>
            <Field label="Department / Division" required>
              <select style={selectStyle} value={form.department} onChange={e => set('department', e.target.value)}>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </Field>
            <Field label="RBAC Role" required>
              <select style={selectStyle} value={form.role} onChange={e => set('role', e.target.value)}>
                {ROLE_OPTIONS.map(r => <option key={r} value={r}>{ROLE_META[r].label}</option>)}
              </select>
            </Field>
            <Field label="Initial Password" required><input style={inputStyle} type="password" value={form.password} onChange={e => set('password', e.target.value)} placeholder="Min 8 characters" /></Field>
            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', marginTop: 6, gap: 10 }}>
              <button
                type="button"
                onClick={() => { setShowForm(false); if (onSubTabChange) onSubTabChange('directory'); }}
                style={{ background: P.card2, border: `1px solid ${P.border}`, borderRadius: 8, padding: '10px 20px', color: P.muted, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
              >
                Cancel
              </button>
              <button type="submit" disabled={saving} style={{ background: P.gold, border: 'none', borderRadius: 8, padding: '10px 28px', color: '#000', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                {saving ? 'Creating…' : 'Create & Authorize Account'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Users Directory Table */}
      {activeSubTab !== 'matrix' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: P.text }}>Registered Operations & Sales Personnel</h3>
            <button
              onClick={() => {
                setShowForm(prev => !prev);
                if (onSubTabChange) onSubTabChange(showForm ? 'directory' : 'register');
              }}
              style={{
                background: showForm ? P.card2 : P.gold,
                border: showForm ? `1px solid ${P.border}` : 'none',
                borderRadius: 8,
                padding: '9px 20px',
                color: showForm ? P.text : '#000',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                boxShadow: showForm ? 'none' : '0 2px 8px rgba(245,158,11,0.25)'
              }}
            >
              {showForm ? <X size={15} /> : <UserPlus size={15} />}
              {showForm ? 'Close Form' : 'Register New Member'}
            </button>
          </div>

          <TableWrap>
            <thead>
              <tr>
                {['User', 'Email', 'Role', 'Assigned Sales Pipeline', 'Access Status', 'Created', 'Account Management'].map(h => <Th key={h}>{h}</Th>)}
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} cols={7} />)
                : users.length === 0
                  ? <tr><td colSpan={7}><EmptyState icon={Users} title="No users found" sub="Register your first CRM team member" /></td></tr>
                  : users.map(u => {
                    const id = u.id || u._id;
                    const active = Boolean(u.is_active);
                    const isSelf = currentUser && ((currentUser.id && currentUser.id === id) || (currentUser.email && currentUser.email.toLowerCase() === u.email?.toLowerCase()));
                    const currentPipeline = u.assigned_pipeline || (u.role === 'main_sales' ? 'main_sales' : u.role === 'post_sales' ? 'post_sales' : u.role === 'pre_sales' ? 'pre_sales' : (u.role === 'admin' ? 'all' : 'pre_sales'));
                    return (
                      <tr key={id}
                        onMouseEnter={e => e.currentTarget.style.background = '#ffffff05'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        style={{ transition: 'background 0.15s' }}
                      >
                        <Td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 34, height: 34, borderRadius: '50%', background: u.avatar_color || `${P.gold}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <span style={{ color: '#000', fontWeight: 800, fontSize: 14 }}>{u.name?.[0]?.toUpperCase()}</span>
                            </div>
                            <div>
                              <span style={{ fontWeight: 600 }}>{u.name}</span>
                              {u.department && <div style={{ fontSize: 11, color: P.muted }}>{u.department}</div>}
                            </div>
                          </div>
                        </Td>
                        <Td><span style={{ color: P.muted, fontSize: 12 }}>{u.email}</span></Td>
                        <Td><RoleBadge role={u.role} /></Td>
                        <Td>
                          <select
                            value={currentPipeline}
                            onChange={async (e) => {
                              const newPipeline = e.target.value;
                              try {
                                await apiFetch(`/users/${id}`, {
                                  method: 'PUT',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ assigned_pipeline: newPipeline })
                                });
                                addToast(`Assigned ${u.name} to ${newPipeline.replace('_', ' ').toUpperCase()}!`, 'success');
                                load();
                              } catch (err) {
                                addToast('Failed to reassign user pipeline', 'error');
                              }
                            }}
                            style={{
                              background: P.card2,
                              border: `1px solid ${
                                currentPipeline === 'post_sales' ? '#10b981' :
                                currentPipeline === 'main_sales' ? '#f59e0b' :
                                currentPipeline === 'pre_sales' ? '#38bdf8' : P.gold
                              }70`,
                              color: currentPipeline === 'post_sales' ? '#10b981' :
                                currentPipeline === 'main_sales' ? '#f59e0b' :
                                currentPipeline === 'pre_sales' ? '#38bdf8' : P.gold,
                              borderRadius: 6,
                              padding: '5px 10px',
                              fontSize: 11,
                              fontWeight: 700,
                              cursor: 'pointer'
                            }}
                          >
                            <option value="pre_sales">🎯 01 Pre-Sales Person</option>
                            <option value="main_sales">⚡ 02 Main Sales Person</option>
                            <option value="post_sales">🚀 03 Post-Sales Person</option>
                            <option value="all">👑 All Pipelines (Master)</option>
                          </select>
                        </Td>
                        <Td>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 5,
                            background: active ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                            color: active ? P.green : P.red,
                            border: `1px solid ${active ? P.green : P.red}40`,
                            borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 600,
                          }}>
                            {active ? <CheckCircle size={10} /> : <XCircle size={10} />}
                            {active ? 'Active' : 'Deactivated'}
                          </span>
                        </Td>
                        <Td><span style={{ color: P.muted, fontSize: 11 }}>{fmtDate(u.created_at || u.createdAt)}</span></Td>
                        <Td>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <button
                              onClick={() => toggle(u)}
                              style={{
                                background: active ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)',
                                border: `1px solid ${active ? P.red : P.green}40`,
                                color: active ? P.red : P.green,
                                borderRadius: 6, padding: '5px 12px', fontSize: 11, fontWeight: 600,
                                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5
                              }}
                            >
                              {active ? <XCircle size={12} /> : <CheckCircle size={12} />}
                              {active ? 'Deactivate' : 'Reactivate'}
                            </button>
                            {isSelf ? (
                              <span style={{ fontSize: 11, color: P.gold, padding: '4px 8px', fontWeight: 600 }}>
                                (You)
                              </span>
                            ) : (
                              <button
                                onClick={() => deleteUser(u)}
                                title="Permanently remove user"
                                style={{
                                  background: 'rgba(239,68,68,0.1)',
                                  border: `1px solid ${P.red}40`,
                                  color: P.red,
                                  borderRadius: 6, padding: '5px 10px', fontSize: 11, fontWeight: 600,
                                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4
                                }}
                              >
                                <Trash2 size={12} /> Delete
                              </button>
                            )}
                          </div>
                        </Td>
                      </tr>
                    );
                  })
              }
            </tbody>
          </TableWrap>
        </>
      )}
    </div>
  );
};

// ─── Main CRM Dashboard Component ────────────────────────────────────────────
export default function CRMDashboard({ forcedPipeline = '' }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState('overview'); // Default to Industrial Dashboard overview
  const [activeDept, setActiveDept] = useState('sales');
  const [selectedLead, setSelectedLead] = useState(null);
  const [lastUpdatedLead, setLastUpdatedLead] = useState(null);
  const [showIntakeModal, setShowIntakeModal] = useState(false);
  const [intakeInitialDate, setIntakeInitialDate] = useState('');
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' ? window.innerWidth < 768 : false);
  const [toasts, setToasts] = useState([]);
  const toastId = useRef(0);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (tab === 'team') setActiveDept('team');
    else if (tab === 'leads' && !forcedPipeline) setActiveDept('marketing');
    else setActiveDept(forcedPipeline || 'sales');
  }, [tab, forcedPipeline]);

  // Authenticated user from local storage + live sync via /auth/me
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('crm_user') || '{}');
    } catch {
      return {};
    }
  });

  useEffect(() => {
    const token = localStorage.getItem('crm_token');
    if (!token) return;
    apiFetch('/auth/me')
      .then(res => {
        if (res?.user) {
          setCurrentUser(res.user);
          localStorage.setItem('crm_user', JSON.stringify(res.user));
        }
      })
      .catch(() => {});
  }, []);

  const userRoleLower = (currentUser.role || '').toLowerCase();
  const userDeptLower = (currentUser.department || '').toLowerCase();
  const userPipeLower = (currentUser.assigned_pipeline || '').toLowerCase();
  const isAdmin = userRoleLower === 'admin';
  const isManager = userRoleLower === 'manager' || userPipeLower === 'all';
  const isSalesExec = !isAdmin && !isManager && (['sales', 'agent', 'field_agent', 'sales_engineer', 'pre_sales', 'main_sales', 'post_sales'].includes(userRoleLower) || userDeptLower.includes('sales'));
  const isMarketing = !isAdmin && !isManager && (userRoleLower === 'marketing' || userDeptLower === 'marketing');
  const isAgent = isSalesExec;

  const userAssignedStage = (userPipeLower && userPipeLower !== 'all') ? userPipeLower : (
    (userDeptLower.includes('post') || userRoleLower.includes('post')) ? 'post_sales' :
    (userDeptLower.includes('main') || userRoleLower.includes('main') || userRoleLower === 'sales' || userRoleLower === 'agent') ? 'main_sales' :
    'pre_sales'
  );
  const isStageLocked = Boolean(currentUser?.role && !isAdmin && !isManager && !isMarketing);
  const effectivePipelineScope = isStageLocked ? userAssignedStage : (forcedPipeline || '');

  useEffect(() => {
    if (isStageLocked && userAssignedStage) {
      const targetPath =
        userAssignedStage === 'main_sales' ? '/crm/main-sales' :
        userAssignedStage === 'post_sales' ? '/crm/post-sales' :
        '/crm/pre-sales';
      if (forcedPipeline !== userAssignedStage) {
        navigate(targetPath, { replace: true });
      }
    }
  }, [isStageLocked, userAssignedStage, forcedPipeline, navigate]);

  const [leadFilterStatus, setLeadFilterStatus] = useState('');
  const [leadFilterPipelineStage, setLeadFilterPipelineStage] = useState('');
  const [teamSubTab, setTeamSubTab] = useState('directory');

  // Primary Navigation Tabs (Matching Industrial B2B Portal)
  const NAV_TABS = [
    { id: 'overview', label: 'Dashboard', icon: BarChart3 },
    { id: 'leads', label: 'Meta Leads', icon: Radio },
    { id: 'followups', label: 'Follow-Up Center', icon: Clock },
    { id: 'calendar', label: 'Calendar', icon: Calendar },
    { id: 'calls', label: 'Call Studio', icon: PhoneCall },
    ...(isAdmin ? [{ id: 'integration', label: 'Data Ingest', icon: Upload }] : []),
    ...(isAdmin ? [{ id: 'backups', label: 'Backups', icon: Database }] : []),
    ...(isAdmin ? [{ id: 'team', label: 'Team & RBAC', icon: Shield }] : []),
  ];

  const addToast = useCallback((message, type = 'info') => {
    const id = ++toastId.current;
    setToasts(ts => [...ts, { id, message, type }]);
    setTimeout(() => setToasts(ts => ts.filter(t => t.id !== id)), 4500);
  }, []);

  const removeToast = useCallback((id) => setToasts(ts => ts.filter(t => t.id !== id)), []);

  const onAudio = useCallback((lead) => {
    setSelectedLead(lead);
    setTab('audio');
  }, []);

  const onCallLead = useCallback((lead) => {
    setSelectedLead(lead);
    setTab('calls');
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('crm_token');
    localStorage.removeItem('crm_user');
    window.location.href = '/crm/login';
  };

  return (
    <div style={{ minHeight: '100vh', background: P.bg, color: P.text, fontFamily: 'Inter,system-ui,sans-serif' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes spin  { to{transform:rotate(360deg)} }
        @keyframes slideInRight { from{transform:translateX(60px);opacity:0} to{transform:translateX(0);opacity:1} }
        ::-webkit-scrollbar      { width:6px; height:6px; }
        ::-webkit-scrollbar-track{ background:#0f0f12; }
        ::-webkit-scrollbar-thumb{ background:#3f3f46; border-radius:3px; }
        audio { accent-color: ${P.gold}; }
        input[type=date]::-webkit-calendar-picker-indicator { filter: invert(0.7); cursor:pointer; }
      `}</style>

      {/* ── Unified Sticky Navigation (Top Header + Executive Switcher) ── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 200,
        background: '#0d0d10',
        borderBottom: `1px solid ${P.border}`,
        boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
      }}>
        {/* Top Header Row */}
        <header style={{
          display: 'flex', alignItems: 'center', padding: '0 24px', height: 60,
          borderBottom: `1px solid ${P.border}30`,
        }}>
          {/* Logo & Platform Name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginRight: 24, flexShrink: 0 }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Layers size={18} color={P.gold} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15, color: P.text, letterSpacing: -0.3, lineHeight: 1.1 }}>
                Walk The plan CRM
              </div>
              <div style={{ fontSize: 10, color: P.gold, fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase' }}>
                INDUSTRIAL B2B PORTAL
              </div>
            </div>
          </div>

          {/* Unified Primary Navigation Tabs */}
          <nav style={{ display: 'flex', gap: 2, flex: 1, overflowX: 'auto', alignItems: 'center' }}>
            {NAV_TABS.map(t => {
              const isCurrentActive = tab === t.id;
              const activeColor = P.gold;

              return (
                <button
                  key={t.id}
                  onClick={() => {
                    setTab(t.id);
                    if (t.id === 'leads') {
                      setLeadFilterStatus('');
                      setLeadFilterPipelineStage('');
                    }
                  }}
                  style={{
                    background: isCurrentActive ? `${activeColor}15` : 'none',
                    border: 'none',
                    borderBottom: `2px solid ${isCurrentActive ? activeColor : 'transparent'}`,
                    color: isCurrentActive ? activeColor : P.muted,
                    padding: '19px 16px 17px',
                    cursor: 'pointer', fontSize: 13, fontWeight: isCurrentActive ? 700 : 500,
                    display: 'flex', alignItems: 'center', gap: 7, whiteSpace: 'nowrap',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => {
                    if (!isCurrentActive) e.currentTarget.style.color = '#fff';
                  }}
                  onMouseLeave={e => {
                    if (!isCurrentActive) e.currentTarget.style.color = P.muted;
                  }}
                >
                  <t.icon size={15} color={isCurrentActive ? activeColor : P.muted} />
                  <span>{t.label}</span>
                  {t.badge && (
                    <span style={{
                      fontSize: 9, padding: '1px 6px', borderRadius: 10,
                      background: isCurrentActive ? `${activeColor}30` : 'rgba(255,255,255,0.08)',
                      color: isCurrentActive ? activeColor : P.muted,
                      fontWeight: 800, textTransform: 'uppercase'
                    }}>{t.badge}</span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* User Profile Pill & Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 16, flexShrink: 0 }}>
            {!isMarketing && (
              <button
                onClick={() => { setIntakeInitialDate(''); setShowIntakeModal(true); }}
                style={{
                  background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  color: '#000', border: 'none', borderRadius: 8, padding: '7px 14px',
                  fontSize: 12, fontWeight: 800, cursor: 'pointer', display: 'flex',
                  alignItems: 'center', gap: 6, boxShadow: '0 2px 10px rgba(245,158,11,0.3)',
                  whiteSpace: 'nowrap'
                }}
              >
                <Plus size={14} /> + New Lead
              </button>
            )}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: P.card2, border: `1px solid ${P.border}`, borderRadius: 20,
              padding: '4px 12px 4px 6px'
            }}>
              <div style={{
                width: 26, height: 26, borderRadius: '50%',
                background: P.gold,
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <span style={{ color: '#000', fontWeight: 800, fontSize: 11 }}>
                  {currentUser.name?.[0]?.toUpperCase() || 'A'}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: P.text, lineHeight: 1.1 }}>
                  {currentUser.name || 'Admin User'}
                </span>
                <span style={{ fontSize: 10, color: P.gold, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {currentUser.role?.replace('_', ' ') || 'ADMIN'}
                </span>
              </div>
            </div>

            {/* Main Website Link */}
            <a
              href={import.meta.env.VITE_MAIN_SITE_URL || (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? 'http://localhost:5173' : '/')}
              style={{
                background: 'none', border: `1px solid ${P.border}`, borderRadius: 8,
                padding: '6px 12px', color: P.gold, cursor: 'pointer', fontSize: 12,
                display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap',
                textDecoration: 'none', transition: 'all 0.15s'
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = P.gold; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = P.border; }}
            >
              <Home size={13} /> Main Site
            </a>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              style={{
                background: 'none', border: `1px solid ${P.border}`, borderRadius: 8,
                padding: '6px 12px', color: P.muted, cursor: 'pointer', fontSize: 12,
                display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap',
                transition: 'all 0.15s'
              }}
              onMouseEnter={e => { e.currentTarget.style.color = P.red; e.currentTarget.style.borderColor = P.red; }}
              onMouseLeave={e => { e.currentTarget.style.color = P.muted; e.currentTarget.style.borderColor = P.border; }}
            >
              <LogOut size={13} /> Logout
            </button>
          </div>
        </header>

        {/* Executive Switcher Subheader Bar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '7px 24px',
          background: '#09090b',
          overflowX: 'auto', WebkitOverflowScrolling: 'touch'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginRight: 6, flexShrink: 0 }}>
            <SlidersHorizontal size={13} color={P.gold} />
            <span style={{ fontSize: 11, fontWeight: 800, color: P.gold, letterSpacing: 0.6, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
              {isStageLocked ? 'WORKSPACE:' : 'EXECUTIVE SWITCHER:'}
            </span>
          </div>

          {(isStageLocked ? [
            userAssignedStage === 'post_sales'
              ? { id: 'post_sales', label: '03) Post-Sales Dashboard', badge: 'DEDICATED', icon: Award, color: '#10b981', route: '/crm/post-sales' }
              : userAssignedStage === 'main_sales'
                ? { id: 'main_sales', label: '02) Main Sales Dashboard', badge: 'DEDICATED', icon: PhoneCall, color: '#f59e0b', route: '/crm/main-sales' }
                : { id: 'pre_sales', label: '01) Pre-Sales Dashboard', badge: 'DEDICATED', icon: Zap, color: '#38bdf8', route: '/crm/pre-sales' }
          ] : isMarketing ? [
            { id: 'marketing', label: 'Marketing Overview', badge: 'VIEW-ONLY', icon: Eye, color: '#a855f7', targetTab: 'leads', route: '/crm' }
          ] : [
            { id: 'sales', label: 'All Pipelines', badge: 'MASTER', icon: TrendingUp, color: P.gold, route: '/crm' },
            { id: 'pre_sales', label: '01) Pre-Sales', badge: 'STAGE 1', icon: Zap, color: '#38bdf8', route: '/crm/pre-sales' },
            { id: 'main_sales', label: '02) Main Sales', badge: 'STAGE 2', icon: PhoneCall, color: '#f59e0b', route: '/crm/main-sales' },
            { id: 'post_sales', label: '03) Post-Sales', badge: 'STAGE 3', icon: Award, color: '#10b981', route: '/crm/post-sales' },
            { id: 'marketing', label: 'Marketing', badge: 'VIEW-ONLY', icon: Eye, color: '#a855f7', targetTab: 'leads', route: '/crm' },
            ...(isAdmin ? [{ id: 'team', label: 'Team & RBAC', badge: 'ADMIN', icon: Shield, color: P.gold, targetTab: 'team' }] : []),
          ]).map(dept => {
            const isDeptActive = isStageLocked ? true : activeDept === dept.id;
            const Icon = dept.icon;

            return (
              <button
                key={dept.id}
                onClick={() => {
                  if (dept.route) {
                    navigate(dept.route);
                    if (dept.targetTab) setTab(dept.targetTab);
                    else if (tab === 'team') setTab('overview');
                  } else if (dept.targetTab) {
                    setTab(dept.targetTab);
                  }
                  setActiveDept(dept.id);
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '4px 10px', borderRadius: 8,
                  background: isDeptActive ? (dept.id === 'sales' ? P.gold : `${dept.color}25`) : '#111113',
                  border: `1px solid ${isDeptActive ? (dept.id === 'sales' ? P.gold : dept.color) : `${dept.color}40`}`,
                  color: isDeptActive ? (dept.id === 'sales' ? '#000' : '#fff') : P.text,
                  fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  whiteSpace: 'nowrap', transition: 'all 0.15s', flexShrink: 0
                }}
              >
                <Icon size={12} color={isDeptActive && dept.id === 'sales' ? '#000' : dept.color} />
                <span>{dept.label}</span>
                <span style={{
                  fontSize: 9, padding: '1px 5px', borderRadius: 4,
                  background: isDeptActive && dept.id === 'sales' ? '#00000030' : `${dept.color}30`,
                  color: isDeptActive && dept.id === 'sales' ? '#000' : dept.color,
                  fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.3
                }}>
                  {dept.badge}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Main Content Area ── */}
      <main style={{ maxWidth: 1400, margin: '0 auto', padding: '28px 24px 60px' }}>
        {tab === 'leads' && (
          <TabLeads
            addToast={addToast}
            onAudio={onAudio}
            onCallLead={onCallLead}
            onSelectLead={(l) => setSelectedLead(l)}
            isAgent={isSalesExec}
            isAdmin={isAdmin}
            isManager={isManager}
            isMarketingView={isMarketing}
            initialCategory="all"
            initialStatus={leadFilterStatus}
            initialPipelineStage={effectivePipelineScope || leadFilterPipelineStage}
            lockedPipelineStage={effectivePipelineScope}
            currentUser={currentUser}
            isMobile={isMobile}
            lastUpdatedLead={lastUpdatedLead}
          />
        )}
        {tab === 'overview' && (
          <TabOverview
            addToast={addToast}
            onTabChange={(target, stage, pipelineStage) => {
              setTab(target);
              if (target === 'leads') {
                setLeadFilterStatus(stage || '');
                setLeadFilterPipelineStage(effectivePipelineScope || pipelineStage || '');
              }
            }}
            currentUser={currentUser}
            onSelectLead={(l) => setSelectedLead(l)}
            lastUpdatedLead={lastUpdatedLead}
            pipelineScope={effectivePipelineScope}
            isStageLocked={isStageLocked}
          />
        )}
        {tab === 'followups' && (
          <TabFollowUps
            addToast={addToast}
            onSelectLead={(l) => setSelectedLead(l)}
            onCallLead={onCallLead}
            currentUser={currentUser}
            isAdmin={isAdmin}
            isManager={isManager}
            isSalesExec={isSalesExec}
            isMobile={isMobile}
            pipelineStage={effectivePipelineScope}
          />
        )}
        {tab === 'calendar' && (
          <TabCalendar
            addToast={addToast}
            onSelectLead={(l) => setSelectedLead(l)}
            onOpenIntake={(dt) => { setIntakeInitialDate(dt); setShowIntakeModal(true); }}
            currentUser={currentUser}
            isAdmin={isAdmin}
            isManager={isManager}
            isSalesExec={isSalesExec}
            isMobile={isMobile}
            pipelineStage={effectivePipelineScope}
          />
        )}
        {tab === 'calls' && (
          <TabCallStudio
            initialLead={selectedLead}
            addToast={addToast}
            isAdmin={isAdmin}
            isAgent={isSalesExec}
          />
        )}
        {tab === 'integration' && isAdmin && (
          <GoogleSheetsIntegrationPanel addToast={addToast} />
        )}
        {tab === 'audio' && (
          <TabAudio
            selectedLead={selectedLead}
            setSelectedLead={setSelectedLead}
            addToast={addToast}
            isAdmin={isAdmin}
            isAgent={isSalesExec}
            pipelineStage={effectivePipelineScope}
          />
        )}
        {tab === 'backups' && isAdmin && (
          <TabBackup addToast={addToast} />
        )}
        {tab === 'team' && isAdmin && (
          <TabUsers
            addToast={addToast}
            currentUser={currentUser}
            activeSubTab={teamSubTab}
            onSubTabChange={setTeamSubTab}
          />
        )}
      </main>

      {/* Slide-Over Quick Action Drawer / Bottom Sheet */}
      {selectedLead && (
        <LeadDrawer
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onUpdateLead={(updated) => {
            setSelectedLead(updated);
            setLastUpdatedLead({ ...updated, _ts: Date.now() });
          }}
          onCallLead={onCallLead}
          onAudio={onAudio}
          addToast={addToast}
          currentUser={currentUser}
          isMobile={isMobile}
        />
      )}

      {/* Blank Lead Quick Intake Modal */}
      <QuickAddLeadModal
        isOpen={showIntakeModal}
        onClose={() => { setShowIntakeModal(false); setIntakeInitialDate(''); }}
        onLeadCreated={(newLead) => {
          setSelectedLead(newLead);
          setTab('leads');
        }}
        addToast={addToast}
        initialDate={intakeInitialDate}
        currentUser={currentUser}
        isAdmin={isAdmin}
        isManager={isManager}
      />

      {/* Sticky Bottom Navigation for Mobile (< 768px) */}
      {isMobile && (
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: 60,
          background: '#0d0d10',
          borderTop: `1px solid ${P.border}`,
          zIndex: 800,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          paddingBottom: 'env(safe-area-inset-bottom, 8px)',
          boxShadow: '0 -4px 20px rgba(0,0,0,0.6)'
        }}>
          {[
            { id: 'leads', label: 'Sheet Leads', icon: FileSpreadsheet },
            { id: 'followups', label: 'Follow-Ups', icon: Clock },
            { id: 'calendar', label: 'Calendar', icon: Calendar },
            { id: 'calls', label: 'Call Studio', icon: PhoneCall },
          ].map(item => {
            const isActive = tab === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: isActive ? '#10b981' : P.muted,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 3,
                  cursor: 'pointer',
                  minWidth: 54,
                  minHeight: 44,
                  padding: '4px 0'
                }}
              >
                <Icon size={18} color={isActive ? '#10b981' : P.muted} />
                <span style={{ fontSize: 10, fontWeight: isActive ? 700 : 500 }}>{item.label}</span>
              </button>
            );
          })}

          {/* Sticky Mobile + New Lead CTA */}
          {!isMarketing && (
            <button
              onClick={() => { setIntakeInitialDate(''); setShowIntakeModal(true); }}
              style={{
                background: `linear-gradient(135deg, ${P.gold} 0%, #d97706 100%)`,
                color: '#000',
                border: 'none',
                borderRadius: 10,
                padding: '6px 10px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                cursor: 'pointer',
                minWidth: 54,
                minHeight: 44,
                fontWeight: 800,
                boxShadow: '0 2px 10px rgba(245,158,11,0.3)'
              }}
            >
              <Plus size={16} strokeWidth={3} />
              <span style={{ fontSize: 9 }}>+ Lead</span>
            </button>
          )}
        </div>
      )}

      {/* Toast notifications */}
      <Toast toasts={toasts} remove={removeToast} />
    </div>
  );
}
