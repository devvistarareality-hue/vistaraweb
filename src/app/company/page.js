'use client';
import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
import { verifyCompany } from '../../redux/actions/authActions';

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
  .code-input:focus { outline:none; }
  .input-wrap:focus-within { border-color:${NAVY} !important; box-shadow:0 0 0 4px rgba(12,30,60,0.08) !important; }
  .submit-btn { transition:transform 0.18s,box-shadow 0.18s; }
  .submit-btn:hover:not(:disabled) { transform:translateY(-2px); box-shadow:0 10px 28px rgba(12,30,60,0.28) !important; }
  @media (max-width:860px) { .left-panel{display:none!important;} .right-panel{width:100%!important;} }
`;

export default function CompanyScreen() {
  const [code, setCode] = useState('');
  const dispatch = useDispatch();
  const router   = useRouter();
  const { companyLoading, company, companyError, user } = useSelector((s) => s.auth);

  useEffect(() => { if (user)    router.replace(user.role === 'Admin' || user.is_staff ? '/admin' : '/dashboard'); }, [user]);
  useEffect(() => { if (company) router.push('/login'); }, [company]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (code.trim()) dispatch(verifyCompany(code.trim()));
  };

  const canSubmit = code.trim().length > 0 && !companyLoading;

  return (
    <div style={s.page}>
      {/* suppressHydrationWarning prevents apostrophe encoding mismatch */}
      <style suppressHydrationWarning>{CSS}</style>

      {/* ═══ LEFT — branding ═══ */}
      <div className="left-panel" style={s.left}>
        <div style={s.dotBg} />
        <div style={{ ...s.glow, top:'8%', left:'55%', width:340, height:340, background:'radial-gradient(circle,rgba(255,107,43,0.13) 0%,transparent 70%)' }} />
        <div style={{ ...s.glow, bottom:'8%', left:'-8%', width:260, height:260, background:'radial-gradient(circle,rgba(61,90,254,0.09) 0%,transparent 70%)' }} />

        <div style={s.leftInner}>

          {/* ── Concentric rings logo (matches app design) ── */}
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

          {/* Tagline */}
          <div style={s.taglineBlock}>
            <div style={s.pill}>ERP PLATFORM</div>
            <h1 style={s.tagline}>
              Manage your entire<br />
              <span style={{ color: ORANGE }}>real estate business</span><br />
              from one place.
            </h1>
            <p style={s.taglineSub}>Unified workspace · Role-based access · Enterprise security</p>
          </div>

          {/* Stats */}
          <div style={s.statsRow}>
            {[['6+','Modules'],['Multi','Companies'],['JWT','Security']].map(([val,label]) => (
              <div key={label} style={s.stat}>
                <span style={s.statVal}>{val}</span>
                <span style={s.statLabel}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={s.leftFooter}>
          <div style={s.footerDot} />
          <span style={s.footerText}>Trusted by real estate teams across India</span>
        </div>
      </div>

      {/* ═══ RIGHT — form ═══ */}
      <div className="right-panel" style={s.right}>
        <div style={s.formCard}>

          {/* Mobile logo */}
          <div style={s.mobileTop}>
            <img src="/image-WBG.png" alt="Vistara" style={s.mobileLogo} />
          </div>

          {/* Step bar */}
          <div style={s.steps}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <div style={{ ...s.stepNum, backgroundColor:NAVY, color:'#fff' }}>1</div>
              <span style={{ fontSize:13, fontWeight:700, color:NAVY }}>Workspace</span>
            </div>
            <div style={s.stepLine} />
            <div style={{ display:'flex', alignItems:'center', gap:8, opacity:0.35 }}>
              <div style={{ ...s.stepNum, backgroundColor:'#C8D0DC', color:'#fff' }}>2</div>
              <span style={{ fontSize:13, fontWeight:600, color:NAVY }}>Sign In</span>
            </div>
          </div>

          <h2 style={s.formTitle}>Find your workspace</h2>
          <p style={s.formDesc}>Enter the company code provided by your administrator to access your ERP workspace.</p>

          <form onSubmit={handleSubmit}>
            <label style={s.label}>COMPANY CODE</label>
            <div className="input-wrap" style={s.inputBox}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9AABC2" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
              <input
                className="code-input"
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g.  VRL01"
                style={s.input}
                autoFocus
                disabled={companyLoading}
              />
            </div>

            {companyError && (
              <div style={s.errorBox}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                {companyError}
              </div>
            )}

            <button
              type="submit"
              disabled={!canSubmit}
              className="submit-btn"
              style={{ ...s.btn, background: canSubmit ? `linear-gradient(135deg,${NAVY} 0%,#051229 100%)` : '#D1D8E4', cursor: canSubmit ? 'pointer' : 'not-allowed' }}
            >
              {companyLoading
                ? <span style={s.spinner} />
                : <>Continue <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" style={{ marginLeft:8 }}><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></>
              }
            </button>
          </form>

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

  /* LEFT */
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

  /* ── Rings ── */
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

  taglineBlock: { marginBottom:36 },
  pill: {
    display:'inline-block', backgroundColor:'rgba(255,107,43,0.15)',
    border:'1px solid rgba(255,107,43,0.3)', borderRadius:20,
    padding:'4px 14px', fontSize:11, fontWeight:700, color:ORANGE,
    letterSpacing:2, marginBottom:16,
  },
  tagline:    { fontSize:34, fontWeight:800, color:'#fff', lineHeight:1.28, marginBottom:12 },
  taglineSub: { fontSize:13, color:'rgba(255,255,255,0.38)', letterSpacing:0.4 },

  statsRow: { display:'flex', gap:0, borderTop:'1px solid rgba(255,255,255,0.06)', paddingTop:28 },
  stat:     { flex:1, paddingRight:20, display:'flex', flexDirection:'column', gap:4, borderRight:'1px solid rgba(255,255,255,0.06)', marginRight:20, lastChild:{border:'none'} },
  statVal:  { fontSize:22, fontWeight:800, color:'#fff' },
  statLabel:{ fontSize:11, color:'rgba(255,255,255,0.35)', fontWeight:500, textTransform:'uppercase', letterSpacing:0.8 },

  leftFooter: {
    padding:'18px 52px', borderTop:'1px solid rgba(255,255,255,0.05)',
    display:'flex', alignItems:'center', gap:8, position:'relative', zIndex:1,
  },
  footerDot:  { width:6, height:6, borderRadius:'50%', backgroundColor:ORANGE, animation:'pulseDot 2s infinite' },
  footerText: { fontSize:12, color:'rgba(255,255,255,0.3)' },

  /* RIGHT */
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

  steps:   { display:'flex', alignItems:'center', gap:10, marginBottom:32 },
  stepNum: {
    width:26, height:26, borderRadius:'50%',
    display:'flex', alignItems:'center', justifyContent:'center',
    fontSize:12, fontWeight:700, flexShrink:0,
  },
  stepLine: { flex:1, height:1.5, backgroundColor:'#E4E9F2' },

  formTitle: { fontSize:26, fontWeight:800, color:NAVY, marginBottom:8 },
  formDesc:  { fontSize:14, color:'#7A8599', lineHeight:1.65, marginBottom:28 },

  label: {
    display:'block', fontSize:10, fontWeight:700, color:'#8492A6',
    letterSpacing:1.4, textTransform:'uppercase', marginBottom:10,
  },
  inputBox: {
    display:'flex', alignItems:'center', gap:12,
    border:'1.5px solid #E4E9F2', borderRadius:12,
    padding:'0 16px', height:52, backgroundColor:'#FAFBFD',
    marginBottom:6, transition:'all 0.2s',
  },
  input: {
    flex:1, fontSize:15, fontWeight:700, color:NAVY,
    letterSpacing:2, border:'none', outline:'none', background:'transparent', textTransform:'uppercase',
  },
  errorBox: {
    display:'flex', alignItems:'center', gap:8,
    backgroundColor:'#FEF2F2', border:'1px solid #FECACA',
    borderRadius:10, padding:'10px 14px',
    fontSize:13, color:'#DC2626', marginTop:10, marginBottom:4,
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
  secureRow: {
    display:'flex', alignItems:'center', justifyContent:'center',
    gap:6, marginTop:22, fontSize:12, color:'#B0BAC9',
  },
};
