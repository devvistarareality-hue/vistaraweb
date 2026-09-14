'use client';
import { useSelector } from 'react-redux';

// Which company a document is being issued by.
//
// The ERP is company-wise: Vistara Group is one tenant of several, so the seller on
// an LOI is whichever company the work belongs to — the viewer's own, or the one an
// admin has selected in "Viewing Company". Anything that prints a company name or
// logo should ask here rather than carry a constant.
export function useCurrentCompany() {
  const me = useSelector((s) => s.auth?.user);
  const companyId = useSelector((s) => s.adminFilter?.companyId);
  const companies = useSelector((s) => s.companies?.companies || []);
  const picked = companyId ? companies.find((c) => c.id === companyId) : null;
  return {
    name: picked?.name || me?.company_name || '',
    // Empty until a company has a logo on file; the caller decides what to do then.
    logoUrl: picked?.logo_url || me?.company_logo_url || '',
  };
}
