'use client';
import { use } from 'react';
import OrgChartView from '../../../../components/OrgChartView';
import { MODULE_META } from '../moduleMeta';

export default function ModuleTeam({ params: paramsPromise }) {
  // Next 15 hands route params over as a Promise — unwrap it once here.
  const params = use(paramsPromise);
  const meta = MODULE_META[params.module] || { name: params.module };
  return <OrgChartView module={meta.name} title={`My Team · ${meta.name}`} />;
}
