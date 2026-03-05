const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Convert any date string to a human-readable "DD Mon YYYY" format. */
export function fmtDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const day = d.getDate();
  const mon = SHORT_MONTHS[d.getMonth()];
  const year = d.getFullYear();
  return `${day} ${mon} ${year}`;
}

const MONTHS: Record<string, number> = {
  Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
  Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12,
};

/** Convert tab names like "26Feb23 U1" or "24 Apr L2" to "DD Mon YYYY -- suffix". */
export function fmtTabName(tabName: string): string {
  const m = tabName.match(/^(\d{1,2})\s*([A-Za-z]{3})(\d{2})?\s+(.+)$/);
  if (!m) return tabName;
  const day = parseInt(m[1]);
  const monName = m[2].charAt(0).toUpperCase() + m[2].slice(1).toLowerCase();
  const mon = MONTHS[monName];
  if (!mon) return tabName;
  const yr = m[3] ? 2000 + parseInt(m[3]) : new Date().getFullYear();
  const datePart = `${day} ${monName} ${yr}`;
  return `${datePart} \u2014 ${m[4]}`;
}
