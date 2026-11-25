import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Lock, Mail, Eye, EyeOff, AlertCircle, Loader } from 'lucide-react';
import { BACKEND_BASE, API } from '../crmConstants';

const P = {
  bg: '#09090b', card: '#111113', border: '#27272a',
  text: '#fafafa', muted: '#a1a1aa', gold: '#f59e0b',
  red: '#ef4444', green: '#22c55e',
};

export default function CRMLoginPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // If already logged in, redirect
  useEffect(() => {
    const token = localStorage.getItem('crm_token');
    if (token) navigate('/crm', { replace: true });
  }, [navigate]);

  const submit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

      let res;
      try {
        res = await fetch(`${API}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
      } catch (fetchErr) {
        if (isLocal && BACKEND_BASE) {
          // If direct URL is blocked locally, fallback through Vite dev proxy
          res = await fetch('/api/crm/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(form),
          });
        } else {
          throw fetchErr;
        }
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Login failed');
      localStorage.setItem('crm_token', data.token);
      localStorage.setItem('crm_user', JSON.stringify(data.user));
      navigate('/crm', { replace: true });
    } catch (err) {
      setError(err.message === 'Failed to fetch' ? 'Cannot reach CRM backend server. Ensure the backend is running.' : (err.message || 'Invalid credentials. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const inputBase = {
    width: '100%', boxSizing: 'border-box',
    background: '#0c0c0e', border: `1px solid ${P.border}`,
    borderRadius: 10, padding: '12px 14px 12px 42px',
    color: P.text, fontSize: 14, outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    fontFamily: 'inherit',
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #09090b; }

        @keyframes gradientShift {
          0%   { background-position: 0% 50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes floatUp {
          0%   { opacity: 0; transform: translateY(30px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes shimmer {
          0%   { opacity: 0.06; }
          50%  { opacity: 0.12; }
          100% { opacity: 0.06; }
        }

        .crm-login-root {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'Inter', system-ui, sans-serif;
          background: #09090b;
          padding: 20px;
          position: relative;
          overflow: hidden;
        }

        /* Animated mesh gradient background */
        .crm-login-root::before {
          content: '';
          position: fixed;
          inset: 0;
          background: linear-gradient(135deg,
            rgba(245,158,11,0.08) 0%,
            rgba(9,9,11,0) 40%,
            rgba(168,85,247,0.05) 70%,
            rgba(34,197,94,0.04) 100%
          );
          background-size: 400% 400%;
          animation: gradientShift 12s ease infinite;
          pointer-events: none;
          z-index: 0;
        }

        /* Grid dots pattern */
        .crm-login-root::after {
          content: '';
          position: fixed;
          inset: 0;
          background-image: radial-gradient(rgba(245,158,11,0.15) 1px, transparent 1px);
          background-size: 40px 40px;
          pointer-events: none;
          z-index: 0;
          animation: shimmer 6s ease-in-out infinite;
        }

        .login-card {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 960px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          min-height: 560px;
          border-radius: 24px;
          overflow: hidden;
          box-shadow: 0 40px 120px rgba(0,0,0,0.7), 0 0 0 1px rgba(245,158,11,0.1);
          animation: floatUp 0.6s ease forwards;
        }

        @media (max-width: 680px) {
          .login-card {
            grid-template-columns: 1fr;
          }
          .login-brand-panel {
            display: none !important;
          }
        }

        .login-brand-panel {
          background: linear-gradient(145deg, #0f0f13 0%, #111115 60%, #16141a 100%);
          padding: 52px 44px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          border-right: 1px solid rgba(245,158,11,0.12);
          position: relative;
          overflow: hidden;
        }

        .login-brand-panel::before {
          content: '';
          position: absolute;
          bottom: -80px;
          left: -80px;
          width: 300px;
          height: 300px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(245,158,11,0.08) 0%, transparent 70%);
          pointer-events: none;
        }

        .login-form-panel {
          background: #111113;
          padding: 52px 44px;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .crm-input:focus {
          border-color: rgba(245,158,11,0.6) !important;
          box-shadow: 0 0 0 3px rgba(245,158,11,0.1) !important;
        }

        .crm-submit-btn {
          width: 100%;
          padding: 14px;
          border-radius: 10px;
          border: none;
          background: #f59e0b;
          color: #000;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: all 0.2s;
          font-family: inherit;
          letter-spacing: 0.2px;
        }
        .crm-submit-btn:hover:not(:disabled) {
          background: #fbbf24;
          transform: translateY(-1px);
          box-shadow: 0 8px 24px rgba(245,158,11,0.3);
        }
        .crm-submit-btn:active:not(:disabled) {
          transform: translateY(0);
        }
        .crm-submit-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .feature-pill {
          display: flex;
          align-items: center;
          gap: 10px;
          color: rgba(250,250,250,0.65);
          font-size: 13px;
          font-weight: 500;
        }
        .feature-pill-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #f59e0b;
          flex-shrink: 0;
        }
      `}</style>

      <div className="crm-login-root">
        <div className="login-card">

          {/* ── Left: Branding Panel ── */}
          <div className="login-brand-panel">
            {/* Logo */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 40 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 12,
                  background: 'rgba(245,158,11,0.15)',
                  border: '1px solid rgba(245,158,11,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Building2 size={24} color="#f59e0b" />
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 18, color: P.text, letterSpacing: -0.5 }}>
                    Walk The plan
                  </div>
                  <div style={{ fontSize: 11, color: P.muted, fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase' }}>
                    CRM Platform
                  </div>
                </div>
              </div>

              <h2 style={{
                fontSize: 28, fontWeight: 900, color: P.text,
                letterSpacing: -1, lineHeight: 1.25, marginBottom: 16,
              }}>
                Your leads,<br />
                <span style={{ color: P.gold }}>your pipeline.</span><br />
                Your growth.
              </h2>
              <p style={{ fontSize: 14, color: P.muted, lineHeight: 1.7, maxWidth: 280 }}>
                Manage leads, track conversions, record calls, and scale your team — all from one unified platform.
              </p>
            </div>

            {/* Feature list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                'Lead pipeline & status tracking',
                'Call studio with WebRTC recording',
                'Audio notes per lead',
                'Role-based team access',
                'Bulk CSV import & export',
              ].map((f) => (
                <div key={f} className="feature-pill">
                  <span className="feature-pill-dot" />
                  {f}
                </div>
              ))}

              {/* Decorative badge */}
              <div style={{
                marginTop: 8,
                display: 'inline-flex', alignItems: 'center', gap: 7,
                background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)',
                borderRadius: 20, padding: '6px 14px', width: 'fit-content',
              }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: P.green, display: 'inline-block', animation: 'pulse 2s ease infinite' }} />
                <span style={{ fontSize: 12, color: P.green, fontWeight: 600 }}>System Operational</span>
              </div>
            </div>
          </div>

          {/* ── Right: Login Form Panel ── */}
          <div className="login-form-panel">
            <div style={{ maxWidth: 360, width: '100%', margin: '0 auto' }}>
              {/* Header */}
              <div style={{ marginBottom: 24 }}>
                <h1 style={{ fontSize: 24, fontWeight: 800, color: P.text, letterSpacing: -0.5, marginBottom: 8 }}>
                  Sign in to CRM
                </h1>
                <p style={{ fontSize: 13, color: P.muted }}>
                  Enter your credentials to access the live dashboard.
                </p>
              </div>

              {/* Error */}
              {error && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                  borderRadius: 10, padding: '12px 14px', marginBottom: 20,
                  color: P.red, fontSize: 13,
                }}>
                  <AlertCircle size={15} style={{ flexShrink: 0 }} />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                {/* Email */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  <label style={{ fontSize: 12, color: P.muted, fontWeight: 600, letterSpacing: 0.5 }}>
                    EMAIL ADDRESS
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Mail size={15} color={P.muted} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                    <input
                      className="crm-input"
                      type="email"
                      required
                      autoComplete="email"
                      placeholder="you@company.com"
                      value={form.email}
                      onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                      style={inputBase}
                    />
                  </div>
                </div>

                {/* Password */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  <label style={{ fontSize: 12, color: P.muted, fontWeight: 600, letterSpacing: 0.5 }}>
                    PASSWORD
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Lock size={15} color={P.muted} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                    <input
                      className="crm-input"
                      type={showPw ? 'text' : 'password'}
                      required
                      autoComplete="current-password"
                      placeholder="••••••••"
                      value={form.password}
                      onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                      style={{ ...inputBase, paddingRight: 44 }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(v => !v)}
                      style={{
                        position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                        background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                        color: P.muted, display: 'flex', alignItems: 'center',
                      }}
                    >
                      {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  className="crm-submit-btn"
                  style={{ marginTop: 6 }}
                >
                  {loading
                    ? <><Loader size={16} style={{ animation: 'spin 0.8s linear infinite' }} /> Signing in…</>
                    : 'Sign In to Dashboard'
                  }
                </button>
              </form>

              {/* Restricted note */}
              <div style={{
                marginTop: 28, display: 'flex', alignItems: 'center', gap: 8,
                padding: '11px 14px',
                background: 'rgba(39,39,42,0.6)', border: '1px solid rgba(63,63,70,0.5)',
                borderRadius: 10,
              }}>
                <Lock size={13} color={P.muted} style={{ flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: P.muted, lineHeight: 1.5 }}>
                  Access restricted to registered team members only.
                </span>
              </div>

              {/* Footer */}
              <div style={{ marginTop: 32, textAlign: 'center' }}>
                <span style={{ fontSize: 12, color: '#3f3f46' }}>
                  Walk The plan · CRM v2.0
                </span>
                <div style={{ marginTop: 14 }}>
                  <a
                    href={import.meta.env.VITE_MAIN_SITE_URL || (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? 'http://localhost:5173' : '/')}
                    style={{ fontSize: 12, color: P.gold, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, transition: 'opacity 0.2s' }}
                    onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
                    onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                  >
                    ← Back to Walk The Plan Website
                  </a>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
