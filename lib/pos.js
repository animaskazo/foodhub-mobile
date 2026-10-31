import { supabase } from './supabase';
import { customerFields } from './customer';
import { cachedFetch, peekCache, invalidateCache } from './cache';
import { invalidateOrdersCache, peekMyStore } from './store';

const PRODUCTS_TTL = 5 * 60 * 1000; // el catálogo cambia poco
const CATEGORIES_TTL = 10 * 60 * 1000; // las categorías cambian menos aún

const productsKey = (organizationId) => `products:v3:${organizationId}`;
const categoriesKey = (organizationId) => `categories:${organizationId}`;

// Productos disponibles del local (venta básica: sin variantes ni combos).
// Cacheados: el tab Vender abre al instante en la 2ª visita.
export async function getAvailableProducts(organizationId, options = {}) {
  return cachedFetch(
    productsKey(organizationId),
    async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, description, base_price, product_images(url), product_categories(category_id)')
        .eq('organization_id', organizationId)
        .eq('status', 'available')
        .order('name');
      if (error) throw error;
      return (data || []).map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description || null,
        price: Math.round(Number(p.base_price) || 0),
        image: p.product_images?.[0]?.url || null,
        categoryIds: (p.product_categories || []).map((r) => r.category_id),
      }));
    },
    { ttl: PRODUCTS_TTL, forceRefresh: options.forceRefresh }
  );
}

// Opciones del producto para el detalle (variantes + extras).
// - variantes: variant_groups + variant_options (single-select por grupo)
// - extras: product_ingredients(is_extra) + ingredients (multi-select)
// Cacheado por producto: abrir el detalle la 2ª vez es instantáneo.
const optionsKey = (productId) => `product-options:v2:${productId}`;
const OPTIONS_TTL = 5 * 60 * 1000;

export async function getProductOptions(productId, options = {}) {
  if (!productId) return { groups: [], extras: [] };
  return cachedFetch(
    optionsKey(productId),
    async () => {
      const [{ data: groupsData, error: groupsError }, { data: extraRows, error: extrasError }] =
        await Promise.all([
          supabase
            .from('variant_groups')
            .select('id, name, is_required, sort_order, variant_options(id, name, price_modifier, is_active, sort_order)')
            .eq('product_id', productId)
            .order('sort_order', { ascending: true }),
          supabase
            .from('product_ingredients')
            .select('ingredient_id, ingredients(id, name, price, is_active)')
            .eq('product_id', productId)
            .eq('is_extra', true),
        ]);
      if (groupsError) throw groupsError;
      if (extrasError) throw extrasError;

      // Se respeta el sort_order de la carta (antes que el nombre):
      // p. ej. Personal → Mediana → Familiar, no orden alfabético.
      const groups = (groupsData || [])
        .map((g) => ({
          id: g.id,
          name: g.name || 'Opciones',
          required: !!g.is_required,
          options: ((g.variant_options || []).filter((o) => o.is_active !== false) || [])
            .map((o) => ({
              id: o.id,
              name: o.name,
              price: Math.round(Number(o.price_modifier) || 0),
              sort: Number(o.sort_order) || 0,
            }))
            .sort(
              (a, b) => a.sort - b.sort || (a.name || '').localeCompare(b.name || '')
            )
            .map(({ id, name, price }) => ({ id, name, price })),
        }))
        .filter((g) => g.options.length > 0);

      const extras = (extraRows || [])
        .map((r) => r.ingredients)
        .filter((ing) => ing && ing.is_active !== false)
        .map((ing) => ({
          id: ing.id,
          name: ing.name,
          price: Math.round(Number(ing.price) || 0),
        }))
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

      // La carta trae grupos duplicados (mismo nombre y mismas opciones
      // con distintos ids): se colapsan en uno para no mostrar la
      // misma variante varias veces.
      const seen = new Set();
      const uniqueGroups = [];
      for (const g of groups) {
        const sig =
          `${g.name}||${g.options
            .map((o) => `${o.name}:${o.price}`)
            .sort()
            .join(',')}`;
        if (seen.has(sig)) continue;
        seen.add(sig);
        uniqueGroups.push(g);
      }

      return { groups: uniqueGroups, extras };
    },
    { ttl: OPTIONS_TTL, forceRefresh: options.forceRefresh }
  );
}

/** Lectura síncrona del último detalle conocido (para pintar sin spinner). */
export function peekProductOptions(productId) {
  if (!productId) return null;
  return peekCache(optionsKey(productId));
}

// Cupones del local (tabla coupons: percentage | fixed).
export function calcCouponDiscount(coupon, total) {
  if (!coupon) return 0;
  const t = Math.round(Number(total) || 0);
  if (t <= 0 || t < Number(coupon.min_total || 0)) return 0;
  if (coupon.type === 'percentage') {
    return Math.min(t, Math.round((t * Number(coupon.value || 0)) / 100));
  }
  return Math.min(t, Math.round(Number(coupon.value) || 0));
}

// Valida un código contra los cupones del local y devuelve el cupón
// aplicable al total actual. Lanza mensaje listo para mostrar.
export async function validateCoupon(organizationId, code, linesTotal) {
  const clean = String(code || '').trim().toUpperCase();
  if (!clean) throw new Error('Escribe un código.');
  const total = Math.round(Number(linesTotal) || 0);
  const { data, error } = await supabase
    .from('coupons')
    .select('id, code, type, value, min_total, max_uses, used_count, expires_at, is_active')
    .eq('organization_id', organizationId)
    .ilike('code', clean)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data || data.is_active === false) throw new Error('Cupón no válido.');
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    throw new Error('Cupón vencido.');
  }
  if (data.max_uses != null && Number(data.used_count || 0) >= Number(data.max_uses)) {
    throw new Error('Cupón agotado.');
  }
  if (Number(data.min_total || 0) > total) {
    throw new Error(`Requiere compra mínima de ${data.min_total}.`);
  }
  const discount = calcCouponDiscount(data, total);
  if (discount <= 0) throw new Error('Cupón sin descuento aplicable.');
  return {
    id: data.id,
    code: data.code,
    type: data.type,
    value: Number(data.value) || 0,
    min_total: Number(data.min_total) || 0,
  };
}

/** Último catálogo conocido (cualquier local) para pintar al instante. */
export function peekAvailableProducts(organizationId) {
  if (organizationId) return peekCache(productsKey(organizationId));
  return null;
}

/** Mapa nombre normalizado -> imagen del catálogo cacheado. */
export function peekProductImageMap(organizationId) {
  const list = (organizationId && peekCache(productsKey(organizationId))) || [];
  const map = new Map();
  for (const p of list) {
    if (p?.name && p?.image) {
      map.set(String(p.name).trim().toLowerCase(), p.image);
    }
  }
  return map;
}

/**
 * Imagen de un producto desde el catálogo cacheado.
 * Los pedidos solo traen `product_name` (sin product_id ni imagen),
 * así que se resuelve por nombre normalizado. Retorna null si el
 * catálogo aún no está en caché (p. ej. tab Vender sin abrir).
 */
export function findCachedProductImage(productName) {
  if (!productName) return null;
  try {
    const s = peekMyStore();
    const orgId = s?.org?.id;
    if (!orgId) return null;
    const key = String(productName).trim().toLowerCase();
    return peekProductImageMap(orgId).get(key) || null;
  } catch {
    return null;
  }
}

export function invalidateProductsCache() {
  return invalidateCache('products:');
}

// Categorías visibles en el POS (tabs superiores del tab Vender).
export async function getCategories(organizationId, options = {}) {
  return cachedFetch(
    categoriesKey(organizationId),
    async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('id, name, sort_order')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .eq('show_in_pos', true)
        .order('sort_order')
        .order('name');
      if (error) throw error;
      return data || [];
    },
    { ttl: CATEGORIES_TTL, forceRefresh: options.forceRefresh }
  );
}

/** Últimas categorías conocidas para pintar los tabs al instante. */
export function peekCategories(organizationId) {
  if (organizationId) return peekCache(categoriesKey(organizationId));
  return null;
}

export function invalidateCategoriesCache() {
  invalidateCache('categories:');
}

// Crea orden de mostrador pagada (flujo mínimo del POS web).
// items: [{ id_boilerplate(productId o id compuesto), productId?, name, price (unitario final), qty, selection?: { variants: [{groupId, groupName, optionId, optionName, price}], extras: [{id, name, price}] } }]
// coupon: { id, code, type, value } | null (se revalida al cobrar).
export async function createPosOrder({ items, paymentMethod, taxRate = 0.19, coupon = null, customer = {} }) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error('No hay sesión activa.');

  const { data: staffData, error: staffError } = await supabase
    .from('staff')
    .select('organization_id')
    .eq('id', session.user.id)
    .single();
  if (staffError || !staffData) throw new Error('Usuario sin local asignado.');
  const organizationId = staffData.organization_id;

  const { data: branchData, error: branchError } = await supabase
    .from('branches')
    .select('id')
    .eq('organization_id', organizationId)
    .limit(1)
    .single();
  if (branchError || !branchData) throw new Error('Local sin sucursal.');

  // Se normaliza primero (qty ≥ 1, precio ≥ 0) y el total sale de
  // esos valores, para que cabecera y líneas siempre cuadren.
  const normalized = (items || []).map((it) => ({
    source: it,
    qty: Math.max(1, Math.round(Number(it.qty) || 1)),
    unit: Math.max(0, Math.round(Number(it.price) || 0)),
  }));
  const linesTotal = normalized.reduce((acc, n) => acc + n.unit * n.qty, 0);

  // El cupón se revalida al cobrar: pudo vencer o quedar bajo el mínimo.
  let couponId = null;
  let discount = 0;
  if (coupon?.id) {
    const { data: fresh, error: couponError } = await supabase
      .from('coupons')
      .select('id, code, type, value, min_total, max_uses, used_count, expires_at, is_active')
      .eq('id', coupon.id)
      .maybeSingle();
    if (couponError) throw couponError;
    if (!fresh || fresh.is_active === false) throw new Error('El cupón ya no es válido.');
    if (fresh.expires_at && new Date(fresh.expires_at) < new Date()) {
      throw new Error('El cupón venció.');
    }
    if (fresh.max_uses != null && Number(fresh.used_count || 0) >= Number(fresh.max_uses)) {
      throw new Error('El cupón se agotó.');
    }
    if (Number(fresh.min_total || 0) > linesTotal) {
      throw new Error('El pedido ya no alcanza el mínimo del cupón.');
    }
    discount = calcCouponDiscount(fresh, linesTotal);
    couponId = fresh.id;
  }

  const total = Math.max(0, linesTotal - discount);
  const subtotal = Math.round(total / (1 + taxRate));
  const tax = total - subtotal;

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert([
      {
        organization_id: organizationId,
        branch_id: branchData.id,
        order_type: 'pickup',
        delivery_type: 'pickup',
        status: 'confirmed',
        subtotal,
        tax_amount: tax,
        total,
        discount_amount: discount,
        coupon_id: couponId,
        ...customerFields(customer),
      },
    ])
    .select('id, order_number, total')
    .single();
  if (orderError) throw orderError;

  // Suma un uso al cupón (best-effort: no bloquea el cobro).
  if (couponId) {
    supabase
      .from('coupons')
      .select('used_count')
      .eq('id', couponId)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        supabase
          .from('coupons')
          .update({ used_count: Number(data.used_count || 0) + 1 })
          .eq('id', couponId)
          .then(() => {});
      })
      .catch(() => {});
  }

  const rows = normalized.map((n) => {
    const it = n.source;
    // El carrito usa claves compuestas (producto + variante + extras):
    // el product_id real viaja en productId.
    const rawId = it.productId || it.id || '';
    const productId = String(rawId).includes('|') ? String(rawId).split('|')[0] : rawId;
    return {
      order_id: order.id,
      product_id: productId,
      product_name: it.name,
      quantity: n.qty,
      unit_price: n.unit,
      total_price: n.unit * n.qty,
    };
  });
  // Inserción secuencial (no bulk): garantiza que insertedItems[i]
  // corresponde a items[i] para colgar variantes/extras en la fila correcta.
  const insertedItems = [];
  for (const r of rows) {
    const { data: inserted, error: itemError } = await supabase
      .from('order_items')
      .insert([r])
      .select('id')
      .single();
    if (itemError) throw itemError;
    insertedItems.push(inserted);
  }

  // Variantes y extras elegidos en el detalle: van a sus tablas hijas.
  // Best-effort: si falla el detalle, el pedido ya quedó cobrado.
  try {
    const variantRows = [];
    const ingredientRows = [];
    (insertedItems || []).forEach((row, idx) => {
      const sel = normalized[idx]?.source?.selection;
      if (!sel) return;
      (sel.variants || []).forEach((v) => {
        if (!v?.optionId) return;
        variantRows.push({
          order_item_id: row.id,
          variant_group_id: v.groupId,
          variant_option_id: v.optionId,
          variant_group_name: v.groupName || null,
          variant_option_name: v.optionName || null,
          price_modifier: v.price || 0,
        });
      });
      (sel.extras || []).forEach((e) => {
        if (!e?.id) return;
        ingredientRows.push({
          order_item_id: row.id,
          ingredient_id: e.id,
          ingredient_name: e.name || null,
          price: e.price || 0,
        });
      });
    });
    if (variantRows.length > 0) {
      const { error: vError } = await supabase.from('order_item_variants').insert(variantRows);
      if (vError) throw vError;
    }
    if (ingredientRows.length > 0) {
      const { error: iError } = await supabase.from('order_item_ingredients').insert(ingredientRows);
      if (iError) throw iError;
    }
  } catch (detailError) {
    console.warn('No se pudo guardar el detalle de variantes/extras:', detailError?.message || detailError);
  }

  const { error: paymentError } = await supabase.from('payments').insert([
    {
      order_id: order.id,
      method: ['cash', 'card', 'transfer'].includes(paymentMethod)
        ? paymentMethod
        : 'cash',
      status: 'paid',
      amount: total,
      paid_at: new Date().toISOString(),
    },
  ]);
  if (paymentError) throw paymentError;

  // El nuevo pedido debe verse en Resumen/Ventas sin pull-to-refresh.
  invalidateOrdersCache();

  return order;
}
