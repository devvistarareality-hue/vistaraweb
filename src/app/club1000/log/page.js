'use client';
import ActivityLogView from '../../../components/ActivityLogView';

// Admin-only: every change in Club 1000.
export default function Club1000LogPage() {
  return <ActivityLogView modules={['Club 1000']} title="Club 1000 Log" sub="Who changed what in Club 1000, and when." />;
}
