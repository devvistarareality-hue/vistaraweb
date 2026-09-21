'use client';
import { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { logout } from '../../redux/actions/authActions';
import Loader from '../../components/Loader';
import ThemeToggle from '../../components/ThemeToggle';
import NexoraLogo from '../../components/NexoraLogo';

// Employee portal shell: people with two or more modules land here to pick one.
export default function DashboardLayout({ children }) {
  const user     = useSelector((s) => s.auth.user);
  const dispatch = useDispatch();
  const router   = useRouter();

  useEffect(() => {
    if (!user) router.replace('/company');
    else if (user.role === 'Admin' || user.is_staff) router.replace('/admin');
  }, [user]);

  if (!user) return <div className="ep-loading"><Loader /></div>;

  const handleLogout = () => {
    dispatch(logout());
    router.replace('/company');
  };

  return (
    <div className="ep-shell">
      <nav className="ep-nav">
        <div className="ep-brand">
          <span className="ep-logo"><NexoraLogo alt="" /></span>
          <div>
            <div className="ep-brand-name">Nexora</div>
            <div className="ep-brand-sub">Employee Portal</div>
          </div>
        </div>
        <div className="ep-nav-right">
          <ThemeToggle compact />
          <div className="ep-user">
            <span className="ep-avatar">{(user?.name || 'U')[0]}</span>
            <div className="ep-user-text">
              <div className="ep-user-name">{user?.name}</div>
              <div className="ep-user-role">{user?.role}</div>
            </div>
          </div>
          <button type="button" className="ep-logout" onClick={handleLogout} aria-label="Sign out"><LogOut size={15} /><span>Sign out</span></button>
        </div>
      </nav>
      <main className="ep-main">{children}</main>
    </div>
  );
}
