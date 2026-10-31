import { groupProducts } from './productGroups';

export function pairProducts(products) {
  const rows = [];
  for (let i = 0; i < products.length; i += 2) rows.push(products.slice(i, i + 2));
  return rows;
}
export function buildPosCatalog(products, categories) {
  const groups = groupProducts(products, categories);
  return {
    byCategory: new Map(groups.map(group => [group.key, group.data])),
    sections: groups.map(group => ({
      key: group.key, name: group.key === 'uncategorized' ? 'Otros' : group.title,
      count: group.data.length, data: pairProducts(group.data),
    })),
  };
}
export function pageAtOffset(offset, width, count) {
  if (width <= 0 || count <= 0 || !Number.isFinite(offset)) return 0;
  return Math.max(0, Math.min(count - 1, Math.round(offset / width)));
}
