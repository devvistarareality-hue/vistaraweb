'use client';
import OrgChartView from '../../../../components/OrgChartView';
import { MODULE_META } from '../moduleMeta';

export default function ModuleTeam({ params }) {
  const meta = MODULE_META[params.module] || { name: params.module };
  return <OrgChartView module={meta.name} title={`My Team · ${meta.name}`} />;
}
