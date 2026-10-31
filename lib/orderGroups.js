export function groupOrdersByMonth(orders) {
  const groups = new Map();
  for (const order of orders) {
    const date = new Date(order.created_at);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    if (!groups.has(key)) {
      const label = date.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });
      groups.set(key, { key, title: label.charAt(0).toUpperCase() + label.slice(1), data: [], total: 0 });
    }
    const group = groups.get(key);
    group.data.push(order);
    if (order.status !== 'cancelled') group.total += Number(order.total) || 0;
  }
  return [...groups.values()].sort((a, b) => b.key.localeCompare(a.key)).map(group => ({
    ...group,
    data: group.data.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)),
  }));
}
