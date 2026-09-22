'use client';
import ActivityLogView from '../../../components/ActivityLogView';

// Every change anyone made, in every module — who, where, what and when.
export default function ActivityLogPage() {
  return <ActivityLogView title="Activity Log" sub="Every change made in Nexora — who did it, in which module, and when." />;
}
