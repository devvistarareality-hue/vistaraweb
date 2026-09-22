'use client';
import ActivityLogView from '../../../../components/ActivityLogView';

// Admin-only: every change in the Channel Partner module.
export default function ChannelPartnerLogPage() {
  return <ActivityLogView modules={['Channel Partner']} title="Channel Partner Log" sub="Who changed what in Channel Partner, and when." />;
}
