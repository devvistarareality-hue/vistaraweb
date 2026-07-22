'use client';
import { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
import { clearCompany } from '../../redux/actions/authActions';
import { moduleAccess } from '../../lib/moduleAccess';
import { AUTH_ENDPOINTS } from '../../constants/api';
import { LOGIN_SUCCESS } from '../../redux/types/authTypes';

const ORANGE = '#FF6B2B';
const NAVY   = '#0C1E3C';

const CSS = `
  @keyframes spin      { to { transform: rotate(360deg); } }
  @keyframes fadeIn    { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
  @keyframes pulseDot  { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
  @keyframes floatRing { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-10px); } }
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; }
  input::placeholder { color:#A0AABB; font-weight:400; }
  .field-input:focus { outline:none; }
  .field-wrap:focus-within { border-color:${NAVY} !important; box-shadow:0 0 0 4px rgba(12,30,60,0.08) !important; }
  .signin-btn { transition:transform 0.18s,box-shadow 0.18s; }
  .signin-btn:hover:not(:disabled) { transform:translateY(-2px); box-shadow:0 10px 28px rgba(12,30,60,0.28) !important; }
  .change-ws:hover { background:#F0F2F8 !important; color:${NAVY} !important; }
  .change-ws { transition:all 0.15s; }
  .resend-link:hover { opacity:0.75; }
  @media (max-width:860px) { .left-panel{display:none!important;} .right-panel{width:100%!important;} }
`;

export default function LoginScreen() {
  const [userCode, setUserCode] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  // OTP step
  const [otpStep, setOtpStep]       = useState(false);
  const [otpToken, setOtpToken]     = useState('');
  const [otpEmail, setOtpEmail]     = useState('');
  const [otp, setOtp]               = useState('');
  const [resendSecs, setResendSecs] = useState(30);

  const dispatch = useDispatch();
  const router   = useRouter();
  const { user, company } = useSelector((s) => s.auth);

  useEffect(() => {
    if (user) router.replace(user.role === 'Kiosk' ? '/kiosk' : ((user.role === 'Admin' || user.is_staff) ? moduleAccess(user).home : '/dashboard'));
  }, [user]);

  useEffect(() => {
    if (!company) router.replace('/company');
  }, [company]);

  // Countdown timer
  const timerRef = useRef(null);
  useEffect(() => {
    if (!otpStep) return;
    timerRef.current = setInterval(() => {
      setResendSecs((s) => {
        if (s <= 1) { clearInterval(timerRef.current); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [otpStep, otpToken]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!company || !userCode.trim() || !password) return;
    setLoading(true);
    setError('');
    try {
      const res  = await fetch(AUTH_ENDPOINTS.login, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ company_code: company.code, user_code: userCode.trim(), password, platform: 'web' }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.otp_required) {
          setOtpToken(data.otp_token);
          setOtpEmail(data.email || '');
          setOtpStep(true);
          setResendSecs(30);
        } else {
          localStorage.setItem('access_token',  data.tokens.access);
          localStorage.setItem('refresh_token', data.tokens.refresh);
          localStorage.setItem('user',          JSON.stringify(data.user));
          dispatch({ type: LOGIN_SUCCESS, payload: data.user });
        }
      } else {
        setError(data.detail || 'Invalid credentials.');
      }
    } catch {
      setError('Network error. Check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (otp.length !== 6) { setError('Enter the 6-digit OTP.'); return; }
    setLoading(true);
    setError('');
    try {
      const res  = await fetch(AUTH_ENDPOINTS.otpVerify, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ otp_token: otpToken, code: otp, platform: 'web' }),
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('access_token',  data.tokens.access);
        localStorage.setItem('refresh_token', data.tokens.refresh);
        localStorage.setItem('user',          JSON.stringify(data.user));
        dispatch({ type: LOGIN_SUCCESS, payload: data.user });
      } else {
        setError(data.detail || 'Invalid OTP.');
      }
    } catch {
      setError('Network error. Check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setLoading(true);
    setError('');
    try {
      const res  = await fetch(AUTH_ENDPOINTS.otpResend, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ otp_token: otpToken }),
      });
      const data = await res.json();
      if (res.ok) {
        setOtpToken(data.otp_token);
        setOtp('');
        setResendSecs(30);
      } else {
        setError(data.detail || 'Could not resend OTP.');
      }
    } catch {
      setError('Network error. Check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleBackToLogin = () => {
    setOtpStep(false);
    setOtpToken('');
    setOtpPhone('');
    setOtpEmail('');
    setOtp('');
    setError('');
  };

  const handleChangeWorkspace = () => {
    dispatch(clearCompany());
    router.push('/company');
  };

  const canSubmit = otpStep
    ? otp.length === 6 && !loading
    : userCode.trim().length > 0 && password.length > 0 && !loading;

  const stepNum = otpStep ? 3 : 2;

  return (
    <div style={s.page}>
      <style suppressHydrationWarning>{CSS}</style>

      {/* ═══ LEFT ═══ */}
      <div className="left-panel" style={s.left}>
        <div style={s.dotBg} />
        <div style={{ ...s.glow, top:'8%',  left:'55%', width:340, height:340, background:'radial-gradient(circle,rgba(255,107,43,0.13) 0%,transparent 70%)' }} />
        <div style={{ ...s.glow, bottom:'8%', left:'-8%', width:260, height:260, background:'radial-gradient(circle,rgba(61,90,254,0.09) 0%,transparent 70%)' }} />

        <div style={s.leftInner}>
          <div style={s.ringsWrap}>
            <div style={s.ring3}>
              <div style={s.ring2}>
                <div style={s.ring1}>
                  <div style={s.logoBox}>
                    <img src="/image-WBG.png" alt="Vistara Group" style={s.logoImg} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div style={s.taglineBlock}>
            <div style={s.pill}>ERP PLATFORM</div>
            <h1 style={s.tagline}>
              Manage your entire<br />
              <span style={{ color: ORANGE }}>real estate business</span><br />
              from one place.
            </h1>
            <p style={s.taglineSub}>Unified workspace · Role-based access · Enterprise security</p>
          </div>

          {company && (
            <div style={s.workspaceCard}>
              <div style={s.wsLeft}>
                <div style={s.wsIcon}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                </div>
                <div>
                  <p style={s.wsCode}>{company.code}</p>
                  <p style={s.wsName}>{company.name}</p>
                </div>
              </div>
              <div style={s.wsStatus}>
                <div style={s.wsDot} />
                <span style={s.wsStatusText}>Active</span>
              </div>
            </div>
          )}
        </div>

        <div style={s.leftFooter}>
          <div style={s.footerDot} />
          <span style={s.footerText}>Trusted by real estate teams across India</span>
        </div>
      </div>

      {/* ═══ RIGHT ═══ */}
      <div className="right-panel" style={s.right}>
        <div style={s.formCard}>

          <div style={s.mobileTop}>
            <img src="/image-WBG.png" alt="Vistara" style={s.mobileLogo} />
          </div>

          {/* Step bar */}
          <div style={s.steps}>
            <div style={{ display:'flex', alignItems:'center', gap:8, opacity:0.55 }}>
              <div style={{ ...s.stepNum, backgroundColor:'#22C55E', color:'#fff' }}>✓</div>
              <span style={{ fontSize:13, fontWeight:600, color:NAVY }}>Workspace</span>
            </div>
            <div style={s.stepLine} />
            <div style={{ display:'flex', alignItems:'center', gap:8, opacity: otpStep ? 0.55 : 1 }}>
              <div style={{ ...s.stepNum, backgroundColor: otpStep ? '#22C55E' : NAVY, color:'#fff' }}>{otpStep ? '✓' : '2'}</div>
              <span style={{ fontSize:13, fontWeight: otpStep ? 600 : 700, color:NAVY }}>Sign In</span>
            </div>
            {otpStep && (
              <>
                <div style={s.stepLine} />
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <div style={{ ...s.stepNum, backgroundColor:NAVY, color:'#fff' }}>3</div>
                  <span style={{ fontSize:13, fontWeight:700, color:NAVY }}>Verify OTP</span>
                </div>
              </>
            )}
          </div>

          {company && (
            <div style={s.companyChip}>
              <div style={s.chipDot} />
              <span style={s.chipText}>{company.code} — {company.name}</span>
            </div>
          )}

          {otpStep ? (
            /* ── OTP Step ── */
            <form onSubmit={handleVerifyOtp}>
              <h2 style={s.formTitle}>Verify OTP</h2>
              <p style={s.formDesc}>
                Code sent to{otpEmail && <> <strong>{otpEmail}</strong></>}. Enter the 6-digit OTP below.
              </p>

              <label style={s.label}>ENTER OTP</label>
              <div className="field-wrap" style={{ ...s.inputBox, justifyContent:'center' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9AABC2" strokeWidth="1.8" strokeLinecap="round">
                  <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
                </svg>
                <input
                  className="field-input"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => { setOtp(e.target.value.replace(/[^0-9]/g, '').slice(0, 6)); setError(''); }}
                  placeholder="- - - - - -"
                  style={{ ...s.input, letterSpacing:12, fontSize:22, fontWeight:800, textAlign:'center' }}
                  autoFocus
                  disabled={loading}
                />
              </div>

              {error && (
                <div style={s.errorBox}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  &nbsp;{error}
                </div>
              )}

              <button type="submit" disabled={!canSubmit} className="signin-btn"
                style={{ ...s.btn, background: canSubmit ? `linear-gradient(135deg,${NAVY} 0%,#051229 100%)` : '#D1D8E4', cursor: canSubmit ? 'pointer' : 'not-allowed', marginTop:22 }}
              >
                {loading
                  ? <span style={s.spinner} />
                  : <>Verify OTP <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" style={{ marginLeft:8 }}><polyline points="20 6 9 17 4 12"/></svg></>
                }
              </button>

              <div style={{ textAlign:'center', marginTop:18 }}>
                {resendSecs > 0 ? (
                  <span style={{ fontSize:13, color:'#7A8599' }}>Resend OTP in {resendSecs}s</span>
                ) : (
                  <button type="button" onClick={handleResendOtp} disabled={loading} className="resend-link"
                    style={{ fontSize:13, fontWeight:700, color:NAVY, background:'none', border:'none', cursor:'pointer', textDecoration:'underline' }}
                  >
                    Resend OTP
                  </button>
                )}
              </div>

              <div style={s.divider} />

              <button type="button" onClick={handleBackToLogin} className="change-ws" style={s.changeWsBtn}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight:6 }}>
                  <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
                </svg>
                Back to login
              </button>
            </form>
          ) : (
            /* ── Credentials Step ── */
            <form onSubmit={handleSubmit}>
              <h2 style={s.formTitle}>Welcome back</h2>
              <p style={s.formDesc}>Sign in with your employee credentials to continue.</p>

              <label style={s.label}>USER ID</label>
              <div className="field-wrap" style={s.inputBox}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9AABC2" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
                </svg>
                <input className="field-input" type="text" value={userCode}
                  onChange={(e) => { setUserCode(e.target.value.toUpperCase()); setError(''); }}
                  placeholder="Enter your user ID" style={s.input} autoFocus disabled={loading}
                />
              </div>

              <label style={{ ...s.label, marginTop:20 }}>PASSWORD</label>
              <div className="field-wrap" style={s.inputBox}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9AABC2" strokeWidth="1.8" strokeLinecap="round">
                  <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
                </svg>
                <input className="field-input" type={showPass ? 'text' : 'password'} value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(''); }}
                  placeholder="Enter your password" style={{ ...s.input, flex:1 }} disabled={loading}
                />
                <button type="button" onClick={() => setShowPass((v) => !v)} style={s.eyeBtn}>
                  {showPass
                    ? <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#9AABC2" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    : <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#9AABC2" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  }
                </button>
              </div>

              {error && (
                <div style={s.errorBox}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  &nbsp;{error}
                </div>
              )}

              <button type="submit" disabled={!canSubmit} className="signin-btn"
                style={{ ...s.btn, background: canSubmit ? `linear-gradient(135deg,${NAVY} 0%,#051229 100%)` : '#D1D8E4', cursor: canSubmit ? 'pointer' : 'not-allowed' }}
              >
                {loading
                  ? <span style={s.spinner} />
                  : <>Sign In <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" style={{ marginLeft:8 }}><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></>
                }
              </button>

              <div style={s.divider} />

              <button onClick={handleChangeWorkspace} className="change-ws" style={s.changeWsBtn}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight:6 }}>
                  <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
                </svg>
                Change workspace
              </button>
            </form>
          )}

          <div style={s.secureRow}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#B0BAC9" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            <span>256-bit encrypted &amp; secured connection</span>
          </div>
        </div>
      </div>
    </div>
  );
}

const s = {
  page: { display:'flex', minHeight:'100vh', overflow:'hidden' },

  left: {
    width:'52%', background:'linear-gradient(145deg,#050D1A 0%,#0B1D3A 50%,#0F2348 100%)',
    display:'flex', flexDirection:'column', position:'relative', overflow:'hidden',
  },
  dotBg: {
    position:'absolute', inset:0,
    backgroundImage:'radial-gradient(circle,rgba(255,255,255,0.032) 1px,transparent 1px)',
    backgroundSize:'28px 28px', pointerEvents:'none',
  },
  glow: { position:'absolute', borderRadius:'50%', pointerEvents:'none' },

  leftInner: {
    flex:1, display:'flex', flexDirection:'column', justifyContent:'center',
    padding:'56px 52px', position:'relative', zIndex:1,
  },

  ringsWrap: { marginBottom:40, display:'flex', justifyContent:'center', animation:'floatRing 4s ease-in-out infinite' },
  ring3: {
    width:180, height:180, borderRadius:'50%',
    border:'1.5px solid rgba(255,107,43,0.15)',
    backgroundColor:'rgba(255,255,255,0.02)',
    display:'flex', alignItems:'center', justifyContent:'center',
  },
  ring2: {
    width:146, height:146, borderRadius:'50%',
    border:'1.5px solid rgba(255,107,43,0.3)',
    backgroundColor:'rgba(255,255,255,0.04)',
    display:'flex', alignItems:'center', justifyContent:'center',
  },
  ring1: {
    width:114, height:114, borderRadius:'50%',
    border:'2px solid rgba(255,107,43,0.6)',
    backgroundColor:'rgba(255,255,255,0.07)',
    display:'flex', alignItems:'center', justifyContent:'center',
    boxShadow:'0 0 24px rgba(255,107,43,0.15)',
  },
  logoBox: {
    width:90, height:90, borderRadius:'50%',
    backgroundColor:'#FFFFFF',
    display:'flex', alignItems:'center', justifyContent:'center',
    boxShadow:'0 4px 20px rgba(255,107,43,0.4)',
    overflow:'hidden', padding:8,
  },
  logoImg: { width:'100%', height:'100%', objectFit:'contain' },

  taglineBlock: { marginBottom:32 },
  pill: {
    display:'inline-block', backgroundColor:'rgba(255,107,43,0.15)',
    border:'1px solid rgba(255,107,43,0.3)', borderRadius:20,
    padding:'4px 14px', fontSize:11, fontWeight:700, color:ORANGE,
    letterSpacing:2, marginBottom:16,
  },
  tagline:    { fontSize:32, fontWeight:800, color:'#fff', lineHeight:1.28, marginBottom:12 },
  taglineSub: { fontSize:13, color:'rgba(255,255,255,0.38)', letterSpacing:0.4 },

  workspaceCard: {
    display:'flex', alignItems:'center', justifyContent:'space-between',
    backgroundColor:'rgba(255,255,255,0.05)',
    border:'1px solid rgba(255,255,255,0.1)',
    borderRadius:14, padding:'14px 18px',
  },
  wsLeft:      { display:'flex', alignItems:'center', gap:12 },
  wsIcon: {
    width:36, height:36, borderRadius:10,
    backgroundColor:'rgba(255,107,43,0.2)',
    display:'flex', alignItems:'center', justifyContent:'center',
  },
  wsCode:       { fontSize:13, fontWeight:800, color:'#fff', marginBottom:2 },
  wsName:       { fontSize:11, color:'rgba(255,255,255,0.45)' },
  wsStatus:     { display:'flex', alignItems:'center', gap:6 },
  wsDot:        { width:7, height:7, borderRadius:'50%', backgroundColor:'#22C55E', animation:'pulseDot 2s infinite' },
  wsStatusText: { fontSize:12, fontWeight:600, color:'#22C55E' },

  leftFooter: {
    padding:'18px 52px', borderTop:'1px solid rgba(255,255,255,0.05)',
    display:'flex', alignItems:'center', gap:8, position:'relative', zIndex:1,
  },
  footerDot:  { width:6, height:6, borderRadius:'50%', backgroundColor:ORANGE, animation:'pulseDot 2s infinite' },
  footerText: { fontSize:12, color:'rgba(255,255,255,0.3)' },

  right: {
    width:'48%', backgroundColor:'#F0F2F8',
    display:'flex', alignItems:'center', justifyContent:'center', padding:'40px 32px',
  },
  formCard: {
    width:'100%', maxWidth:420,
    backgroundColor:'#FFFFFF', borderRadius:24,
    padding:'44px 40px', boxShadow:'0 4px 40px rgba(0,0,0,0.09)',
    animation:'fadeIn 0.4s ease',
  },

  mobileTop:  { display:'none', justifyContent:'center', marginBottom:32 },
  mobileLogo: { height:48, objectFit:'contain' },

  steps:   { display:'flex', alignItems:'center', gap:10, marginBottom:28 },
  stepNum: {
    width:26, height:26, borderRadius:'50%',
    display:'flex', alignItems:'center', justifyContent:'center',
    fontSize:12, fontWeight:700, flexShrink:0,
  },
  stepLine: { flex:1, height:1.5, backgroundColor:'#E4E9F2' },

  companyChip: {
    display:'inline-flex', alignItems:'center', gap:7,
    backgroundColor:'#EEF4FF', border:'1px solid #C7D7FB',
    borderRadius:20, padding:'5px 14px', marginBottom:20,
  },
  chipDot:  { width:7, height:7, borderRadius:'50%', backgroundColor:'#3D5AFE', flexShrink:0 },
  chipText: { fontSize:12, fontWeight:700, color:'#3D5AFE' },

  formTitle: { fontSize:26, fontWeight:800, color:NAVY, marginBottom:8 },
  formDesc:  { fontSize:14, color:'#7A8599', lineHeight:1.65, marginBottom:28 },

  label: {
    display:'block', fontSize:10, fontWeight:700, color:'#8492A6',
    letterSpacing:1.4, textTransform:'uppercase', marginBottom:10,
  },
  inputBox: {
    display:'flex', alignItems:'center', gap:12,
    border:'1.5px solid #E4E9F2', borderRadius:12,
    padding:'0 16px', height:52, backgroundColor:'#FAFBFD', transition:'all 0.2s',
  },
  input: {
    flex:1, fontSize:15, fontWeight:600, color:NAVY,
    border:'none', outline:'none', background:'transparent',
  },
  eyeBtn: { background:'none', border:'none', cursor:'pointer', padding:4, display:'flex', alignItems:'center' },
  errorBox: {
    display:'flex', alignItems:'center', gap:8,
    backgroundColor:'#FEF2F2', border:'1px solid #FECACA',
    borderRadius:10, padding:'10px 14px',
    fontSize:13, color:'#DC2626', marginTop:12,
  },
  btn: {
    display:'flex', alignItems:'center', justifyContent:'center',
    width:'100%', height:52, border:'none', borderRadius:12,
    fontSize:15, fontWeight:700, color:'#fff', marginTop:22,
  },
  spinner: {
    width:20, height:20, borderRadius:'50%',
    border:'3px solid rgba(255,255,255,0.3)', borderTopColor:'#fff',
    animation:'spin 0.75s linear infinite', display:'inline-block',
  },
  divider: { height:1, backgroundColor:'#F0F2F7', margin:'22px 0 16px' },
  changeWsBtn: {
    display:'flex', alignItems:'center', justifyContent:'center',
    width:'100%', padding:'12px 0', borderRadius:12,
    border:'1.5px solid #E4E9F2', background:'#FAFBFD',
    fontSize:13, fontWeight:600, color:'#6B7A99', cursor:'pointer',
  },
  secureRow: {
    display:'flex', alignItems:'center', justifyContent:'center',
    gap:6, marginTop:18, fontSize:12, color:'#B0BAC9',
  },
};
