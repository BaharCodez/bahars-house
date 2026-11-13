/** A calendar date as YYYY-MM-DD, read in the clock of whoever runs it. */
export function formatDay(date: Date) {
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${mm}-${dd}`;
}

/* Same day → same pick, so the daily choices don't shuffle on every refresh. */
export function dayHash(text: string) {
  let h = 0;
  for (const c of text) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}
