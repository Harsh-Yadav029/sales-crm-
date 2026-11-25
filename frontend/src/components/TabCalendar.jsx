import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock, User, Filter,
  Plus, CheckCircle, AlertCircle, Phone, ArrowUpRight, List, Grid, RefreshCw
} from 'lucide-react';
import { P, STATUS_META, apiFetch, fmtDate, fmtDateOnly } from '../crmConstants';

export default function TabCalendar({
  addToast,
  onSelectLead,
  onOpenIntake,
  currentUser,
  isAdmin,
  isManager,
  isSalesExec,
  isMobile
}) {
  const [viewMode, setViewMode] = useState(isMobile ? 'agenda' : 'month'); // 'month' | 'week' | 'agenda'
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [teamMembers, setTeamMembers] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState('');
  const [selectedMobileDate, setSelectedMobileDate] = useState(() => {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  });

  // Calculate Month Boundaries
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Load team members if Admin or Manager
  useEffect(() => {
    if (isAdmin || isManager) {
      apiFetch('/users')
        .then(data => {
          const salesReps = (data?.users || []).filter(u =>
            ['sales', 'agent', 'field_agent', 'sales_engineer', 'pre_sales', 'main_sales', 'post_sales', 'manager'].includes(u.role) ||
            (u.department || '').toLowerCase().includes('sales')
          );
          setTeamMembers(salesReps);
        })
        .catch(() => {});
    }
  }, [isAdmin, isManager]);

  // Load Calendar Events from Backend
  const loadCalendarEvents = useCallback(async () => {
    setLoading(true);
    try {
      // Determine date range: month - 7 days buffer to month + 38 days buffer
      const fmtLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const start = fmtLocal(new Date(year, month - 1, 20));
      const end = fmtLocal(new Date(year, month + 2, 10));

      const params = new URLSearchParams({ start_date: start, end_date: end });
      if (selectedAgent && (isAdmin || isManager)) {
        params.set('assigned_to', selectedAgent);
      }

      const res = await apiFetch(`/calendar?${params.toString()}`);
      setEvents(res?.events || []);
    } catch (err) {
      addToast(err.message || 'Failed to load calendar events', 'error');
    } finally {
      setLoading(false);
    }
  }, [year, month, selectedAgent, isAdmin, isManager, addToast]);

  useEffect(() => {
    loadCalendarEvents();
  }, [loadCalendarEvents]);

  // Group events by date (YYYY-MM-DD)
  const eventsByDate = useMemo(() => {
    const map = {};
    for (const evt of events) {
      const rawDate = evt.date || evt.follow_up_date;
      if (!rawDate) continue;
      const key = String(rawDate).split('T')[0].split(' ')[0];
      if (!map[key]) map[key] = [];
      map[key].push(evt);
    }
    return map;
  }, [events]);

  // Today in YYYY-MM-DD (IST)
  const todayStr = useMemo(() => {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  }, []);

  // Urgency styling helper
  const getEventUrgency = (evt) => {
    const rawDate = evt.date || evt.follow_up_date || '';
    const dateStr = String(rawDate).split('T')[0].split(' ')[0];
    const isCompleted = evt.follow_up_status === 'completed';
    if (isCompleted) {
      return {
        bg: 'rgba(100,116,139,0.18)',
        border: '#475569',
        text: '#94a3b8',
        label: 'Done',
        isOverdue: false
      };
    }
    if (dateStr < todayStr) {
      return {
        bg: 'rgba(239,68,68,0.22)',
        border: '#ef4444',
        text: '#f87171',
        label: 'Overdue',
        isOverdue: true
      };
    }
    if (dateStr === todayStr) {
      return {
        bg: 'rgba(34,197,94,0.22)',
        border: '#22c55e',
        text: '#4ade80',
        label: 'Today',
        isToday: true
      };
    }
    return {
      bg: 'rgba(59,130,246,0.22)',
      border: '#3b82f6',
      text: '#93c5fd',
      label: 'Scheduled',
      isFuture: true
    };
  };

  // Month navigation helpers
  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const jumpToday = () => {
    setCurrentDate(new Date());
    setSelectedMobileDate(todayStr);
  };

  // Generate Month Grid Days
  const monthDays = useMemo(() => {
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sun
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    const days = [];
    // Previous month padding
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = prevMonthDays - i;
      const prevDate = new Date(year, month - 1, d);
      const mStr = String(prevDate.getMonth() + 1).padStart(2, '0');
      const dStr = String(d).padStart(2, '0');
      days.push({
        dayNum: d,
        dateStr: `${prevDate.getFullYear()}-${mStr}-${dStr}`,
        isCurrentMonth: false,
      });
    }
    // Current month days
    for (let d = 1; d <= totalDaysInMonth; d++) {
      const mStr = String(month + 1).padStart(2, '0');
      const dStr = String(d).padStart(2, '0');
      days.push({
        dayNum: d,
        dateStr: `${year}-${mStr}-${dStr}`,
        isCurrentMonth: true,
      });
    }
    // Next month padding to fill 35 or 42 cells
    const remaining = 42 - days.length;
    for (let d = 1; d <= remaining && days.length % 7 !== 0; d++) {
      const nextDate = new Date(year, month + 1, d);
      const mStr = String(nextDate.getMonth() + 1).padStart(2, '0');
      const dStr = String(d).padStart(2, '0');
      days.push({
        dayNum: d,
        dateStr: `${nextDate.getFullYear()}-${mStr}-${dStr}`,
        isCurrentMonth: false,
      });
    }
    return days;
  }, [year, month]);

  // Generate Week Days for Week View
  const weekDays = useMemo(() => {
    const curr = new Date(currentDate);
    const day = curr.getDay(); // 0 = Sun
    const diff = curr.getDate() - day + (day === 0 ? -6 : 1); // Monday start
    const monday = new Date(curr.setDate(diff));

    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const yStr = d.getFullYear();
      const mStr = String(d.getMonth() + 1).padStart(2, '0');
      const dStr = String(d.getDate()).padStart(2, '0');
      days.push({
        date: d,
        dayNum: d.getDate(),
        dateStr: `${yStr}-${mStr}-${dStr}`,
        dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
        isToday: `${yStr}-${mStr}-${dStr}` === todayStr
      });
    }
    return days;
  }, [currentDate, todayStr]);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* ── Top Calendar Control Bar ── */}
      <div style={{
        background: P.card,
        border: `1px solid ${P.border}`,
        borderRadius: 14,
        padding: '14px 18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12
      }}>
        {/* Month Title & Nav */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              onClick={prevMonth}
              title="Previous Month"
              style={{
                background: P.card2, border: `1px solid ${P.border}`, borderRadius: 8,
                color: P.text, width: 34, height: 34, display: 'flex', alignItems: 'center',
                justifyContent: 'center', cursor: 'pointer'
              }}
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={nextMonth}
              title="Next Month"
              style={{
                background: P.card2, border: `1px solid ${P.border}`, borderRadius: 8,
                color: P.text, width: 34, height: 34, display: 'flex', alignItems: 'center',
                justifyContent: 'center', cursor: 'pointer'
              }}
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <h2 style={{ margin: 0, fontSize: isMobile ? 18 : 22, fontWeight: 800, color: P.text, letterSpacing: -0.5 }}>
            {monthNames[month]} {year}
          </h2>

          <button
            onClick={jumpToday}
            style={{
              background: P.card2, border: `1px solid ${P.gold}50`, color: P.gold,
              borderRadius: 8, padding: '5px 12px', fontSize: 12, fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Today
          </button>

          {loading && <RefreshCw size={15} color={P.gold} style={{ animation: 'spin 1s linear infinite' }} />}
        </div>

        {/* View Switcher & Agent Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Agent Filter for Manager/Admin */}
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
                <option value="">All Sales Representatives</option>
                {teamMembers.map(u => (
                  <option key={u.id} value={u.name || u.email}>
                    {u.name || u.email} ({u.role})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* View Mode Toggle */}
          <div style={{ display: 'flex', background: P.card2, border: `1px solid ${P.border}`, borderRadius: 8, padding: 3 }}>
            <button
              onClick={() => setViewMode('month')}
              style={{
                background: viewMode === 'month' ? P.gold : 'transparent',
                color: viewMode === 'month' ? '#000' : P.text,
                border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 12,
                fontWeight: viewMode === 'month' ? 700 : 500, cursor: 'pointer'
              }}
            >
              Month
            </button>
            <button
              onClick={() => setViewMode('week')}
              style={{
                background: viewMode === 'week' ? P.gold : 'transparent',
                color: viewMode === 'week' ? '#000' : P.text,
                border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 12,
                fontWeight: viewMode === 'week' ? 700 : 500, cursor: 'pointer'
              }}
            >
              Week
            </button>
            {isMobile && (
              <button
                onClick={() => setViewMode('agenda')}
                style={{
                  background: viewMode === 'agenda' ? P.gold : 'transparent',
                  color: viewMode === 'agenda' ? '#000' : P.text,
                  border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 12,
                  fontWeight: viewMode === 'agenda' ? 700 : 500, cursor: 'pointer'
                }}
              >
                Agenda
              </button>
            )}
          </div>

          {/* Quick Add Lead Button */}
          <button
            onClick={() => onOpenIntake?.(todayStr)}
            style={{
              background: `linear-gradient(135deg, ${P.gold} 0%, #d97706 100%)`,
              color: '#000', border: 'none', borderRadius: 8, padding: '7px 14px',
              fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex',
              alignItems: 'center', gap: 6, boxShadow: '0 2px 10px rgba(245,158,11,0.25)'
            }}
          >
            <Plus size={14} /> Schedule Follow-Up
          </button>
        </div>
      </div>

      {/* ── Urgency Legend ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 12, color: P.muted, padding: '0 6px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444' }} />
          <span>Overdue / Action Needed</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#22c55e' }} />
          <span>Due Today</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#3b82f6' }} />
          <span>Upcoming Interaction</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#64748b' }} />
          <span>Completed</span>
        </div>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: P.muted }}>
          Tip: Click any empty tile to schedule for that day; click any event card to open lead drawer.
        </span>
      </div>

      {/* ── MOBILE AGENDA VIEW OR 1-WEEK SWIPER (FOR MOBILE) ── */}
      {(viewMode === 'agenda' || (isMobile && viewMode !== 'week' && viewMode !== 'month')) ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* 7-Day Horizontal Swipeable Strip */}
          <div style={{
            display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 6,
            WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none'
          }}>
            {weekDays.map(w => {
              const isSelected = selectedMobileDate === w.dateStr;
              const dayEvts = eventsByDate[w.dateStr] || [];
              const getEvtDate = (e) => String(e.date || e.follow_up_date || '').split('T')[0].split(' ')[0];
              const hasOverdue = dayEvts.some(e => getEvtDate(e) < todayStr && e.follow_up_status !== 'completed');
              const hasToday = dayEvts.some(e => getEvtDate(e) === todayStr && e.follow_up_status !== 'completed');
              return (
                <div
                  key={w.dateStr}
                  onClick={() => setSelectedMobileDate(w.dateStr)}
                  style={{
                    flex: '0 0 68px',
                    background: isSelected ? 'rgba(245,158,11,0.18)' : P.card,
                    border: `1px solid ${isSelected ? P.gold : w.isToday ? P.green : P.border}`,
                    borderRadius: 12, padding: '10px 6px', textAlign: 'center', cursor: 'pointer',
                    position: 'relative'
                  }}
                >
                  <div style={{ fontSize: 11, color: isSelected ? P.gold : P.muted, textTransform: 'uppercase', fontWeight: 600 }}>
                    {w.dayName}
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: isSelected ? P.gold : P.text, margin: '2px 0' }}>
                    {w.dayNum}
                  </div>
                  {dayEvts.length > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 3, marginTop: 4 }}>
                      <span style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: hasOverdue ? '#ef4444' : hasToday ? '#22c55e' : '#3b82f6'
                      }} />
                      <span style={{ fontSize: 10, fontWeight: 700, color: P.muted }}>
                        {dayEvts.length}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Selected Date Agenda List */}
          <div style={{ background: P.card, border: `1px solid ${P.border}`, borderRadius: 14, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: P.text, display: 'flex', alignItems: 'center', gap: 6 }}>
                <CalendarIcon size={16} color={P.gold} />
                Agenda for {fmtDateOnly(selectedMobileDate)}
              </div>
              <button
                onClick={() => onOpenIntake?.(selectedMobileDate)}
                style={{
                  background: P.card2, border: `1px solid ${P.gold}50`, color: P.gold,
                  borderRadius: 6, padding: '4px 8px', fontSize: 11, fontWeight: 600, cursor: 'pointer'
                }}
              >
                + Schedule
              </button>
            </div>

            {(!eventsByDate[selectedMobileDate] || eventsByDate[selectedMobileDate].length === 0) ? (
              <div style={{ textAlign: 'center', padding: '30px 20px', color: P.muted, fontSize: 13 }}>
                No scheduled follow-ups or appointments for this day.
                <div style={{ marginTop: 8 }}>
                  <button
                    onClick={() => onOpenIntake?.(selectedMobileDate)}
                    style={{ background: 'none', border: `1px dashed ${P.gold}`, color: P.gold, borderRadius: 8, padding: '6px 14px', fontSize: 12, cursor: 'pointer' }}
                  >
                    + Add Lead / Follow-Up
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {eventsByDate[selectedMobileDate].map(evt => {
                  const urgency = getEventUrgency(evt);
                  const evtStage = evt.lead_stage || evt.status;
                  const evtName = evt.lead_name || evt.name;
                  const evtTime = evt.time || evt.follow_up_time;
                  const stageMeta = STATUS_META[evtStage] || {};
                  return (
                    <div
                      key={evt.id}
                      onClick={() => onSelectLead?.(evt)}
                      style={{
                        background: urgency.bg,
                        border: `1px solid ${urgency.border}`,
                        borderRadius: 10,
                        padding: '12px 14px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: P.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {evtName}
                          </span>
                          <span style={{
                            background: stageMeta.bg || 'rgba(255,255,255,0.1)',
                            color: stageMeta.color || P.text,
                            borderRadius: 4, padding: '1px 6px', fontSize: 10, fontWeight: 700
                          }}>
                            {stageMeta.badge || '📌'} {stageMeta.label || evtStage}
                          </span>
                        </div>
                        <div style={{ fontSize: 11, color: P.muted, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Clock size={11} color={urgency.text} />
                            <strong style={{ color: urgency.text }}>{evtTime || 'All Day'}</strong>
                          </span>
                          {evt.phone && <span style={{ fontFamily: 'monospace' }}>{evt.phone}</span>}
                          {evt.assigned_to && <span>Rep: {evt.assigned_to}</span>}
                        </div>
                      </div>
                      <ArrowUpRight size={16} color={P.muted} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : viewMode === 'week' ? (
        /* ── WEEK VIEW ── */
        <div style={{
          background: P.card, border: `1px solid ${P.border}`, borderRadius: 14, overflow: 'hidden'
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: `1px solid ${P.border}`, background: P.card2 }}>
            {weekDays.map(w => (
              <div key={w.dateStr} style={{ padding: '10px 6px', textAlign: 'center', borderRight: `1px solid ${P.border}30` }}>
                <div style={{ fontSize: 11, color: w.isToday ? P.gold : P.muted, fontWeight: 600, textTransform: 'uppercase' }}>
                  {w.dayName}
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, color: w.isToday ? P.gold : P.text }}>
                  {w.dayNum}
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', minHeight: 460 }}>
            {weekDays.map(w => {
              const dayEvts = eventsByDate[w.dateStr] || [];
              return (
                <div
                  key={w.dateStr}
                  onClick={(e) => {
                    if (e.target === e.currentTarget) onOpenIntake?.(w.dateStr);
                  }}
                  style={{
                    padding: 8,
                    borderRight: `1px solid ${P.border}30`,
                    borderBottom: `1px solid ${P.border}30`,
                    background: w.isToday ? 'rgba(245,158,11,0.03)' : 'transparent',
                    display: 'flex', flexDirection: 'column', gap: 6, minHeight: 380,
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => onOpenIntake?.(w.dateStr)}
                      title={`Add follow-up for ${w.dateStr}`}
                      style={{
                        background: 'transparent', border: 'none', color: P.muted,
                        cursor: 'pointer', padding: 2, borderRadius: 4
                      }}
                      onMouseEnter={e => e.currentTarget.style.color = P.gold}
                      onMouseLeave={e => e.currentTarget.style.color = P.muted}
                    >
                      <Plus size={13} />
                    </button>
                  </div>

                  {dayEvts.map(evt => {
                    const urgency = getEventUrgency(evt);
                    const evtStage = evt.lead_stage || evt.status;
                    const evtName = evt.lead_name || evt.name;
                    const evtTime = evt.time || evt.follow_up_time;
                    const stageMeta = STATUS_META[evtStage] || {};
                    return (
                      <div
                        key={evt.id}
                        onClick={(e) => { e.stopPropagation(); onSelectLead?.(evt); }}
                        style={{
                          background: urgency.bg, border: `1px solid ${urgency.border}`,
                          borderRadius: 8, padding: '6px 8px', cursor: 'pointer',
                          transition: 'transform 0.12s', fontSize: 11
                        }}
                        onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                        onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                      >
                        <div style={{ fontWeight: 700, color: P.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {evtName}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 3 }}>
                          <span style={{ color: urgency.text, fontWeight: 600, fontSize: 10 }}>
                            {evtTime || 'Anytime'}
                          </span>
                          <span style={{ fontSize: 10 }}>{stageMeta.badge || '📌'}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* ── MONTH VIEW (DEFAULT DESKTOP) ── */
        <div style={{
          background: P.card, border: `1px solid ${P.border}`, borderRadius: 14, overflow: 'hidden'
        }}>
          {/* Day Headers (Sun - Sat) */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
            borderBottom: `1px solid ${P.border}`, background: P.card2
          }}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} style={{ padding: '10px 8px', textAlign: 'center', fontSize: 12, fontWeight: 700, color: P.muted }}>
                {d}
              </div>
            ))}
          </div>

          {/* Day Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
            {monthDays.map((cell, idx) => {
              const isToday = cell.dateStr === todayStr;
              const dayEvts = eventsByDate[cell.dateStr] || [];
              return (
                <div
                  key={idx}
                  onClick={(e) => {
                    if (e.target === e.currentTarget) onOpenIntake?.(cell.dateStr);
                  }}
                  style={{
                    minHeight: 110,
                    padding: 8,
                    borderRight: `1px solid ${P.border}25`,
                    borderBottom: `1px solid ${P.border}25`,
                    background: isToday ? 'rgba(245,158,11,0.04)' : cell.isCurrentMonth ? 'transparent' : 'rgba(0,0,0,0.25)',
                    opacity: cell.isCurrentMonth ? 1 : 0.45,
                    display: 'flex', flexDirection: 'column', gap: 4,
                    cursor: 'pointer', transition: 'background 0.15s'
                  }}
                  onMouseEnter={e => { if (cell.isCurrentMonth) e.currentTarget.style.background = '#ffffff04'; }}
                  onMouseLeave={e => { if (cell.isCurrentMonth) e.currentTarget.style.background = isToday ? 'rgba(245,158,11,0.04)' : 'transparent'; }}
                >
                  {/* Date Header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span style={{
                      fontSize: 12,
                      fontWeight: isToday ? 800 : 600,
                      color: isToday ? '#000' : P.text,
                      background: isToday ? P.gold : 'transparent',
                      width: isToday ? 22 : 'auto', height: isToday ? 22 : 'auto',
                      borderRadius: isToday ? '50%' : 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      {cell.dayNum}
                    </span>

                    {/* Quick + Add button on tile */}
                    <button
                      onClick={(e) => { e.stopPropagation(); onOpenIntake?.(cell.dateStr); }}
                      title={`Schedule follow-up for ${cell.dateStr}`}
                      style={{
                        background: 'transparent', border: 'none', color: P.muted,
                        cursor: 'pointer', padding: 0, opacity: 0.6
                      }}
                      onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = P.gold; }}
                      onMouseLeave={e => { e.currentTarget.style.opacity = '0.6'; e.currentTarget.style.color = P.muted; }}
                    >
                      <Plus size={12} />
                    </button>
                  </div>

                  {/* Day Event Chips */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, overflow: 'hidden' }}>
                    {dayEvts.slice(0, 3).map(evt => {
                      const urgency = getEventUrgency(evt);
                      const evtStage = evt.lead_stage || evt.status;
                      const evtName = evt.lead_name || evt.name;
                      const evtTime = evt.time || evt.follow_up_time;
                      const evtNotes = evt.notes || evt.follow_up_notes || '';
                      const stageMeta = STATUS_META[evtStage] || {};
                      return (
                        <div
                          key={evt.id}
                          onClick={(e) => { e.stopPropagation(); onSelectLead?.(evt); }}
                          title={`${evtName} (${evtStage}) - ${evtTime || 'No time set'}\n${evtNotes}`}
                          style={{
                            background: urgency.bg,
                            border: `1px solid ${urgency.border}`,
                            borderRadius: 6,
                            padding: '3px 6px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 4,
                            transition: 'transform 0.12s'
                          }}
                          onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.02)'}
                          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                        >
                          <span style={{
                            fontSize: 11, fontWeight: 700, color: P.text,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                          }}>
                            {evtName}
                          </span>
                          <span style={{
                            fontSize: 9, fontWeight: 700, color: urgency.text, whiteSpace: 'nowrap'
                          }}>
                            {evtTime ? evtTime.split(' ')[0] : stageMeta.badge || '•'}
                          </span>
                        </div>
                      );
                    })}

                    {dayEvts.length > 3 && (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedMobileDate(cell.dateStr);
                          setViewMode('agenda');
                        }}
                        style={{ fontSize: 10, color: P.gold, fontWeight: 700, cursor: 'pointer', textAlign: 'center' }}
                      >
                        +{dayEvts.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
