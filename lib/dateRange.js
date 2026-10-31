// Calendar dates stay local; UTC conversion happens only at the query boundary.
export function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function localDate(key) {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}
export function shiftDate(key, days) {
  const date = localDate(key);
  date.setDate(date.getDate() + days);
  return dateKey(date);
}
export function presetRange(days, now = new Date()) {
  const end = dateKey(now);
  return { start: shiftDate(end, 1 - days), end, days };
}
export function rangeBounds(range) {
  const days = Math.round((Date.UTC(...parts(range.end)) - Date.UTC(...parts(range.start))) / 86400000) + 1;
  return {
    start: localDate(range.start).toISOString(),
    end: localDate(shiftDate(range.end, 1)).toISOString(),
    previousStart: localDate(shiftDate(range.start, -days)).toISOString(),
  };
}
function parts(key) { const [y, m, d] = key.split('-').map(Number); return [y, m - 1, d]; }
export function rangeLabel(range) {
  if (range.days === 1) return 'Hoy';
  if (range.days) return `Últimos ${range.days} días`;
  const format = key => localDate(key).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${format(range.start)} – ${format(range.end)}`;
}
export function summarizePeriod(orders, range) {
  const bounds = rangeBounds(range);
  const current = orders.filter(o => Date.parse(o.created_at) >= Date.parse(bounds.start) && Date.parse(o.created_at) < Date.parse(bounds.end));
  const counted = current.filter(o => o.status !== 'cancelled');
  const revenue = counted.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
  const previous = orders.filter(o => Date.parse(o.created_at) >= Date.parse(bounds.previousStart) && Date.parse(o.created_at) < Date.parse(bounds.start) && o.status !== 'cancelled')
    .reduce((sum, o) => sum + (Number(o.total) || 0), 0);
  return { summary: { revenue, count: counted.length, ticket: counted.length ? revenue / counted.length : 0 }, previous, totalOrders: current.length };
}
