/** Convert any date string to "YYYY MM DD" format. */
export function fmtDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy} ${mm} ${dd}`;
}

const MONTHS: Record<string, number> = {
  Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
  Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12,
};

/** Convert tab names like "26Feb23 U1" or "24 Apr L2" to "YYYY MM DD suffix". */
export function fmtTabName(tabName: string): string {
  const m = tabName.match(/^(\d{1,2})\s*([A-Za-z]{3})(\d{2})?\s+(.+)$/);
  if (!m) return tabName;
  const day = parseInt(m[1]);
  const mon = MONTHS[m[2].charAt(0).toUpperCase() + m[2].slice(1).toLowerCase()];
  if (!mon) return tabName;
  const yr = m[3] ? 2000 + parseInt(m[3]) : new Date().getFullYear();
  const mm = String(mon).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${yr} ${mm} ${dd} ${m[4]}`;
}
