import React, { useState, useEffect, useCallback } from 'react';
import {
  Database, Download, ShieldCheck, RefreshCw, AlertCircle, HardDrive,
  Clock, CheckCircle, Check, Copy, Terminal, ExternalLink, FileText
} from 'lucide-react';
import { P, apiFetch, fmtDate, BACKEND_BASE } from '../crmConstants';

export default function TabBackup({ addToast }) {
  const [snapshots, setSnapshots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creatingSnapshot, setCreatingSnapshot] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState(false);

  const loadSnapshots = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/backup/snapshots');
      setSnapshots(res?.snapshots || []);
    } catch (err) {
      addToast(err.message || 'Failed to load snapshots', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    loadSnapshots();
  }, [loadSnapshots]);

  const handleCreateSnapshot = async () => {
    setCreatingSnapshot(true);
    try {
      const res = await apiFetch('/backup/snapshot-now', { method: 'POST' });
      addToast(`Point-in-time snapshot created: ${res?.snapshot?.filename || res?.filename || 'Success'}`, 'success');
      loadSnapshots();
    } catch (err) {
      addToast(err.message || 'Snapshot creation failed', 'error');
    } finally {
      setCreatingSnapshot(false);
    }
  };

  const downloadAuthenticatedFile = async (endpoint, fallbackFilename) => {
    try {
      const token = localStorage.getItem('crm_token');
      const res = await fetch(`${BACKEND_BASE}/api/crm${endpoint}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const disp = res.headers.get('Content-Disposition') || '';
      const nameMatch = disp.match(/filename="?([^"]+)"?/i);
      const filename = nameMatch ? nameMatch[1] : fallbackFilename;
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement('a'), { href: url, download: filename });
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      addToast(`Downloaded ${filename}`, 'success');
    } catch (err) {
      addToast(err.message || 'Download failed', 'error');
    }
  };

  const handleDownloadDb = () => {
    downloadAuthenticatedFile('/backup/download-db', `walktheplan_crm_snapshot_${new Date().toISOString().split('T')[0]}.db`);
  };

  const handleExportJson = () => {
    downloadAuthenticatedFile('/backup/export-data', `walktheplan_crm_records_${new Date().toISOString().split('T')[0]}.json`);
  };

  const restoreRunbookScript = `ssh root@72.61.238.132
cd /root/walktheplan/backend
pm2 stop walktheplan-backend
cp backups/crm/auto_midnight_<DATE>.db database.db
pm2 start walktheplan-backend`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(restoreRunbookScript);
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2500);
    addToast('Restoration commands copied to clipboard!', 'success');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ── Top Status Banner ── */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(34,197,94,0.1) 0%, rgba(17,17,19,0.95) 100%)',
        border: `1px solid ${P.green}50`,
        borderRadius: 14,
        padding: '20px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12, background: 'rgba(34,197,94,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <ShieldCheck size={24} color={P.green} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: P.text }}>
              Disaster Recovery & Automated Snapshot System
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: P.muted }}>
              Automated midnight IST snapshots with 30-day retention and instant 2-minute recovery runbook
            </p>
          </div>
        </div>

        <button
          onClick={handleCreateSnapshot}
          disabled={creatingSnapshot}
          style={{
            background: P.green,
            color: '#000',
            border: 'none',
            borderRadius: 10,
            padding: '10px 18px',
            fontSize: 13,
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            boxShadow: '0 2px 14px rgba(34,197,94,0.3)'
          }}
        >
          {creatingSnapshot ? <RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Database size={15} />}
          Create Snapshot Now
        </button>
      </div>

      {/* ── Manual Download Buttons ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
        <div style={{
          background: P.card, border: `1px solid ${P.border}`, borderRadius: 14, padding: '18px 20px',
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 14
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <HardDrive size={18} color={P.gold} />
              <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: P.text }}>
                Live SQLite Database File (.db)
              </h4>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: P.muted, lineHeight: 1.5 }}>
              Executes a WAL checkpoint and downloads a binary snapshot of the production SQLite database.
            </p>
          </div>
          <button
            onClick={handleDownloadDb}
            style={{
              background: P.card2, border: `1px solid ${P.gold}60`, color: P.gold,
              borderRadius: 8, padding: '9px 14px', fontSize: 13, fontWeight: 700,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
            }}
          >
            <Download size={15} /> Download Full Database (.db)
          </button>
        </div>

        <div style={{
          background: P.card, border: `1px solid ${P.border}`, borderRadius: 14, padding: '18px 20px',
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 14
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <FileText size={18} color={P.blue} />
              <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: P.text }}>
                Complete CRM Records Dump (.json)
              </h4>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: P.muted, lineHeight: 1.5 }}>
              Exports all leads, interaction timeline notes, and metadata as a portable JSON document.
            </p>
          </div>
          <button
            onClick={handleExportJson}
            style={{
              background: P.card2, border: `1px solid ${P.blue}60`, color: P.blue,
              borderRadius: 8, padding: '9px 14px', fontSize: 13, fontWeight: 700,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
            }}
          >
            <Download size={15} /> Export All Records (.json)
          </button>
        </div>
      </div>

      {/* ── Recent Daily Snapshots on VPS Disk ── */}
      <div style={{ background: P.card, border: `1px solid ${P.border}`, borderRadius: 14, padding: '18px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: P.text, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Clock size={16} color={P.gold} />
            Rolling Server Snapshots (Stored on VPS Disk)
          </div>
          <button
            onClick={loadSnapshots}
            title="Refresh snapshot list"
            style={{ background: 'none', border: 'none', color: P.muted, cursor: 'pointer', padding: 4 }}
          >
            <RefreshCw size={14} />
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '24px 0', color: P.muted, fontSize: 13 }}>
            Scanning /root/walktheplan/backend/backups/crm/...
          </div>
        ) : snapshots.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 0', color: P.muted, fontSize: 13 }}>
            No snapshots found yet. Click "Create Snapshot Now" or wait for the nightly midnight IST job.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {snapshots.map((s, idx) => (
              <div
                key={idx}
                style={{
                  background: P.card2, border: `1px solid ${P.border}`, borderRadius: 10,
                  padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  flexWrap: 'wrap', gap: 10
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: P.text, fontFamily: 'monospace' }}>
                    {s.filename}
                  </div>
                  <div style={{ fontSize: 11, color: P.muted, marginTop: 2 }}>
                    Size: {s.size_mb} MB • Created: {fmtDate(s.created_at)}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => downloadAuthenticatedFile(`/backup/download-snapshot/${encodeURIComponent(s.filename)}`, s.filename)}
                  style={{
                    background: 'rgba(245,158,11,0.15)', color: P.gold,
                    border: `1px solid ${P.gold}40`, borderRadius: 6, padding: '5px 12px',
                    fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex',
                    alignItems: 'center', gap: 5
                  }}
                >
                  <Download size={13} /> Download Snapshot
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── 2-Minute Disaster Recovery Runbook ── */}
      <div style={{ background: P.card, border: `1px solid ${P.border}`, borderRadius: 14, padding: '18px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: P.text, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Terminal size={16} color={P.green} />
            2-Minute Emergency Restoration Protocol
          </div>
          <button
            onClick={copyToClipboard}
            style={{
              background: P.card2, border: `1px solid ${P.border}`, color: copiedCmd ? P.green : P.muted,
              borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 4
            }}
          >
            {copiedCmd ? <Check size={12} /> : <Copy size={12} />}
            {copiedCmd ? 'Copied' : 'Copy Commands'}
          </button>
        </div>

        <p style={{ margin: '0 0 10px', fontSize: 12, color: P.muted, lineHeight: 1.5 }}>
          In the event of accidental data loss or database corruption, execute these four commands in the production SSH terminal to restore full operations within 2 minutes:
        </p>

        <pre style={{
          background: '#050507', border: `1px solid ${P.border}`, borderRadius: 8,
          padding: '12px 16px', color: '#4ade80', fontSize: 12, fontFamily: 'monospace',
          overflowX: 'auto', margin: 0, lineHeight: 1.6
        }}>
          {restoreRunbookScript}
        </pre>

        <div style={{ marginTop: 10, fontSize: 11, color: P.muted }}>
          Full documentation available in <code>docs/DISASTER_RECOVERY_PROTOCOL.md</code>.
        </div>
      </div>
    </div>
  );
}
