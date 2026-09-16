'use client';
import { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useRouter } from 'next/navigation';
import { logout } from '../../redux/actions/authActions';
import Loader from '../../components/Loader';
import ThemeToggle from '../../components/ThemeToggle';

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
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent' }}>
        <Loader />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const handleLogout = () => {
    dispatch(logout());
    router.replace('/company');
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'transparent' }}>
      {/* Top Navbar */}
      <nav style={s.navbar}>
        <div style={s.navLeft}>
          <div style={s.logoMark}>V</div>
          <div>
            <p style={s.logoName}>Nexora</p>
            <p style={s.logoSub}>Employee Portal</p>
          </div>
        </div>
        <div style={s.navRight}>
          <ThemeToggle compact />
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
    backgroundColor: 'var(--glass)',
    backdropFilter:  'blur(16px)',
    margin:          '16px 16px 0',
    borderRadius:    24,
    padding:         '0 24px',
    height:          68,
    display:         'flex',
    alignItems:      'center',
    justifyContent:  'space-between',
    boxShadow:       '0 1px 2px rgba(var(--ink-rgb),0.04), 0 8px 24px rgba(60,90,130,0.08)',
    position:        'sticky',
    top:             16,
    zIndex:          100,
  },
  navLeft: { display: 'flex', alignItems: 'center', gap: 12 },
  logoMark: {
    width: 36, height: 36, borderRadius: 14,
    backgroundColor: 'var(--blue)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 18, fontWeight: 800, color: 'var(--text)', flexShrink: 0,
  },
  logoName: { fontSize: 14, fontWeight: 800, color: 'var(--text)', margin: 0 },
  logoSub:  { fontSize: 11, color: 'var(--muted)', margin: '2px 0 0' },
  navRight: { display: 'flex', alignItems: 'center', gap: 20 },
  userInfo: { display: 'flex', alignItems: 'center', gap: 10 },
  avatar: {
    width: 34, height: 34, borderRadius: 14,
    backgroundColor: 'var(--success-soft)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 15, fontWeight: 800, color: 'var(--success)',
  },
  userName: { fontSize: 13, fontWeight: 700, color: 'var(--text)', margin: 0 },
  userRole: { fontSize: 11, color: 'var(--muted)', margin: '2px 0 0' },
  logoutBtn: {
    padding:         '8px 16px',
    backgroundColor: 'rgba(217,67,75,0.12)',
    border:          '1px solid rgba(217,67,75,0.25)',
    borderRadius:    999,
    color:           'var(--danger)',
    fontSize:        13,
    fontWeight:      600,
    cursor:          'pointer',
  },
};
