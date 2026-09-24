'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
import {
  TrendingUp, Users, Wallet, ReceiptIndianRupee, ListChecks, ShoppingCart, MapPin, Coins, Handshake,
  ArrowUpRight, CalendarDays, LayoutGrid, Package,
} from 'lucide-react';
import { canAccessChannelPartner } from '../../lib/moduleAccess';

// Each module's card: where it goes, what it's for, its icon and accent tone.
const MODULE_CONFIG = {
  'Sales':              { title: 'Sales',               href: '/sales',                  desc: 'Leads, follow-ups, site visits and bookings', Icon: TrendingUp,         tone: 'peach' },
  'HR':                 { title: 'HR',                  href: '/m/hr',                   desc: 'People, attendance and team structure',       Icon: Users,              tone: 'blue' },
  'Accounts & Finance': { title: 'Accounts & Finance',  href: '/m/accounts',             desc: 'Booking approvals and the bookings ledger',   Icon: Wallet,             tone: 'green' },
  'AR':                 { title: 'Accounts Receivable', href: '/m/ar/dashboard',         desc: 'Collections, dues, ageing and interest',      Icon: ReceiptIndianRupee, tone: 'blue' },
  'Task Allocation':    { title: 'Task Allocation',     href: '/m/execution/dashboard',  desc: 'Assign, track and close out tasks across every team', Icon: ListChecks,   tone: 'green' },
  'Purchase':           { title: 'Purchase',            href: '/m/purchase',             desc: 'Vendors and purchase orders',                 Icon: ShoppingCart,       tone: 'peach' },
  'Land':               { title: 'Land',                href: '/m/land',                 desc: 'Land parcels and site portfolio',             Icon: MapPin,             tone: 'blue' },
  'Club 1000':          { title: 'Club 1000',           href: '/club1000',               desc: 'Investors, schemes and payouts',              Icon: Coins,              tone: 'green' },
  'Channel Partner':    { title: 'Channel Partners',    href: '/sales/channel-partners', desc: 'Referral partners and their leads',           Icon: Handshake,          tone: 'peach' },
};

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export default function DashboardPage() {
  const user = useSelector((s) => s.auth.user);
  const router = useRouter();
  const [hello, setHello] = useState('Welcome back');
  const [today, setToday] = useState('');

  const baseModules = (user?.modules || []).filter((m) => MODULE_CONFIG[m] && m !== 'Channel Partner');
  // A standalone tile only for someone who'd otherwise have no way in — anyone
  // with the Sales module (or a true admin) already sees Channel Partner nested
  // under Sales, so adding it here too would just duplicate that entry point.
  // Mirrors sales/layout.js's isCpMgr exclusions (!isTrueAdmin && !isSalesModuleAdmin).
  const isTrueAdmin = !!(user?.is_staff || user?.role === 'Admin');
  const showCpTile = !isTrueAdmin && !baseModules.includes('Sales') && canAccessChannelPartner(user);
  const userModules = showCpTile ? [...baseModules, 'Channel Partner'] : baseModules;

  useEffect(() => {
    if (user?.role === 'Kiosk') { router.replace('/kiosk'); return; }
    if (userModules.length === 1) router.replace(MODULE_CONFIG[userModules[0]].href);
  }, [userModules.length, user?.role]);

  // Time-of-day greeting and date are set after mount so server and client HTML match.
  useEffect(() => {
    setHello(greeting());
    setToday(new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
  }, []);

  if (userModules.length === 1) return null;
  const firstName = String(user?.name || '').split(' ')[0];

  return (
    <div className="ep">
      <section className="ep-hero">
        <div className="ep-hero-main">
          <div className="ep-hello">{hello},</div>
          <h1 className="ep-name">{user?.name || firstName}</h1>
          <div className="ep-meta">
            {today && <span><CalendarDays size={14} /> {today}</span>}
            {user?.role && <span className="ep-role">{user.role}</span>}
          </div>
        </div>
        <div className="ep-hero-stat">
          <span className="ep-hero-stat-icon"><LayoutGrid size={18} /></span>
          <b>{userModules.length}</b>
          <span>module{userModules.length === 1 ? '' : 's'} assigned</span>
        </div>
      </section>

      <div className="ep-section">
        <h2>Your modules</h2>
        <span>Pick where you want to work</span>
      </div>

      {userModules.length === 0 ? (
        <div className="nx-card ep-empty">
          <span className="ep-empty-icon"><Package size={30} /></span>
          <b>No modules assigned yet</b>
          <p>Ask your administrator to give you access to a module.</p>
        </div>
      ) : (
        <div className="ep-grid">
          {userModules.map((name, i) => {
            const m = MODULE_CONFIG[name];
            return (
              <Link key={name} href={m.href} className={`nx-card ep-card tone-${m.tone}`} style={{ animationDelay: `${i * 50}ms` }}>{/* inline-ok: staggered entrance */}
                <div className="ep-card-top">
                  <span className="ep-icon"><m.Icon size={24} strokeWidth={1.8} /></span>
                  <span className="ep-go"><ArrowUpRight size={18} /></span>
                </div>
                <div className="ep-card-title">{m.title}</div>
                <div className="ep-card-desc">{m.desc}</div>
                <div className="ep-card-open">Open module</div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
