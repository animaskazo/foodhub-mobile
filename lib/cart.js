export function makeCartLine(product, qty = 1, selection = null) {
  const variants = [...(selection?.variants || [])].sort((a, b) => String(a.groupId).localeCompare(String(b.groupId)));
  const extras = [...(selection?.extras || [])].sort((a, b) => String(a.id).localeCompare(String(b.id)));
  const price = Math.max(0, Math.round(Number(product.price) || 0)
    + variants.reduce((sum, variant) => sum + (Number(variant.price) || 0), 0)
    + extras.reduce((sum, extra) => sum + (Number(extra.price) || 0), 0));
  const hasSelection = variants.length > 0 || extras.length > 0;
  const key = hasSelection ? `${product.id}|${variants.map(variant => variant.optionId).join(',')}|${extras.map(extra => extra.id).join(',')}` : product.id;
  return {
    key, id: key, productId: product.id, name: product.name, image: product.image,
    price, basePrice: product.price, qty,
    selection: hasSelection ? { variants, extras, unitPrice: price } : null,
    variantLabel: variants.map(variant => variant.optionName).join(' · ') || null,
    extrasLabel: extras.length ? `+ ${extras.map(extra => extra.name).join(', + ')}` : null,
  };
}

export function canEditCartLine(line, options) {
  return !!(options?.groups?.some(group => group.options?.length)
    || options?.extras?.length
    || line.selection?.variants?.length
    || line.selection?.extras?.length);
}

export function addCartLine(cart, product, qty = 1, selection = null) {
  return mergeCartLine(cart, makeCartLine(product, qty, selection));
}

export function editCartLine(cart, key, product, selection) {
  const previous = cart[key];
  if (!previous) return cart;
  const next = { ...cart };
  delete next[key];
  return mergeCartLine(next, makeCartLine(product, previous.qty, selection));
}

function mergeCartLine(cart, line) {
  const next = { ...cart };
  let qty = line.qty;
  for (const [key, previous] of Object.entries(cart)) {
    // Also recognize lines created before variant keys were normalized.
    const productId = previous.productId || previous.id.split('|')[0];
    const previousKey = makeCartLine({ id: productId }, previous.qty, previous.selection).key;
    if (previousKey !== line.key) continue;
    qty += previous.qty;
    delete next[key];
  }
  next[line.key] = { ...line, qty };
  return next;
}
