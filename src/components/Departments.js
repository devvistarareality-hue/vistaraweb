'use client';
import Link from 'next/link';
import {
  TrendingUp, Users, Wallet, ReceiptIndianRupee, ListChecks, ShoppingCart, MapPin, Coins, Handshake,
  ArrowUpRight, ShieldCheck, Building2, Tag, DatabaseBackup, History, Landmark, Receipt, ChevronLeft,
} from 'lucide-react';
import { groupHref } from '../lib/moduleGroups';

const ICONS = {
  trending: TrendingUp, people: Users, users: Users, wallet: Wallet, coins: ReceiptIndianRupee, checklist: ListChecks,
  cart: ShoppingCart, map: MapPin, handshake: Handshake, shield: ShieldCheck, building: Building2, tag: Tag,
  backup: DatabaseBackup, clock: History, bank: Landmark, receipt: Receipt, club: Coins,
};
const Icon = ({ name, size = 24 }) => { const I = ICONS[name] || Wallet; return <I size={size} strokeWidth={1.8} />; };

// Home screen: one tile per department. A department the person has only one part
// of opens that part directly; otherwise it opens the department page.
export function DepartmentGrid({ groups, base }) {
  return (
    <div className="ep-grid">
      {groups.map((g, i) => (
        <Link key={g.key} href={groupHref(g, base)} className={`nx-card ep-card tone-${g.tone}`} style={{ animationDelay: `${i * 50}ms` }}>{/* inline-ok: staggered entrance */}
          <div className="ep-card-top">
            <span className="ep-icon"><Icon name={g.key === 'club1000' ? 'club' : g.icon} /></span>
            <span className="ep-go"><ArrowUpRight size={18} /></span>
          </div>
          <div className="ep-card-title">{g.title}</div>
          <div className="ep-card-desc">{g.desc}</div>
          {g.modules.length > 1 || g.open.length > g.modules.length ? (
            <div className="dep-parts">
              {g.parts.map((p) => <span key={p.key} className={`dep-chip${p.soon ? ' is-soon' : ''}`}>{p.title}{p.soon ? ' · soon' : ''}</span>)}
            </div>
          ) : <div className="ep-card-open">Open {g.modules[0].title === g.title ? 'module' : g.modules[0].title}</div>}
        </Link>
      ))}
    </div>
  );
}

// A department's own page: a card for each part this person can open.
export function DepartmentPage({ group, backHref, backLabel }) {
  if (!group) {
    return <div className="nx-note info">This department isn&apos;t available to you. <Link href={backHref} className="arb-link">{backLabel}</Link></div>;
  }
  return (
    <div className="dep-page">
      <Link href={backHref} className="dep-back"><ChevronLeft size={15} /> {backLabel}</Link>
      <div className={`dep-head tone-${group.tone}`}>
        <span className="ep-icon"><Icon name={group.key === 'club1000' ? 'club' : group.icon} size={26} /></span>
        <div>
          <h1 className="nx-page-title">{group.title}</h1>
          <p className="nx-page-sub">{group.desc}</p>
        </div>
      </div>
      <div className="ep-grid">
        {group.parts.map((p, i) => (p.soon ? (
          <div key={p.key} className={`nx-card ep-card dep-soon tone-${group.tone}`}>
            <div className="ep-card-top"><span className="ep-icon"><Icon name={p.icon} /></span><span className="dep-soon-tag">Coming soon</span></div>
            <div className="ep-card-title">{p.title}</div>
            <div className="ep-card-desc">{p.desc}</div>
          </div>
        ) : (
          <Link key={p.key} href={p.href} className={`nx-card ep-card tone-${group.tone}`} style={{ animationDelay: `${i * 50}ms` }}>{/* inline-ok: staggered entrance */}
            <div className="ep-card-top">
              <span className="ep-icon"><Icon name={p.icon} /></span>
              <span className="ep-go"><ArrowUpRight size={18} /></span>
            </div>
            <div className="ep-card-title">{p.title}</div>
            <div className="ep-card-desc">{p.desc}</div>
            <div className="ep-card-open">Open</div>
          </Link>
        )))}
      </div>
    </div>
  );
}
