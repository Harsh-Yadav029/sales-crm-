import React, { useState, useEffect, useCallback } from 'react';
import {
  X, PhoneCall, Phone, MessageSquare, Mic, Volume2, Calendar, CalendarClock,
  Clock, User, MapPin, Mail, DollarSign, Layers, Send, ChevronDown,
  CheckCircle2, RefreshCw, AlertCircle, FileText, Check, Shield, Lock, Save, Zap, Award
} from 'lucide-react';
import { P, STATUS_OPTIONS, STATUS_META, apiFetch, fmtDate, fmtDateOnly } from '../crmConstants';

const INTERACTION_TYPES = [
  { id: 'Phone Call Summary', label: 'Call Summary', icon: PhoneCall, color: '#22c55e' },
  { id: 'WhatsApp Conversation', label: 'WhatsApp', icon: MessageSquare, color: '#25d366' },
  { id: 'Site Visit / Meeting', label: 'Site / Meeting', icon: Calendar, color: '#a855f7' },
  { id: 'General Note', label: 'General Note', icon: FileText, color: '#f59e0b' },
];

export default function LeadDrawer({
  lead,
  onClose,
  onUpdateLead,
  onCallLead,
  onAudio,
  addToast,
  currentUser,
  isMobile
}) {
  const [activeStage, setActiveStage] = useState(lead?.status || 'Pending');
  const [followUpDate, setFollowUpDate] = useState(lead?.follow_up_date || '');
  const [followUpTime, setFollowUpTime] = useState(lead?.follow_up_time || '11:00 AM');
  const [followUpNotes, setFollowUpNotes] = useState(lead?.follow_up_notes || '');
  const [savingFollowUp, setSavingFollowUp] = useState(false);

  // Dedicated 3-Stage Primary Task & Notes state (Pre-Sales, Main Sales, Post-Sales)
  const [presalesNote, setPresalesNote] = useState(lead?.presales_notes || '');
  const [mainsalesNote, setMainsalesNote] = useState(lead?.mainsales_notes || '');
  const [postsalesNote, setPostsalesNote] = useState(lead?.postsales_notes || '');
  const [savingStageNote, setSavingStageNote] = useState(null);

  // Timeline / Notes state
  const [timeline, setTimeline] = useState([]);
  const [loadingTimeline, setLoadingTimeline] = useState(true);
  const [noteType, setNoteType] = useState('General Note');
  const [noteContent, setNoteContent] = useState('');
  const [submittingNote, setSubmittingNote] = useState(false);

  // Determine RBAC Permissions for active user
  const userRole = (currentUser?.role || '').toLowerCase();
  const userDept = (currentUser?.department || '').toLowerCase();
  const userPipe = (currentUser?.assigned_pipeline || '').toLowerCase();
  const isMarketingUser = userRole === 'marketing' || userDept === 'marketing';
  const isMasterAdmin = !isMarketingUser && (userRole === 'admin' || userRole === 'manager' || userPipe === 'all');
  const userAssignedPipe = (userPipe && userPipe !== 'all') ? userPipe : (
    (userDept.includes('post') || userRole.includes('post')) ? 'post_sales' :
    (userDept.includes('main') || userRole.includes('main') || userRole === 'sales' || userRole === 'agent') ? 'main_sales' :
    'pre_sales'
  );
  const leadId = lead?.id || lead?._id;
  const leadStage = lead?.pipeline_stage || 'pre_sales';
  const canEditCurrentLead = isMasterAdmin || (!isMarketingUser && userAssignedPipe === leadStage);
  const canEditStageBox = (stageKey) => isMasterAdmin || (!isMarketingUser && canEditCurrentLead && userAssignedPipe === stageKey);

  // Synchronize state when lead changes
  useEffect(() => {
    if (lead) {
      setActiveStage(lead.status || 'Pending');
      setFollowUpDate(lead.follow_up_date || '');
      setFollowUpTime(lead.follow_up_time || '11:00 AM');
      setFollowUpNotes(lead.follow_up_notes || '');
      setPresalesNote(lead.presales_notes || '');
      setMainsalesNote(lead.mainsales_notes || '');
      setPostsalesNote(lead.postsales_notes || '');
      loadTimeline();
    }
  }, [lead]);

  // Save dedicated primary task note for a specific stage (pre_sales, main_sales, post_sales)
  const handleSaveStageNote = async (stageKey, noteText) => {
    if (!canEditStageBox(stageKey)) {
      addToast('View-Only: You can only write notes in your assigned sales section.', 'error');
      return;
    }
    if (!leadId) return;
    setSavingStageNote(stageKey);
    try {
      const res = await apiFetch(`/leads/${leadId}/stage-notes`, {
        method: 'PUT',
        body: JSON.stringify({ stage: stageKey, note: noteText })
      });
      if (!res?.success) {
        throw new Error(res?.message || 'Unable to save note. Please re-login and try again.');
      }
      const colPrefix = stageKey === 'pre_sales' ? 'presales' : stageKey === 'main_sales' ? 'mainsales' : 'postsales';
      const updatedLead = {
        ...lead,
        [`${colPrefix}_notes`]: res.note,
        [`${colPrefix}_notes_by`]: res.updated_by,
        [`${colPrefix}_notes_at`]: res.updated_at
      };
      onUpdateLead?.(updatedLead);
      addToast(res.message || 'Stage primary note saved!', 'success');
      loadTimeline();
    } catch (err) {
      addToast(err.message || 'Failed to save stage note', 'error');
    } finally {
      setSavingStageNote(null);
    }
  };

  // Load interaction timeline from backend
  const loadTimeline = useCallback(async () => {
    if (!leadId) return;
    setLoadingTimeline(true);
    try {
      const res = await apiFetch(`/leads/${leadId}/timeline`);
      setTimeline(res?.activities || []);
    } catch {
      // Fallback: empty array
      setTimeline([]);
    } finally {
      setLoadingTimeline(false);
    }
  }, [leadId]);

  // Stage change handler
  const handleStageChange = async (newStage) => {
    if (!canEditCurrentLead) {
      addToast('View-Only Lead: Status cannot be changed outside your pipeline.', 'error');
      return;
    }
    setActiveStage(newStage);
    try {
      const currentPipeline = lead.pipeline_stage || 'pre_sales';
      await apiFetch(`/leads/${leadId}`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStage, pipeline_stage: currentPipeline })
      });
      addToast(`Status updated to ${newStage}`, 'success');
      onUpdateLead?.({ ...lead, status: newStage, pipeline_stage: currentPipeline });
      loadTimeline();
    } catch (err) {
      addToast(err.message || 'Failed to update stage', 'error');
    }
  };

  // Schedule follow-up save
  const handleSaveFollowUp = async (e) => {
    e?.preventDefault();
    if (!canEditCurrentLead) {
      addToast('View-Only Lead: Cannot schedule follow-ups outside your pipeline.', 'error');
      return;
    }
    if (!followUpDate) {
      addToast('Please pick a follow-up date', 'error');
      return;
    }
    setSavingFollowUp(true);
    try {
      await apiFetch(`/leads/${leadId}/followup`, {
        method: 'PUT',
        body: JSON.stringify({
          follow_up_date: followUpDate,
          follow_up_time: followUpTime,
          notes: followUpNotes,
          follow_up_status: 'pending'
        })
      });
      addToast('Follow-up scheduled successfully!', 'success');
      onUpdateLead?.({
        ...lead,
        follow_up_date: followUpDate,
        follow_up_time: followUpTime,
        follow_up_notes: followUpNotes,
        follow_up_status: 'pending'
      });
      loadTimeline();
    } catch (err) {
      addToast(err.message || 'Failed to schedule follow-up', 'error');
    } finally {
      setSavingFollowUp(false);
    }
  };

  // Submit note / interaction log
  const handleSubmitNote = async (e) => {
    e?.preventDefault();
    if (!canEditCurrentLead) {
      addToast('View-Only Lead: Cannot add interaction notes outside your pipeline.', 'error');
      return;
    }
    if (!noteContent.trim()) {
      addToast('Please enter note text', 'error');
      return;
    }
    setSubmittingNote(true);
    try {
      const authorName = currentUser?.name || currentUser?.full_name || currentUser?.email || 'Sales Team';
      const authorRole = currentUser?.role ? currentUser.role.toUpperCase() : 'SALES';

      const res = await apiFetch(`/leads/${leadId}/notes`, {
        method: 'POST',
        body: JSON.stringify({
          note: noteContent.trim(),
          interaction_type: noteType,
          author_name: authorName,
          author_role: authorRole
        })
      });

      addToast('Interaction recorded!', 'success');
      setNoteContent('');
      if (res?.activity) {
        setTimeline(prev => [res.activity, ...prev]);
      } else {
        loadTimeline();
      }
    } catch (err) {
      addToast(err.message || 'Failed to log note', 'error');
    } finally {
      setSubmittingNote(false);
    }
  };

  if (!lead) return null;

  const phoneClean = (lead.phone || '').replace(/\D/g, '').slice(-10);
  const currentStageMeta = STATUS_META[activeStage] || {};

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.7)',
      backdropFilter: 'blur(4px)',
      zIndex: 900,
      display: 'flex',
      justifyContent: isMobile ? 'center' : 'flex-end',
      alignItems: isMobile ? 'flex-end' : 'stretch',
    }}
    onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: P.card,
        borderLeft: isMobile ? 'none' : `1px solid ${P.border}`,
        borderTop: isMobile ? `1px solid ${P.gold}` : 'none',
        borderRadius: isMobile ? '20px 20px 0 0' : 0,
        width: isMobile ? '100%' : 540,
        maxWidth: '100%',
        height: isMobile ? '92vh' : '100vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '-8px 0 30px rgba(0,0,0,0.7)',
        animation: isMobile ? 'slideUp 0.25s ease' : 'slideInRight 0.25s ease',
        overflow: 'hidden',
        paddingBottom: isMobile ? 'env(safe-area-inset-bottom, 16px)' : 0
      }}>
        <style>{`
          @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        `}</style>

        {/* Mobile Swipe / Pull Handle */}
        {isMobile && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 4px', cursor: 'pointer' }} onClick={onClose}>
            <div style={{ width: 44, height: 5, borderRadius: 3, background: P.border2 }} />
          </div>
        )}

        {/* ── Top Header ── */}
        <div style={{
          padding: '16px 20px',
          borderBottom: `1px solid ${P.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: P.card2
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: P.text }}>
                {lead.name}
              </h2>
              <span style={{
                background: currentStageMeta.bg || 'rgba(255,255,255,0.1)',
                color: currentStageMeta.color || P.text,
                borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700
              }}>
                {currentStageMeta.badge || '📌'} {currentStageMeta.label || activeStage}
              </span>
            </div>
            <div style={{ fontSize: 12, color: P.muted, marginTop: 4, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ textTransform: 'uppercase', color: P.gold, fontWeight: 700, fontSize: 10 }}>
                {lead.lead_category || 'Lead'}
              </span>
              <span>•</span>
              <span>Added: {fmtDate(lead.created_at || lead.createdAt)}</span>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: P.card, border: `1px solid ${P.border}`, borderRadius: 8,
              color: P.muted, width: 34, height: 34, display: 'flex', alignItems: 'center',
              justifyContent: 'center', cursor: 'pointer'
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Communication Action Bar ── */}
        {!isMarketingUser && (
          <div style={{
            padding: '12px 20px',
            background: 'linear-gradient(90deg, rgba(245,158,11,0.08) 0%, rgba(34,197,94,0.08) 100%)',
            borderBottom: `1px solid ${P.border}`,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: 10
          }}>
            {/* Call Trigger */}
            <button
              onClick={() => {
                if (onCallLead) onCallLead(lead);
                else window.open(`tel:${lead.phone}`, '_self');
              }}
              style={{
                background: 'rgba(34,197,94,0.18)', color: P.green,
                border: `1px solid ${P.green}50`, borderRadius: 10, padding: '10px 8px',
                fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center', gap: 6
              }}
            >
              <PhoneCall size={14} /> Call Lead
            </button>

            {/* WhatsApp Direct */}
            <a
              href={phoneClean ? `https://wa.me/91${phoneClean}?text=Hello%20${encodeURIComponent(lead.name || 'Client')}%2C%20following%20up%20from%20Walk%20The%20Plan.` : '#'}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => { if (!phoneClean) { e.preventDefault(); addToast('No valid phone number for WhatsApp', 'error'); } }}
              style={{
                background: 'rgba(37,211,102,0.18)', color: '#25d366',
                border: '1px solid rgba(37,211,102,0.5)', borderRadius: 10, padding: '10px 8px',
                fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: 6, textDecoration: 'none'
              }}
            >
              <MessageSquare size={14} /> WhatsApp
            </a>

            {/* Audio Note Recorder / Review */}
            <button
              onClick={() => onAudio?.(lead)}
              style={{
                background: lead.audio_url ? 'rgba(245,158,11,0.18)' : 'rgba(168,85,247,0.18)',
                color: lead.audio_url ? P.gold : '#c084fc',
                border: `1px solid ${lead.audio_url ? P.gold : '#a855f7'}50`,
                borderRadius: 10, padding: '10px 8px',
                fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center', gap: 6
              }}
            >
              <Mic size={14} /> {lead.audio_url ? 'Listen Audio' : 'Record Audio'}
            </button>
          </div>
        )}

        {/* ── Scrollable Body ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Section 1: Lead Profile & Details Grid */}
          <div style={{ background: P.card2, border: `1px solid ${P.border}`, borderRadius: 12, padding: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: P.muted, textTransform: 'uppercase', marginBottom: 10 }}>
              Lead Profile & Project Scope
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13 }}>
              <div>
                <span style={{ fontSize: 11, color: P.muted }}>Phone</span>
                <div style={{ fontFamily: 'monospace', fontWeight: 600, color: P.text, marginTop: 2 }}>
                  {lead.phone || '—'}
                </div>
              </div>
              <div>
                <span style={{ fontSize: 11, color: P.muted }}>Email</span>
                <div style={{ color: P.text, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {lead.email || '—'}
                </div>
              </div>
              <div>
                <span style={{ fontSize: 11, color: P.muted }}>City / Studio</span>
                <div style={{ color: P.text, marginTop: 2 }}>{lead.city || lead.studio_location || '—'}</div>
              </div>
              <div>
                <span style={{ fontSize: 11, color: P.muted }}>Plot Size</span>
                <div style={{ color: P.text, marginTop: 2 }}>
                  {lead.plot_size ? lead.plot_size.replace(/_/g, ' ') : '—'}
                </div>
              </div>
              <div>
                <span style={{ fontSize: 11, color: P.muted }}>Blueprint / Requirement</span>
                <div style={{ color: P.text, marginTop: 2 }}>
                  {lead.floor_plan_status?.replace(/_/g, ' ') || lead.requirement || '—'}
                </div>
              </div>
              <div>
                <span style={{ fontSize: 11, color: P.muted }}>Estimated Budget</span>
                <div style={{ color: P.green, fontWeight: 700, marginTop: 2 }}>{lead.budget || '—'}</div>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <span style={{ fontSize: 11, color: P.muted }}>Assigned Representative</span>
                <div style={{ color: P.gold, fontWeight: 600, marginTop: 2 }}>
                  {lead.assigned_to || 'Unassigned (Available to Team)'}
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Stage & Pipeline Selector */}
          <div style={{ background: P.card2, border: `1px solid ${P.border}`, borderRadius: 12, padding: 14 }}>
            {!canEditCurrentLead && (
              <div style={{
                marginBottom: 10, padding: '6px 10px', borderRadius: 8,
                background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.3)',
                color: '#c084fc', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6
              }}>
                <Lock size={12} /> View-Only Lead (Belongs to {leadStage.replace('_', ' ').toUpperCase()} — Strictly Read-Only)
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: P.muted, textTransform: 'uppercase', marginBottom: 6 }}>
                  Qualification Status
                </div>
                <select
                  value={activeStage}
                  disabled={!canEditCurrentLead}
                  onChange={e => handleStageChange(e.target.value)}
                  style={{
                    width: '100%', background: P.bg, border: `1px solid ${currentStageMeta.color || P.border}`,
                    color: P.text, borderRadius: 8, padding: '9px 10px', fontSize: 13, fontWeight: 600,
                    outline: 'none', cursor: canEditCurrentLead ? 'pointer' : 'not-allowed',
                    opacity: canEditCurrentLead ? 1 : 0.65
                  }}
                >
                  {STATUS_OPTIONS.map(opt => {
                    const m = STATUS_META[opt] || {};
                    return (
                      <option key={opt} value={opt}>
                        {m.badge || '•'} {m.label || opt}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: P.muted, textTransform: 'uppercase', marginBottom: 6 }}>
                  Sales Pipeline Stage
                </div>
                <select
                  value={lead.pipeline_stage || 'pre_sales'}
                  disabled={!canEditCurrentLead}
                    onChange={async (e) => {
                    const newPipe = e.target.value;
                    try {
                      await apiFetch(`/leads/${leadId}`, {
                        method: 'PUT',
                        body: JSON.stringify({ pipeline_stage: newPipe })
                      });
                      addToast(`Lead moved to ${newPipe.replace('_', ' ').toUpperCase()}!`, 'success');
                      onUpdateLead?.({ ...lead, pipeline_stage: newPipe });
                      loadTimeline();
                    } catch (err) {
                      addToast('Failed to update pipeline stage', 'error');
                    }
                  }}
                  style={{
                    width: '100%', background: P.bg,
                    border: `1px solid ${
                      lead.pipeline_stage === 'post_sales' ? '#10b981' :
                      lead.pipeline_stage === 'main_sales' ? '#f59e0b' : '#38bdf8'
                    }`,
                    color: lead.pipeline_stage === 'post_sales' ? '#10b981' :
                      lead.pipeline_stage === 'main_sales' ? '#f59e0b' : '#38bdf8',
                    borderRadius: 8, padding: '9px 10px', fontSize: 13, fontWeight: 700,
                    outline: 'none', cursor: canEditCurrentLead ? 'pointer' : 'not-allowed',
                    opacity: canEditCurrentLead ? 1 : 0.65
                  }}
                >
                  <option value="pre_sales">🎯 01 Pre-Sales</option>
                  <option value="main_sales">⚡ 02 Main Sales</option>
                  <option value="post_sales">🚀 03 Post-Sales</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 2B: Dedicated 3-Stage Primary Task & Notes (Pre-Sales · Main Sales · Post-Sales) */}
          <div style={{ background: P.card2, border: `1px solid ${P.border}`, borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: P.text, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                Primary Task & Notes (Pre · Main · Post)
              </span>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                background: !canEditCurrentLead
                  ? 'rgba(168,85,247,0.14)'
                  : isMasterAdmin ? 'rgba(245,158,11,0.15)' : 'rgba(56,189,248,0.12)',
                color: !canEditCurrentLead ? '#c084fc' : isMasterAdmin ? P.gold : '#38bdf8',
                border: `1px solid ${!canEditCurrentLead ? 'rgba(168,85,247,0.35)' : isMasterAdmin ? 'rgba(245,158,11,0.35)' : 'rgba(56,189,248,0.3)'}`
              }}>
                {!canEditCurrentLead
                  ? `🔒 Read-Only (${leadStage === 'main_sales' ? 'Main Sales' : leadStage === 'post_sales' ? 'Post-Sales' : 'Pre-Sales'} Lead · Logged in as ${userAssignedPipe === 'main_sales' ? 'Main Sales' : userAssignedPipe === 'post_sales' ? 'Post-Sales' : 'Pre-Sales'})`
                  : isMasterAdmin
                    ? '👑 Admin · Full Access (All 3 Editable)'
                    : userAssignedPipe === 'main_sales'
                      ? '📞 Main Sales · Edit 02 (01 & 03 View-Only)'
                      : userAssignedPipe === 'post_sales'
                        ? '🏅 Post-Sales · Edit 03 (01 & 02 View-Only)'
                        : '⚡ Pre-Sales · Edit 01 (02 & 03 View-Only)'}
              </span>
            </div>

            {[
              {
                key: 'pre_sales',
                title: '01 · PRE-SALES PRIMARY TASK & NOTE',
                placeholder: 'Write touch-based verification, plot size, city, budget & availability notes...',
                color: '#38bdf8',
                icon: Zap,
                value: presalesNote,
                setValue: setPresalesNote,
                by: lead.presales_notes_by,
                at: lead.presales_notes_at,
                savedVal: lead.presales_notes || ''
              },
              {
                key: 'main_sales',
                title: '02 · MAIN SALES PRIMARY TASK & NOTE',
                placeholder: 'Write calling summary, studio walkthrough feedback, quote & token advance status...',
                color: P.gold,
                icon: PhoneCall,
                value: mainsalesNote,
                setValue: setMainsalesNote,
                by: lead.mainsales_notes_by,
                at: lead.mainsales_notes_at,
                savedVal: lead.mainsales_notes || ''
              },
              {
                key: 'post_sales',
                title: '03 · POST-SALES PRIMARY TASK & NOTE',
                placeholder: 'Write architect assignment, drawing milestones, site visit & balance payment notes...',
                color: '#10b981',
                icon: Award,
                value: postsalesNote,
                setValue: setPostsalesNote,
                by: lead.postsales_notes_by,
                at: lead.postsales_notes_at,
                savedVal: lead.postsales_notes || ''
              }
            ].map(box => {
              const canWriteBox = canEditStageBox(box.key);
              const isSavingThis = savingStageNote === box.key;
              const isDirty = box.value.trim() !== (box.savedVal || '').trim();
              const BoxIcon = box.icon;

              return (
                <div
                  key={box.key}
                  style={{
                    background: P.bg,
                    border: `1px solid ${canWriteBox ? `${box.color}55` : P.border}`,
                    borderRadius: 10,
                    padding: 12,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: box.color, display: 'flex', alignItems: 'center', gap: 5 }}>
                      <BoxIcon size={13} /> {box.title}
                    </span>
                    {canWriteBox ? (
                      <span style={{
                        fontSize: 10, fontWeight: 700, color: '#4ade80',
                        background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)',
                        padding: '1px 7px', borderRadius: 10
                      }}>
                        Editable
                      </span>
                    ) : (
                      <span style={{
                        fontSize: 10, fontWeight: 700, color: P.muted,
                        background: 'rgba(255,255,255,0.05)', border: `1px solid ${P.border}`,
                        padding: '1px 7px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 3
                      }}>
                        <Lock size={9} /> View-Only
                      </span>
                    )}
                  </div>

                  <textarea
                    rows={2}
                    readOnly={!canWriteBox}
                    placeholder={canWriteBox ? box.placeholder : 'No note written yet by this team.'}
                    value={box.value}
                    onChange={e => box.setValue(e.target.value)}
                    style={{
                      width: '100%',
                      background: canWriteBox ? P.card : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${canWriteBox ? P.border : 'transparent'}`,
                      color: P.text,
                      borderRadius: 8,
                      padding: '8px 10px',
                      fontSize: 12,
                      lineHeight: 1.45,
                      resize: canWriteBox ? 'vertical' : 'none',
                      outline: 'none',
                      boxSizing: 'border-box',
                      cursor: canWriteBox ? 'text' : 'default'
                    }}
                  />

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                    <div style={{ fontSize: 10, color: P.muted }}>
                      {box.by ? (
                        <span>Updated by <strong style={{ color: P.text }}>{box.by}</strong>{box.at ? ` · ${fmtDate(box.at)}` : ''}</span>
                      ) : (
                        <span>Not recorded yet</span>
                      )}
                    </div>
                    {canWriteBox && (
                      <button
                        type="button"
                        disabled={isSavingThis || !isDirty}
                        onClick={() => handleSaveStageNote(box.key, box.value)}
                        style={{
                          background: isDirty ? box.color : P.card2,
                          color: isDirty ? '#000' : P.muted,
                          border: `1px solid ${isDirty ? box.color : P.border}`,
                          borderRadius: 6,
                          padding: '4px 10px',
                          fontSize: 11,
                          fontWeight: 800,
                          cursor: (isSavingThis || !isDirty) ? 'default' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          opacity: isSavingThis ? 0.6 : 1
                        }}
                      >
                        {isSavingThis ? <RefreshCw size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={11} />}
                        {isSavingThis ? 'Saving...' : 'Save Note'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Section 3: Schedule / Update Follow-Up */}
          <div style={{ background: P.card2, border: `1px solid ${P.border}`, borderRadius: 12, padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: P.muted, textTransform: 'uppercase' }}>
                Schedule Follow-Up / Meeting
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {!canEditCurrentLead && (
                  <span style={{
                    fontSize: 10, fontWeight: 700, color: P.muted,
                    background: 'rgba(255,255,255,0.05)', border: `1px solid ${P.border}`,
                    padding: '2px 7px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 3
                  }}>
                    <Lock size={9} /> View-Only
                  </span>
                )}
                {lead.follow_up_date && (
                  <span style={{
                    fontSize: 11, color: lead.follow_up_status === 'completed' ? '#94a3b8' : P.gold,
                    background: 'rgba(245,158,11,0.1)', padding: '2px 8px', borderRadius: 6
                  }}>
                    Status: {lead.follow_up_status || 'pending'}
                  </span>
                )}
              </div>
            </div>

            <form onSubmit={handleSaveFollowUp} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, color: P.muted, display: 'block', marginBottom: 4 }}>Date</label>
                  <input
                    type="date"
                    disabled={!canEditCurrentLead}
                    value={followUpDate}
                    onChange={e => setFollowUpDate(e.target.value)}
                    style={{
                      width: '100%', background: P.bg, border: `1px solid ${P.border}`,
                      color: P.text, borderRadius: 8, padding: '8px 10px', fontSize: 13, boxSizing: 'border-box',
                      opacity: canEditCurrentLead ? 1 : 0.65, cursor: canEditCurrentLead ? 'text' : 'not-allowed'
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: P.muted, display: 'block', marginBottom: 4 }}>Time</label>
                  <input
                    type="text"
                    disabled={!canEditCurrentLead}
                    placeholder="e.g. 11:30 AM"
                    value={followUpTime}
                    onChange={e => setFollowUpTime(e.target.value)}
                    style={{
                      width: '100%', background: P.bg, border: `1px solid ${P.border}`,
                      color: P.text, borderRadius: 8, padding: '8px 10px', fontSize: 13, boxSizing: 'border-box',
                      opacity: canEditCurrentLead ? 1 : 0.65, cursor: canEditCurrentLead ? 'text' : 'not-allowed'
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 11, color: P.muted, display: 'block', marginBottom: 4 }}>Remarks / Agenda</label>
                <input
                  type="text"
                  readOnly={!canEditCurrentLead}
                  placeholder={canEditCurrentLead ? 'e.g. Bring structural drawings, clarify stilt floor height...' : 'View-Only mode'}
                  value={followUpNotes}
                  onChange={e => setFollowUpNotes(e.target.value)}
                  style={{
                    width: '100%', background: P.bg, border: `1px solid ${P.border}`,
                    color: P.text, borderRadius: 8, padding: '8px 10px', fontSize: 13, boxSizing: 'border-box',
                    opacity: canEditCurrentLead ? 1 : 0.65
                  }}
                />
              </div>

              {canEditCurrentLead && (
                <button
                  type="submit"
                  disabled={savingFollowUp}
                  style={{
                    background: P.gold, color: '#000', border: 'none', borderRadius: 8,
                    padding: '9px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 4
                  }}
                >
                  {savingFollowUp ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <CalendarClock size={14} />}
                  Save Follow-Up
                </button>
              )}
            </form>
          </div>

          {/* Section 4: Unified Append-Only Interaction History Timeline */}
          <div style={{ background: P.card2, border: `1px solid ${P.border}`, borderRadius: 12, padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: P.muted, textTransform: 'uppercase' }}>
                Unified Interaction Notes & History
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {!canEditCurrentLead && (
                  <span style={{
                    fontSize: 10, fontWeight: 700, color: P.muted,
                    background: 'rgba(255,255,255,0.05)', border: `1px solid ${P.border}`,
                    padding: '2px 7px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 3
                  }}>
                    <Lock size={9} /> View-Only
                  </span>
                )}
                <button
                  onClick={loadTimeline}
                  title="Refresh notes"
                  style={{ background: 'none', border: 'none', color: P.muted, cursor: 'pointer', padding: 2 }}
                >
                  <RefreshCw size={13} />
                </button>
              </div>
            </div>

            {canEditCurrentLead && (
              <>
                {/* Note Type Selector Chips */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                  {INTERACTION_TYPES.map(t => {
                    const isSelected = noteType === t.id;
                    const Icon = t.icon;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setNoteType(t.id)}
                        style={{
                          background: isSelected ? `${t.color}25` : P.bg,
                          color: isSelected ? t.color : P.muted,
                          border: `1px solid ${isSelected ? t.color : P.border}`,
                          borderRadius: 6, padding: '4px 8px', fontSize: 11, fontWeight: 600,
                          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4
                        }}
                      >
                        <Icon size={12} /> {t.label}
                      </button>
                    );
                  })}
                </div>

                {/* Note Input Box */}
                <form onSubmit={handleSubmitNote} style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                  <textarea
                    rows={3}
                    placeholder={`Type ${noteType} details...`}
                    value={noteContent}
                    onChange={e => setNoteContent(e.target.value)}
                    style={{
                      width: '100%', background: P.bg, border: `1px solid ${P.border}`,
                      color: P.text, borderRadius: 8, padding: '10px 12px', fontSize: 13,
                      outline: 'none', resize: 'vertical', boxSizing: 'border-box'
                    }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      type="submit"
                      disabled={submittingNote || !noteContent.trim()}
                      style={{
                        background: P.gold, color: '#000', border: 'none', borderRadius: 8,
                        padding: '7px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 6,
                        opacity: (!noteContent.trim() || submittingNote) ? 0.5 : 1
                      }}
                    >
                      {submittingNote ? <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={13} />}
                      Add Interaction Note
                    </button>
                  </div>
                </form>
              </>
            )}

            {/* Timeline Stream */}
            <div style={{ borderTop: `1px solid ${P.border}40`, paddingTop: 12 }}>
              {loadingTimeline ? (
                <div style={{ textAlign: 'center', padding: '20px 0', color: P.muted, fontSize: 12 }}>
                  Loading interaction stream...
                </div>
              ) : timeline.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px 0', color: P.muted, fontSize: 12 }}>
                  No interaction history recorded yet. Add the first note above!
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {timeline.map((act, idx) => {
                    const typeConfig = INTERACTION_TYPES.find(t => t.id === act.interaction_type) || {
                      color: P.gold, label: act.interaction_type || 'Note', icon: FileText
                    };
                    const TypeIcon = typeConfig.icon;

                    return (
                      <div
                        key={act.id || idx}
                        style={{
                          background: P.bg,
                          border: `1px solid ${P.border}60`,
                          borderRadius: 8,
                          padding: '10px 12px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 6
                        }}
                      >
                        {/* Note Header: Author, Role, IST Timestamp */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{
                              background: `${typeConfig.color}20`, color: typeConfig.color,
                              borderRadius: 4, padding: '1px 6px', fontSize: 10, fontWeight: 700,
                              display: 'flex', alignItems: 'center', gap: 3
                            }}>
                              <TypeIcon size={10} /> {typeConfig.label}
                            </span>
                            <span style={{ fontSize: 12, fontWeight: 700, color: P.text }}>
                              {act.author_name || 'CRM System'}
                            </span>
                            {act.author_role && (
                              <span style={{ fontSize: 10, color: P.muted }}>
                                ({act.author_role})
                              </span>
                            )}
                          </div>
                          <span style={{ fontSize: 11, color: P.muted, fontFamily: 'monospace' }}>
                            {fmtDate(act.created_at)}
                          </span>
                        </div>

                        {/* Note Content */}
                        <div style={{ fontSize: 13, color: P.text, whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>
                          {act.note || act.action}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
