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

/** Convert tab names like "26Feb17 U1" (YYMonDD) to "DD Mon YYYY -- suffix". */
export function fmtTabName(tabName: string): string {
  const m = tabName.match(/^(\d{1,2})\s*([A-Za-z]{3,4})(\d{1,2})?\s+(.+)$/);
  if (!m) return tabName;
  const yr = 2000 + parseInt(m[1]);
  const monName = m[2].charAt(0).toUpperCase() + m[2].slice(1).toLowerCase();
  const mon = MONTHS[monName];
  if (!mon) return tabName;
  const day = m[3] ? parseInt(m[3]) : 1;
  const datePart = `${day} ${monName} ${yr}`;
  return `${datePart} \u2014 ${m[4]}`;
}
