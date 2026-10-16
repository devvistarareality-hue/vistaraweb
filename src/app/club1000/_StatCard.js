// Club 1000 money format: ₹ and Indian grouping, no decimals.
export const fmtMoney = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
