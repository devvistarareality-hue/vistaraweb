'use client';
// Why a booking was rejected (Sales / CP stage) or cancelled — shown on its card the
// same way the Accounts rejection note is. Both are required when the action is taken.
const when = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : ` · ${d.toLocaleDateString('en-GB')}`;
};

export default function BookingReasons({ b }) {
  const cancelled = String(b.approval_status || '').toUpperCase() === 'CANCELLED';
  return (
    <>
      {cancelled && (b.cancelled_reason || b.cancelled_by_name) && (
        <div className="bk-reason cancel">
          <b>Cancelled{b.cancelled_by_name ? ` by ${b.cancelled_by_name}` : ''}{when(b.cancelled_at)}</b>
          <span>{b.cancelled_reason || 'No reason was recorded (cancelled before reasons were required).'}</span>
        </div>
      )}
      {!cancelled && b.status === 'rejected' && b.accounts_status !== 'rejected' && (b.rejected_reason || b.rejected_by_name) && (
        <div className="bk-reason">
          <b>Rejected{b.rejected_by_name ? ` by ${b.rejected_by_name}` : ''}{when(b.rejected_at)}</b>
          <span>{b.rejected_reason || 'No reason was recorded (rejected before reasons were required).'}</span>
        </div>
      )}
    </>
  );
}
