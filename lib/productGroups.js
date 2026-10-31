export function groupProducts(products, categories) {
  const groups = categories.map(category => ({ key: category.id, title: category.name, data: [] }));
  const lookup = new Map(groups.map(group => [group.key, group]));
  const unassigned = { key: 'uncategorized', title: 'Sin categoría', data: [] };
  for (const product of products) {
    const ids = [...new Set(product.categoryIds || [])].filter(id => lookup.has(id));
    if (!ids.length) unassigned.data.push(product);
    else for (const id of ids) lookup.get(id).data.push(product);
  }
  return [...groups, unassigned].filter(group => group.data.length);
}
