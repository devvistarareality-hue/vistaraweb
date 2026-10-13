// Where the booking form lives for the screen you are on. The Channel Partner module
// has its own copy (/m/cp/booking) so booking a plot from there keeps the Channel
// Partner menu instead of switching to Sales CRM. Read at click time.
export const inCpModule = () => typeof window !== 'undefined' && /^\/m\/cp(\/|$)/.test(window.location.pathname);
export const bookingPath = () => (inCpModule() ? '/m/cp/booking' : '/sales/booking');
