'use client';
import { notFound } from 'next/navigation';
import ActivityLogView from '../../../../components/ActivityLogView';
import { MODULE_META } from '../moduleMeta';

// The name each module's changes are logged under (activity/recorder.py MODULES).
const LOG_MODULE = { hr: 'HR', accounts: 'Accounts & Finance', ar: 'AR', execution: 'Task Allocation', purchase: 'Purchase', land: 'Land' };

// Admin-only: every change in this module.
export default function ModuleLogPage({ params }) {
  const meta = MODULE_META[params.module];
  if (!meta || !LOG_MODULE[params.module]) notFound();
  return <ActivityLogView modules={[LOG_MODULE[params.module]]} title={`${meta.name} Log`} sub={`Who changed what in ${meta.name}, and when.`} />;
}
