'use client';
import { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useRouter } from 'next/navigation';
import { logout } from '../../redux/actions/authActions';

export default function DashboardLayout({ children }) {
  const user     = useSelector((s) => s.auth.user);
  const dispatch = useDispatch();
  const router   = useRouter();

  useEffect(() => {
    if (!user) router.replace('/company');
    else if (user.role === 'Admin' || user.is_staff) router.replace('/admin');
  }, [user]);

  if (!user) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(160deg, #050D1A, #0C1E3C)' }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid rgba(255,107,43,0.3)', borderTopColor: '#FF6B2B', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const handleLogout = () => {
    dispatch(logout());
    router.replace('/company');
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F5F6FA' }}>
      {/* Top Navbar */}
      <nav style={s.navbar}>
        <div style={s.navLeft}>
          <div style={s.logoMark}>V</div>
          <div>
            <p style={s.logoName}>Vistara ERP</p>
            <p style={s.logoSub}>Employee Portal</p>
          </div>
        </div>
        <div style={s.navRight}>
          <div style={s.userInfo}>
            <div style={s.avatar}>{(user?.name || 'U')[0]}</div>
            <div>
              <p style={s.userName}>{user?.name}</p>
              <p style={s.userRole}>{user?.role}</p>
            </div>
          </div>
          <button onClick={handleLogout} style={s.logoutBtn}>Sign Out</button>
        </div>
      </nav>

      <main style={{ padding: '32px 36px' }}>
        {children}
      </main>
    </div>
  );
}

const s = {
  navbar: {
    backgroundColor: '#182350',
    padding:         '0 36px',
    height:          68,
    display:         'flex',
    alignItems:      'center',
    justifyContent:  'space-between',
    boxShadow:       '0 2px 12px rgba(0,0,0,0.18)',
    position:        'sticky',
    top:             0,
    zIndex:          100,
  },
  navLeft: { display: 'flex', alignItems: 'center', gap: 12 },
  logoMark: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#B9915E',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 18, fontWeight: 800, color: '#fff', flexShrink: 0,
  },
  logoName: { fontSize: 14, fontWeight: 800, color: '#fff', margin: 0 },
  logoSub:  { fontSize: 11, color: 'rgba(255,255,255,0.45)', margin: '2px 0 0' },
  navRight: { display: 'flex', alignItems: 'center', gap: 20 },
  userInfo: { display: 'flex', alignItems: 'center', gap: 10 },
  avatar: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: 'rgba(175,210,250,0.18)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 15, fontWeight: 800, color: '#AFD2FA',
  },
  userName: { fontSize: 13, fontWeight: 700, color: '#fff', margin: 0 },
  userRole: { fontSize: 11, color: 'rgba(255,255,255,0.5)', margin: '2px 0 0' },
  logoutBtn: {
    padding:         '8px 16px',
    backgroundColor: 'rgba(239,68,68,0.12)',
    border:          '1px solid rgba(239,68,68,0.25)',
    borderRadius:    8,
    color:           '#ff6b6b',
    fontSize:        13,
    fontWeight:      600,
    cursor:          'pointer',
  },
};
