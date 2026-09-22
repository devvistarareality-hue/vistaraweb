// Investor status rows for the Club 1000 dashboards' "Portfolio status" bars
// (components/Dash.js DashBars). Order and tone are fixed so manager and employee
// views read the same way.
export const STATUS_ROWS = [
  { key: 'active', label: 'Active', tone: 'good' },
  { key: 'due_for_renewal', label: 'Due for renewal', tone: 'warn' },
  { key: 'redeemed', label: 'Redeemed', tone: 'info' },
  { key: 'premature_redeemed', label: 'Premature redeemed', tone: 'bad' },
];
