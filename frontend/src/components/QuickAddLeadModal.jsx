import React, { useState, useEffect, useRef } from 'react';
import {
  X, UserPlus, AlertTriangle, CheckCircle, Phone, Mail, MapPin,
  DollarSign, Layers, Calendar, Clock, User, Shield, RefreshCw
} from 'lucide-react';
import { P, STATUS_OPTIONS, STATUS_META, apiFetch } from '../crmConstants';

export default function QuickAddLeadModal({
  isOpen,
  onClose,
  onLeadCreated,
  addToast,
  initialDate = '',
  currentUser,
  isAdmin,
  isManager
}) {
  const assignedPipe = (currentUser?.assigned_pipeline || '').toLowerCase();
  const canSelectPipeline = Boolean(isAdmin || isManager || assignedPipe === 'all');
  const defaultPipelineStage = (!canSelectPipeline && ['pre_sales', 'main_sales', 'post_sales'].includes(assignedPipe)) ? assignedPipe : 'pre_sales';

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [category, setCategory] = useState('direct');
  const [pipelineStage, setPipelineStage] = useState(defaultPipelineStage);
  const [status, setStatus] = useState('Blank Lead');
  const [floorPlanStatus, setFloorPlanStatus] = useState('Rough Sketch');
  const [plotSize, setPlotSize] = useState('');
  const [budget, setBudget] = useState('');
  const [assignedTo, setAssignedTo] = useState(currentUser?.name || currentUser?.email || '');
  const [followUpDate, setFollowUpDate] = useState(initialDate || '');
  const [followUpTime, setFollowUpTime] = useState('11:00 AM');
  const [followUpNotes, setFollowUpNotes] = useState('');

  useEffect(() => {
    if (isOpen) {
      setPipelineStage(defaultPipelineStage);
    }
  }, [isOpen, defaultPipelineStage]);

  // Duplicate Check State
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  const [teamMembers, setTeamMembers] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const debounceTimer = useRef(null);

  useEffect(() => {
    if (initialDate) setFollowUpDate(initialDate);
  }, [initialDate]);

  // Load team members for assignment
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

  // Real-time Phone Validation and Duplicate Checking
  const handlePhoneChange = (val) => {
    const cleaned = val.replace(/[^\d+]/g, '');
    setPhone(cleaned);

    const pureDigits = cleaned.replace(/\D/g, '').slice(-10);
    if (cleaned && pureDigits.length > 0 && !/^[6-9]\d{0,9}$/.test(pureDigits)) {
      setPhoneError('Indian mobile numbers typically start with 6, 7, 8, or 9');
    } else if (pureDigits.length > 0 && pureDigits.length !== 10) {
      setPhoneError('Enter full 10-digit mobile number');
    } else {
      setPhoneError('');
    }

    // Trigger duplicate check on debounced timer
    if (pureDigits.length === 10) {
      triggerDuplicateCheck(pureDigits, email);
    } else {
      setDuplicateWarning(null);
    }
  };

  const handleEmailChange = (val) => {
    setEmail(val);
    if (val && val.includes('@') && val.includes('.')) {
      triggerDuplicateCheck(phone, val);
    }
  };

  const triggerDuplicateCheck = (p, e) => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(async () => {
      setCheckingDuplicate(true);
      try {
        const params = new URLSearchParams();
        if (p) params.set('phone', p);
        if (e) params.set('email', e);
        const res = await apiFetch(`/leads/check-duplicate?${params.toString()}`);
        if (res?.exists && res.lead) {
          setDuplicateWarning(res.lead);
        } else {
          setDuplicateWarning(null);
        }
      } catch {
        setDuplicateWarning(null);
      } finally {
        setCheckingDuplicate(false);
      }
    }, 400);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      addToast('Please enter client full name', 'error');
      return;
    }
    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    if (!cleanPhone || cleanPhone.length !== 10) {
      addToast('Please enter a valid 10-digit mobile number', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        phone: cleanPhone,
        email: email.trim(),
        city: city.trim(),
        lead_category: category,
        pipeline_stage: pipelineStage,
        status: status || 'Blank Lead',
        floor_plan_status: floorPlanStatus,
        plot_size: plotSize.trim(),
        budget: budget.trim(),
        assigned_to: assignedTo,
        follow_up_date: followUpDate,
        follow_up_time: followUpTime,
        follow_up_notes: followUpNotes,
        source: category === 'walk-in' ? 'Walk-in Studio' : category === 'google_sheets' ? 'Google Sheet Live Sync' : category === 'meta' ? 'Meta Ads' : 'Manual Intake'
      };

      const res = await apiFetch('/leads', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      addToast(`Lead "${name}" successfully registered into CRM!`, 'success');
      onLeadCreated?.(res?.lead || payload);
      onClose();
      resetForm();
    } catch (err) {
      addToast(err.message || 'Failed to create lead', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setName('');
    setPhone('');
    setEmail('');
    setCity('');
    setCategory('direct');
    setPipelineStage(defaultPipelineStage);
    setStatus('Blank Lead');
    setPlotSize('');
    setBudget('');
    setFollowUpDate('');
    setFollowUpNotes('');
    setDuplicateWarning(null);
    setPhoneError('');
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.75)',
      backdropFilter: 'blur(5px)',
      zIndex: 950,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16
    }}>
      <div style={{
        background: P.card,
        border: `1px solid ${P.gold}60`,
        borderRadius: 16,
        width: 580,
        maxWidth: '100%',
        maxHeight: '92vh',
        overflowY: 'auto',
        boxShadow: '0 10px 40px rgba(0,0,0,0.8)',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: `1px solid ${P.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: P.card2
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: `${P.gold}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <UserPlus size={16} color={P.gold} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: P.text }}>
                Register New Sales Opportunity
              </h3>
              <p style={{ margin: 0, fontSize: 11, color: P.muted }}>
                Direct lead intake with automatic duplicate detection & assignment
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: P.card, border: `1px solid ${P.border}`, borderRadius: 8,
              color: P.muted, width: 32, height: 32, display: 'flex', alignItems: 'center',
              justifyContent: 'center', cursor: 'pointer'
            }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Duplicate Lead Alert Warning */}
        {duplicateWarning && (
          <div style={{
            margin: '14px 20px 0',
            background: 'rgba(239,68,68,0.15)',
            border: `1px solid ${P.red}`,
            borderRadius: 10,
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10
          }}>
            <AlertTriangle size={18} color={P.red} style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: 12, color: P.text, lineHeight: 1.4 }}>
              <strong style={{ color: P.red }}>Potential Duplicate Lead Detected!</strong>
              <div>
                Client <strong>{duplicateWarning.name}</strong> ({duplicateWarning.phone}) already exists in stage{' '}
                <span style={{ color: P.gold, fontWeight: 700 }}>{duplicateWarning.status}</span>, assigned to{' '}
                <strong>{duplicateWarning.assigned_to || 'Unassigned'}</strong>.
              </div>
            </div>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Section: Client Details */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: P.gold, textTransform: 'uppercase', marginBottom: 8 }}>
              1. Prospect / Client Information
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: 11, color: P.muted, display: 'block', marginBottom: 4 }}>Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Vikramaditya Rathore"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  style={{
                    width: '100%', background: P.card2, border: `1px solid ${P.border}`,
                    color: P.text, borderRadius: 8, padding: '10px 12px', fontSize: 13, boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: 11, color: P.muted, display: 'block', marginBottom: 4 }}>
                  Phone Number (10 Digits) *
                </label>
                <input
                  type="tel"
                  required
                  placeholder="9876543210"
                  value={phone}
                  onChange={e => handlePhoneChange(e.target.value)}
                  style={{
                    width: '100%', background: P.card2, border: `1px solid ${phoneError ? P.red : P.border}`,
                    color: P.text, borderRadius: 8, padding: '10px 12px', fontSize: 13, fontFamily: 'monospace', boxSizing: 'border-box'
                  }}
                />
                {phoneError && <span style={{ fontSize: 10, color: P.red, marginTop: 2, display: 'block' }}>{phoneError}</span>}
              </div>

              <div>
                <label style={{ fontSize: 11, color: P.muted, display: 'block', marginBottom: 4 }}>Email Address</label>
                <input
                  type="email"
                  placeholder="vikram@example.com"
                  value={email}
                  onChange={e => handleEmailChange(e.target.value)}
                  style={{
                    width: '100%', background: P.card2, border: `1px solid ${P.border}`,
                    color: P.text, borderRadius: 8, padding: '10px 12px', fontSize: 13, boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: 11, color: P.muted, display: 'block', marginBottom: 4 }}>City / Location</label>
                <input
                  type="text"
                  placeholder="e.g. Gurugram, Delhi, Noida"
                  value={city}
                  onChange={e => setCity(e.target.value)}
                  style={{
                    width: '100%', background: P.card2, border: `1px solid ${P.border}`,
                    color: P.text, borderRadius: 8, padding: '10px 12px', fontSize: 13, boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>
          </div>

          {/* Section: Project Scope */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: P.gold, textTransform: 'uppercase', marginBottom: 8 }}>
              2. Architectural Project Scope
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: 11, color: P.muted, display: 'block', marginBottom: 4 }}>Floor Plan Status</label>
                <select
                  value={floorPlanStatus}
                  onChange={e => setFloorPlanStatus(e.target.value)}
                  style={{
                    width: '100%', background: P.card2, border: `1px solid ${P.border}`,
                    color: P.text, borderRadius: 8, padding: '10px 10px', fontSize: 12, boxSizing: 'border-box'
                  }}
                >
                  <option value="Ready to Build">Ready to Build</option>
                  <option value="Have CAD">Have CAD Drawing</option>
                  <option value="Rough Sketch">Rough Sketch</option>
                  <option value="Needs Design">Needs Complete Design</option>
                  <option value="In Progress">Floor Plan in Progress</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: 11, color: P.muted, display: 'block', marginBottom: 4 }}>Plot Area / Size</label>
                <input
                  type="text"
                  placeholder="e.g. 300 sq.yd / 2400 sq.ft"
                  value={plotSize}
                  onChange={e => setPlotSize(e.target.value)}
                  style={{
                    width: '100%', background: P.card2, border: `1px solid ${P.border}`,
                    color: P.text, borderRadius: 8, padding: '10px 12px', fontSize: 12, boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: 11, color: P.muted, display: 'block', marginBottom: 4 }}>Est. Budget</label>
                <input
                  type="text"
                  placeholder="e.g. ₹1.5 Cr"
                  value={budget}
                  onChange={e => setBudget(e.target.value)}
                  style={{
                    width: '100%', background: P.card2, border: `1px solid ${P.border}`,
                    color: P.text, borderRadius: 8, padding: '10px 12px', fontSize: 12, boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>
          </div>

          {/* Section: Stage & Assignment */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: P.gold, textTransform: 'uppercase', marginBottom: 8 }}>
              3. Channel, Pipeline & Qualification Stage
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: 11, color: P.muted, display: 'block', marginBottom: 4 }}>Pipeline Section</label>
                <select
                  value={pipelineStage}
                  disabled={!canSelectPipeline}
                  onChange={e => setPipelineStage(e.target.value)}
                  style={{
                    width: '100%', background: P.card2, border: `1px solid ${P.border}`,
                    color: canSelectPipeline ? P.text : P.muted, borderRadius: 8, padding: '10px 10px', fontSize: 12, boxSizing: 'border-box',
                    cursor: canSelectPipeline ? 'pointer' : 'not-allowed'
                  }}
                >
                  <option value="pre_sales">01 · Pre-Sales</option>
                  <option value="main_sales">02 · Main Sales</option>
                  <option value="post_sales">03 · Post-Sales</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: 11, color: P.muted, display: 'block', marginBottom: 4 }}>Category</label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  style={{
                    width: '100%', background: P.card2, border: `1px solid ${P.border}`,
                    color: P.text, borderRadius: 8, padding: '10px 10px', fontSize: 12, boxSizing: 'border-box'
                  }}
                >
                  <option value="direct">Direct Walk-in / Call</option>
                  <option value="google_sheets">Google Leads Sheet</option>
                  <option value="meta">Meta Ads</option>
                  <option value="franchise">Franchise Referral</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: 11, color: P.muted, display: 'block', marginBottom: 4 }}>Initial Stage</label>
                <select
                  value={status}
                  onChange={e => setStatus(e.target.value)}
                  style={{
                    width: '100%', background: P.card2, border: `1px solid ${P.border}`,
                    color: P.text, borderRadius: 8, padding: '10px 10px', fontSize: 12, boxSizing: 'border-box'
                  }}
                >
                  {STATUS_OPTIONS.map(st => (
                    <option key={st} value={st}>{STATUS_META[st]?.badge || '•'} {st}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 11, color: P.muted, display: 'block', marginBottom: 4 }}>Assigned Agent</label>
                {(isAdmin || isManager) && teamMembers.length > 0 ? (
                  <select
                    value={assignedTo}
                    onChange={e => setAssignedTo(e.target.value)}
                    style={{
                      width: '100%', background: P.card2, border: `1px solid ${P.border}`,
                      color: P.text, borderRadius: 8, padding: '10px 10px', fontSize: 12, boxSizing: 'border-box'
                    }}
                  >
                    <option value="">Unassigned</option>
                    {teamMembers.map(u => (
                      <option key={u.id} value={u.name || u.email}>{u.name || u.email}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    disabled
                    value={assignedTo || 'Current Sales Rep'}
                    style={{
                      width: '100%', background: P.card2, border: `1px solid ${P.border}`,
                      color: P.muted, borderRadius: 8, padding: '10px 12px', fontSize: 12, boxSizing: 'border-box'
                    }}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Section: Follow-Up Schedule */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: P.gold, textTransform: 'uppercase', marginBottom: 8 }}>
              4. Follow-Up Callback or Walkthrough Date (Optional)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: 11, color: P.muted, display: 'block', marginBottom: 4 }}>Target Date</label>
                <input
                  type="date"
                  value={followUpDate}
                  onChange={e => setFollowUpDate(e.target.value)}
                  style={{
                    width: '100%', background: P.card2, border: `1px solid ${P.border}`,
                    color: P.text, borderRadius: 8, padding: '9px 12px', fontSize: 12, boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: 11, color: P.muted, display: 'block', marginBottom: 4 }}>Time</label>
                <input
                  type="text"
                  placeholder="e.g. 11:30 AM"
                  value={followUpTime}
                  onChange={e => setFollowUpTime(e.target.value)}
                  style={{
                    width: '100%', background: P.card2, border: `1px solid ${P.border}`,
                    color: P.text, borderRadius: 8, padding: '9px 12px', fontSize: 12, boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <input
                  type="text"
                  placeholder="Follow-up notes (e.g. wants 1:1 projection walkthrough on Saturday)"
                  value={followUpNotes}
                  onChange={e => setFollowUpNotes(e.target.value)}
                  style={{
                    width: '100%', background: P.card2, border: `1px solid ${P.border}`,
                    color: P.text, borderRadius: 8, padding: '9px 12px', fontSize: 12, boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>
          </div>

          {/* Submit Actions */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: P.card2, color: P.muted, border: `1px solid ${P.border}`,
                borderRadius: 8, padding: '10px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={{
                background: `linear-gradient(135deg, ${P.gold} 0%, #d97706 100%)`,
                color: '#000', border: 'none', borderRadius: 8, padding: '10px 22px',
                fontSize: 13, fontWeight: 800, cursor: 'pointer', display: 'flex',
                alignItems: 'center', gap: 6, boxShadow: '0 2px 12px rgba(245,158,11,0.3)'
              }}
            >
              {submitting ? <RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <CheckCircle size={15} />}
              Register Lead
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
