'use client';
// Kiosk booking: renders the exact Sales booking/LOI form, but full-screen (outside the
// /sales layout, so no ERP sidebar). Wrapped in the kiosk shell (gradient bg + brand header,
// centered) so it looks cohesive with the rest of the kiosk. The form detects the /kiosk
// path and returns to the kiosk on Back / after submit.
import BookingPageWrapper from '../../sales/booking/page';

export default function KioskBookPage() {
  return (
    <div style={{ minHeight: '100vh', position: 'relative',
      background: 'radial-gradient(1200px 600px at 15% -10%,#F3F9FF 0%,transparent 60%),radial-gradient(1000px 500px at 110% 10%,#E6F2FF 0%,transparent 55%),linear-gradient(160deg,#F3F9FF 0%,#F4F5F7 100%)' }}>
      {/* Brand header (matches the kiosk landing) */}
      <header style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 40px',
        background: 'rgba(255,255,255,0.72)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(29,29,31,0.06)' }}>
        <div style={{ width: 44, height: 44, borderRadius: 13, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 800, fontSize: 20, color: '#fff', background: '#1D1D1F', boxShadow: '0 6px 16px rgba(47,109,181,0.28)' }}>V</div>
        <div>
          <div style={{ fontSize: 19, fontWeight: 800, color: '#1D1D1F', letterSpacing: -0.3 }}>Vistara Realty</div>
          <div style={{ fontSize: 12, color: '#6E7278' }}>Self-Service Booking Kiosk</div>
        </div>
      </header>

      {/* The booking form, centered in a card-like column */}
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '8px 16px 60px' }}>
        <BookingPageWrapper />
      </div>
    </div>
  );
}
