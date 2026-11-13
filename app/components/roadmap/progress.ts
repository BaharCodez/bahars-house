export function summarizeProgress(steps: { done: boolean }[]) {
  const total = steps.length;
  const done = steps.filter((s) => s.done).length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  return { total, done, pct };
}
