// Match the POS: base price plus one option per required variant group.
export function productPrice(product) {
  let minimum = Math.round(Number(product.base_price) || 0);
  let maximum = minimum;
  const seen = new Set();
  for (const group of product.variant_groups || []) {
    const options = (group.variant_options || []).filter(option => option.is_active !== false);
    if (!options.length) continue;
    const signature = `${group.name}||${options.map(option => `${option.name}:${Math.round(Number(option.price_modifier) || 0)}`).sort().join(',')}`;
    if (seen.has(signature)) continue;
    seen.add(signature);
    const prices = options.map(option => Math.round(Number(option.price_modifier) || 0));
    if (!group.is_required) prices.push(0);
    minimum += Math.min(...prices);
    maximum += Math.max(...prices);
  }
  return { price: Math.max(0, minimum), isFrom: Math.max(0, maximum) > Math.max(0, minimum) };
}
