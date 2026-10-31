import { supabase } from './supabase';
import { getMyStore } from './store';
import { cachedFetch, invalidateCache, peekCache } from './cache';
import { invalidateProductsCache } from './pos';
import { productPrice } from './productPrice';
const key = orgId => `product-management:v3:${orgId}`;
export function peekManagedProducts(orgId) { return orgId ? peekCache(key(orgId)) : null; }
export async function getManagedProducts(options = {}) {
  const { org } = await getMyStore();
  return cachedFetch(key(org.id), async () => {
    const products = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await supabase.from('products')
        .select('id, name, status, base_price, product_images(url), product_categories(category_id), variant_groups(name, is_required, variant_options(name, price_modifier, is_active))')
        .eq('organization_id', org.id).eq('is_active', true)
        .in('status', ['available', 'unavailable'])
        .order('name').order('id').range(offset, offset + 499);
      if (error) throw error;
      products.push(...data.map(p => ({
        id: p.id,
        name: p.name,
        status: p.status,
        ...productPrice(p),
        image: p.product_images?.[0]?.url || null,
        categoryIds: (p.product_categories || []).map(row => row.category_id),
      })));
      if (data.length < 500) break;
    }
    return products;
  }, { ttl: 30000, persist: false, forceRefresh: options.forceRefresh });
}

export function peekManagedCategories(orgId) {
  return orgId ? peekCache(`product-management-categories:${orgId}`) : null;
}

export async function getManagedCategories(options = {}) {
  const { org } = await getMyStore();
  return cachedFetch(`product-management-categories:${org.id}`, async () => {
    const { data, error } = await supabase.from('categories')
      .select('id, name, sort_order')
      .eq('organization_id', org.id)
      .eq('is_active', true)
      .order('sort_order')
      .order('name');
    if (error) throw error;
    return data || [];
  }, { ttl: 60000, persist: false, forceRefresh: options.forceRefresh });
}
export async function setProductAvailability(productId, enabled, previousStatus) {
  const { org } = await getMyStore();
  const status = enabled ? 'available' : 'unavailable';
  const { data, error } = await supabase.from('products').update({ status })
    .eq('id', productId).eq('organization_id', org.id).eq('is_active', true)
    .eq('status', previousStatus).select('id, status').single();
  if (error) throw new Error('No se pudo guardar. Actualiza la lista e intenta otra vez.');
  if (!data || data.status !== status) throw new Error('No se pudo confirmar el cambio.');
  await Promise.all([invalidateProductsCache(), invalidateCache(key(org.id))]);
  return data.status;
}
