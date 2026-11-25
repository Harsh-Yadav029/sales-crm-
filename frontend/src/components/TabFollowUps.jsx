import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Clock, AlertCircle, CheckCircle2, Calendar, Phone, PhoneCall,
  MessageSquare, User, Filter, Search, ChevronRight, Check, RefreshCw,
  ArrowRight, X, ExternalLink, CalendarClock, Lock
} from 'lucide-react';
import { P, STATUS_META, apiFetch, fmtDate, fmtDateOnly } from '../crmConstants';

export default function TabFollowUps({
  addToast,
  onSelectLead,
  onCallLead,
  currentUser,
  isAdmin,
  isManager,
  isSalesExec,
  isMobile
}) {
  const fuRole = (currentUser?.role || '').toLowerCase();
  const fuDept = (currentUser?.department || '').toLowerCase();
  const fuPipe = (currentUser?.assigned_pipeline || '').toLowerCase();
  const isFuMaster = isAdmin || isManager || fuPipe === 'all';
  const fuUserStage = (fuPipe && fuPipe !== 'all') ? fuPipe : (
    (fuDept.includes('post') || fuRole.includes('post')) ? 'post_sales' :
    (fuDept.includes('main') || fuRole.includes('main') || fuRole === 'sales' || fuRole === 'agent') ? 'main_sales' :
    'pre_sales'
  );
  const canEditFollowUp = (l) => isFuMaster || ((l?.pipeline_stage || 'pre_sales') === fuUserStage);
  const [activeBucket, setActiveBucket] = useState('today'); // 'today' | 'overdue' | 'upcoming' | 'completed' | 'all'
  const [data, setData] = useState({ today: [], overdue: [], upcoming: [], completed: [], counts: { today: 0, overdue: 0, upcoming: 0, completed: 0 } });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [teamMembers, setTeamMembers] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState('');
  const [reschedulingId, setReschedulingId] = useState(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [rescheduleNotes, setRescheduleNotes] = useState('');

  // Load team members for Admin/Manager filter
  useEffect(() => {
    if (isAdmin || isManager) {
      apiFetch('/users')
        .then(res => {
          const reps = (res?.users || []).filter(u =>
            ['sales', 'agent', 'field_agent', 'sales_engineer', 'pre_sales', 'main_sales', 'post_sales', 'manager'].includes(u.role) ||
            (u.department || '').toLowerCase().includes('sales')
          );
          setTeamMembers(reps);
        })
        .catch(() => {});
    }
  }, [isAdmin, isManager]);

  // Load follow-up buckets from backend
  const loadFollowUps = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedAgent && (isAdmin || isManager)) {
        params.set('assigned_to', selectedAgent);
      }
      const res = await apiFetch(`/followups?${params.toString()}`);
      setData(res || { today: [], overdue: [], upcoming: [], completed: [], counts: {} });
    } catch (err) {
      addToast(err.message || 'Failed to load follow-ups', 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedAgent, isAdmin, isManager, addToast]);

  useEffect(() => {
    loadFollowUps();
  }, [loadFollowUps]);

  // Quick Action 1: Mark Completed
  const handleComplete = async (lead) => {
    try {
      await apiFetch(`/leads/${lead.id}/followup`, {
        method: 'PUT',
        body: JSON.stringify({
          follow_up_status: 'completed',
          notes: 'Marked completed from Follow-Up Center'
        })
      });
      addToast(`Follow-up for ${lead.name} marked as completed!`, 'success');
      loadFollowUps();
    } catch (err) {
      addToast(err.message || 'Failed to update follow-up', 'error');
    }
  };

  // Quick Action 2: Postpone to Tomorrow (+24 hours)
  const handlePostponeTomorrow = async (lead) => {
    try {
      await apiFetch(`/leads/${lead.id}/followup`, {
        method: 'PUT',
        body: JSON.stringify({ postpone_days: 1, action: 'postpone' })
      });
      addToast(`Follow-up for ${lead.name} postponed to tomorrow (+24h)`, 'success');
      loadFollowUps();
    } catch (err) {
      addToast(err.message || 'Failed to postpone follow-up', 'error');
    }
  };

  // Quick Action 3: Save Custom Reschedule
  const handleSaveReschedule = async (leadId) => {
    if (!rescheduleDate) {
      addToast('Please select a follow-up date', 'error');
      return;
    }
    try {
      await apiFetch(`/leads/${leadId}/followup`, {
        method: 'PUT',
        body: JSON.stringify({
          follow_up_date: rescheduleDate,
          follow_up_time: rescheduleTime || '11:00 AM',
          notes: rescheduleNotes,
          follow_up_status: 'pending'
        })
      });
      addToast('Follow-up rescheduled successfully!', 'success');
      setReschedulingId(null);
      setRescheduleDate('');
      setRescheduleTime('');
      setRescheduleNotes('');
      loadFollowUps();
    } catch (err) {
      addToast(err.message || 'Failed to reschedule', 'error');
    }
  };

  // Filter items in active bucket by search term
  const activeList = useMemo(() => {
    let list = [];
    if (activeBucket === 'today') list = data.today || [];
    else if (activeBucket === 'overdue') list = data.overdue || [];
    else if (activeBucket === 'upcoming') list = data.upcoming || [];
    else if (activeBucket === 'completed') list = data.completed || [];
    else if (activeBucket === 'all') {
      list = [...(data.overdue || []), ...(data.today || []), ...(data.upcoming || [])];
    }

    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(l =>
      (l.name && l.name.toLowerCase().includes(q)) ||
      (l.phone && l.phone.toLowerCase().includes(q)) ||
      (l.city && l.city.toLowerCase().includes(q)) ||
      (l.assigned_to && l.assigned_to.toLowerCase().includes(q))
    );
  }, [activeBucket, data, search]);

  const counts = data.counts || { today: 0, overdue: 0, upcoming: 0, completed: 0 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* ── Top Header & Stats Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        {/* Today's Actions */}
        <div
          onClick={() => setActiveBucket('today')}
          style={{
            background: activeBucket === 'today' ? 'rgba(34,197,94,0.12)' : P.card,
            border: `1px solid ${activeBucket === 'today' ? P.green : P.border}`,
            borderRadius: 14, padding: '16px 18px', cursor: 'pointer', transition: 'all 0.15s'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: P.green }}>Today's Actions</span>
            <span style={{
              background: 'rgba(34,197,94,0.2)', color: P.green,
              borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 800
            }}>
              Due Today
            </span>
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: P.text }}>{counts.today}</div>
          <div style={{ fontSize: 11, color: P.muted, marginTop: 4 }}>Calls & meetings scheduled for today</div>
        </div>

        {/* Overdue / Missed */}
        <div
          onClick={() => setActiveBucket('overdue')}
          style={{
            background: activeBucket === 'overdue' ? 'rgba(239,68,68,0.12)' : P.card,
            border: `1px solid ${activeBucket === 'overdue' ? P.red : P.border}`,
            borderRadius: 14, padding: '16px 18px', cursor: 'pointer', transition: 'all 0.15s'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: P.red }}>Overdue / Missed</span>
            <span style={{
              background: 'rgba(239,68,68,0.2)', color: P.red,
              borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 800
            }}>
              Urgent
            </span>
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: counts.overdue > 0 ? P.red : P.text }}>
            {counts.overdue}
          </div>
          <div style={{ fontSize: 11, color: P.muted, marginTop: 4 }}>Callbacks past due date requiring attention</div>
        </div>

        {/* Upcoming (Next 7 Days) */}
        <div
          onClick={() => setActiveBucket('upcoming')}
          style={{
            background: activeBucket === 'upcoming' ? 'rgba(59,130,246,0.12)' : P.card,
            border: `1px solid ${activeBucket === 'upcoming' ? P.blue : P.border}`,
            borderRadius: 14, padding: '16px 18px', cursor: 'pointer', transition: 'all 0.15s'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: P.blue }}>Upcoming (7 Days)</span>
            <span style={{
              background: 'rgba(59,130,246,0.2)', color: P.blue,
              borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 800
            }}>
              Next Week
            </span>
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: P.text }}>{counts.upcoming}</div>
          <div style={{ fontSize: 11, color: P.muted, marginTop: 4 }}>Scheduled walkthroughs and demos</div>
        </div>

        {/* Completed */}
        <div
          onClick={() => setActiveBucket('completed')}
          style={{
            background: activeBucket === 'completed' ? 'rgba(100,116,139,0.12)' : P.card,
            border: `1px solid ${activeBucket === 'completed' ? '#94a3b8' : P.border}`,
            borderRadius: 14, padding: '16px 18px', cursor: 'pointer', transition: 'all 0.15s'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8' }}>Archived / Done</span>
            <CheckCircle2 size={16} color="#94a3b8" />
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: P.text }}>{counts.completed}</div>
          <div style={{ fontSize: 11, color: P.muted, marginTop: 4 }}>Completed follow-up reminders</div>
        </div>
      </div>

      {/* ── Control Bar: Search & Filters ── */}
      <div style={{
        background: P.card, border: `1px solid ${P.border}`, borderRadius: 14,
        padding: '12px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 12
      }}>
        {/* Bucket Switcher Pills */}
        <div style={{ display: 'flex', background: P.card2, border: `1px solid ${P.border}`, borderRadius: 8, padding: 3, flexWrap: 'wrap' }}>
          {[
            { id: 'today', label: `Today (${counts.today})` },
            { id: 'overdue', label: `Overdue (${counts.overdue})` },
            { id: 'upcoming', label: `Upcoming (${counts.upcoming})` },
            { id: 'completed', label: `Completed (${counts.completed})` },
            { id: 'all', label: 'All Active' }
          ].map(b => (
            <button
              key={b.id}
              onClick={() => setActiveBucket(b.id)}
              style={{
                background: activeBucket === b.id ? P.gold : 'transparent',
                color: activeBucket === b.id ? '#000' : P.text,
                border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 12,
                fontWeight: activeBucket === b.id ? 700 : 500, cursor: 'pointer'
              }}
            >
              {b.label}
            </button>
          ))}
        </div>

        {/* Search & Agent Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, background: P.card2,
            border: `1px solid ${P.border}`, borderRadius: 8, padding: '5px 10px', minWidth: 200
          }}>
            <Search size={14} color={P.muted} />
            <input
              type="text"
              placeholder="Search by client or phone..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ background: 'none', border: 'none', color: P.text, fontSize: 12, outline: 'none', width: '100%' }}
            />
          </div>

          {(isAdmin || isManager) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Filter size={14} color={P.muted} />
              <select
                value={selectedAgent}
                onChange={e => setSelectedAgent(e.target.value)}
                style={{
                  background: P.card2, border: `1px solid ${P.border}`, color: P.text,
                  borderRadius: 8, padding: '6px 12px', fontSize: 12, outline: 'none'
                }}
              >
                <option value="">All Representatives</option>
                {teamMembers.map(u => (
                  <option key={u.id} value={u.name || u.email}>
                    {u.name || u.email}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={loadFollowUps}
            title="Refresh list"
            style={{
              background: P.card2, border: `1px solid ${P.border}`, borderRadius: 8,
              color: P.text, width: 32, height: 32, display: 'flex', alignItems: 'center',
              justifyContent: 'center', cursor: 'pointer'
            }}
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* ── Follow-Up Cards List ── */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ background: P.card, borderRadius: 12, height: 90, border: `1px solid ${P.border}`, animation: 'pulse 1.5s infinite' }} />
          ))}
        </div>
      ) : activeList.length === 0 ? (
        <div style={{
          background: P.card, border: `1px solid ${P.border}`, borderRadius: 14,
          padding: '40px 20px', textAlign: 'center', color: P.muted
        }}>
          <Clock size={32} color={P.muted} style={{ marginBottom: 12 }} />
          <div style={{ fontSize: 15, fontWeight: 700, color: P.text }}>No follow-ups found in this bucket</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>
            {activeBucket === 'today' ? 'All caught up for today! No pending actions.' : 'Try selecting another status tab or search query.'}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {activeList.map(lead => {
            const stageMeta = STATUS_META[lead.status] || {};
            const isCompleted = lead.follow_up_status === 'completed';
            const todayIST = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
            const fDateOnly = lead.follow_up_date ? String(lead.follow_up_date).split('T')[0] : '';
            const isOverdue = Boolean(fDateOnly && fDateOnly < todayIST && !isCompleted);
            const phoneClean = (lead.phone || '').replace(/\D/g, '').slice(-10);

            return (
              <div
                key={lead.id}
                style={{
                  background: isOverdue ? 'rgba(239,68,68,0.06)' : P.card,
                  border: `1px solid ${isOverdue ? '#ef444450' : P.border}`,
                  borderRadius: 12,
                  padding: '14px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 14,
                  transition: 'border-color 0.15s'
                }}
              >
                {/* Lead Summary Info */}
                <div style={{ flex: '1 1 300px', minWidth: 260 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span
                      onClick={() => onSelectLead?.(lead)}
                      style={{ fontSize: 15, fontWeight: 700, color: P.text, cursor: 'pointer' }}
                    >
                      {lead.name}
                    </span>
                    <span style={{
                      background: stageMeta.bg || 'rgba(255,255,255,0.1)',
                      color: stageMeta.color || P.text,
                      borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700
                    }}>
                      {stageMeta.badge || '📌'} {stageMeta.label || lead.status}
                    </span>
                    {isOverdue && (
                      <span style={{
                        background: 'rgba(239,68,68,0.2)', color: P.red,
                        border: '1px solid rgba(239,68,68,0.4)', borderRadius: 6,
                        padding: '1px 6px', fontSize: 10, fontWeight: 800
                      }}>
                        OVERDUE
                      </span>
                    )}
                  </div>

                  <div style={{ fontSize: 12, color: P.muted, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: isOverdue ? P.red : P.gold, fontWeight: 600 }}>
                      <Calendar size={13} />
                      {fmtDateOnly(lead.follow_up_date)} at {lead.follow_up_time || '11:00 AM'}
                    </span>
                    {lead.phone && <span style={{ fontFamily: 'monospace' }}>{lead.phone}</span>}
                    {lead.city && <span>{lead.city}</span>}
                    {lead.assigned_to && (
                      <span style={{ background: `${P.gold}15`, color: P.gold, borderRadius: 4, padding: '1px 6px', fontSize: 11 }}>
                        Rep: {lead.assigned_to}
                      </span>
                    )}
                  </div>

                  {lead.follow_up_notes && (
                    <div style={{ fontSize: 12, color: P.text, marginTop: 6, background: P.card2, borderRadius: 6, padding: '6px 10px' }}>
                      <em>Note:</em> {lead.follow_up_notes}
                    </div>
                  )}
                </div>

                {/* Reschedule Inline Box or Action Buttons */}
                {reschedulingId === lead.id ? (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
                    background: P.card2, border: `1px solid ${P.gold}50`, borderRadius: 10, padding: 8
                  }}>
                    <input
                      type="date"
                      value={rescheduleDate}
                      onChange={e => setRescheduleDate(e.target.value)}
                      style={{ background: P.bg, border: `1px solid ${P.border}`, color: P.text, borderRadius: 6, padding: '5px 8px', fontSize: 12 }}
                    />
                    <input
                      type="text"
                      placeholder="e.g. 02:30 PM"
                      value={rescheduleTime}
                      onChange={e => setRescheduleTime(e.target.value)}
                      style={{ background: P.bg, border: `1px solid ${P.border}`, color: P.text, borderRadius: 6, padding: '5px 8px', fontSize: 12, width: 95 }}
                    />
                    <button
                      onClick={() => handleSaveReschedule(lead.id)}
                      style={{ background: P.green, color: '#000', border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setReschedulingId(null)}
                      style={{ background: 'transparent', border: 'none', color: P.muted, cursor: 'pointer', padding: 4 }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    {/* Mark Completed */}
                    {canEditFollowUp(lead) && !isCompleted && (
                      <button
                        onClick={() => handleComplete(lead)}
                        title="Mark reminder as completed"
                        style={{
                          background: 'rgba(34,197,94,0.15)', color: P.green,
                          border: `1px solid ${P.green}50`, borderRadius: 8, padding: '6px 12px',
                          fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5
                        }}
                      >
                        <Check size={13} /> Complete
                      </button>
                    )}

                    {/* Postpone to Tomorrow */}
                    {canEditFollowUp(lead) && !isCompleted && (
                      <button
                        onClick={() => handlePostponeTomorrow(lead)}
                        title="Postpone reminder by 24 hours"
                        style={{
                          background: P.card2, color: P.text,
                          border: `1px solid ${P.border}`, borderRadius: 8, padding: '6px 10px',
                          fontSize: 12, fontWeight: 600, cursor: 'pointer'
                        }}
                      >
                        +24h Tomorrow
                      </button>
                    )}

                    {/* Reschedule Button */}
                    {canEditFollowUp(lead) ? (
                      <button
                        onClick={() => {
                          setReschedulingId(lead.id);
                          setRescheduleDate(lead.follow_up_date || new Date().toISOString().split('T')[0]);
                          setRescheduleTime(lead.follow_up_time || '11:00 AM');
                          setRescheduleNotes(lead.follow_up_notes || '');
                        }}
                        title="Set custom date/time"
                        style={{
                          background: P.card2, color: P.text,
                          border: `1px solid ${P.border}`, borderRadius: 8, padding: '6px 10px',
                          fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4
                        }}
                      >
                        <CalendarClock size={13} color={P.gold} /> Reschedule
                      </button>
                    ) : (
                      <span style={{
                        fontSize: 11, fontWeight: 700, color: P.muted,
                        background: 'rgba(255,255,255,0.05)', border: `1px solid ${P.border}`,
                        borderRadius: 8, padding: '5px 10px', display: 'inline-flex', alignItems: 'center', gap: 4
                      }}>
                        <Lock size={11} /> View-Only
                      </span>
                    )}

                    {/* Direct Call */}
                    <button
                      onClick={() => onCallLead ? onCallLead(lead) : window.open(`tel:${lead.phone}`, '_self')}
                      title="WebRTC / Phone Call"
                      style={{
                        background: 'rgba(34,197,94,0.15)', color: P.green,
                        border: `1px solid ${P.green}40`, borderRadius: 8, padding: '6px 10px',
                        cursor: 'pointer', display: 'flex', alignItems: 'center'
                      }}
                    >
                      <PhoneCall size={14} />
                    </button>

                    {/* Direct WhatsApp */}
                    {phoneClean && (
                      <a
                        href={`https://wa.me/91${phoneClean}?text=Hello%20${encodeURIComponent(lead.name || 'Client')}%2C%20following%20up%20from%20Walk%20The%20Plan.`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Open WhatsApp chat"
                        style={{
                          background: 'rgba(37,211,102,0.15)', color: '#25d366',
                          border: '1px solid rgba(37,211,102,0.4)', borderRadius: 8, padding: '6px 10px',
                          display: 'flex', alignItems: 'center', textDecoration: 'none'
                        }}
                      >
                        <MessageSquare size={14} />
                      </a>
                    )}

                    {/* Open Lead Drawer */}
                    <button
                      onClick={() => onSelectLead?.(lead)}
                      title="Open full lead drawer & interaction notes"
                      style={{
                        background: P.card2, color: P.gold,
                        border: `1px solid ${P.gold}40`, borderRadius: 8, padding: '6px 10px',
                        fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4
                      }}
                    >
                      Open <ChevronRight size={13} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
