'use client';
import ActivityLogView from '../../../components/ActivityLogView';

// Admin-only: every change in Sales (and its Channel Partner bookings).
export default function SalesLogPage() {
  return <ActivityLogView modules={['Sales', 'Channel Partner']} title="Sales Log" sub="Who changed what in Sales, and when." />;
}
