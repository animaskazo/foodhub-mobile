import { supabase } from '../lib/supabase';
import {
  cachedFetch,
  peekCache,
  invalidateCache,
  clearAllCache,
} from './cache';

const ORDER_DETAILS = 'id, order_number, status, total, subtotal, tax_amount, discount_amount, delivery_fee, order_type, delivery_type, customer_name, customer_phone, delivery_address, delivery_notes, notes, scheduled_at, ready_at, created_at, order_items(product_name, quantity, unit_price, total_price, order_item_variants(variant_option_name), order_item_ingredients(ingredient_name)), payments(method, status)';

const STORE_TTL = 10 * 60 * 1000; // el local casi no cambia
const ORDERS_TTL = 45 * 1000; // balance entre frescura y tabs instantáneos

const storeKey = () => 'store:me:v5';
const ordersKey = (branchIds, limit) =>
  `orders:${[...branchIds].sort().join(',')}:${limit}`;

// Datos del local del usuario logueado (misma lógica que el POS web).
// Cacheado: la 2ª lectura es instantánea (memoria) y persiste entre reinicios.
export async function getMyStore(options = {}) {
  return cachedFetch(
    storeKey(),
    async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Sin sesión.');

      const { data: staff, error: staffError } = await supabase
        .from('staff')
        .select('organization_id, role, full_name')
        .eq('id', user.id)
        .single();
      if (staffError || !staff) throw new Error('Usuario sin local asignado.');

      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('id, name, logo_url, cover_url, phone, email, address, description, default_tax_rate, prep_time')
        .eq('id', staff.organization_id)
        .single();
      if (orgError || !org) throw new Error('Local no encontrado.');

      const { data: branches } = await supabase
        .from('branches')
        .select('id')
        .eq('organization_id', org.id);
      const branchIds = (branches || []).map((b) => b.id);

      return { user, staff, org, branchIds };
    },
    { ttl: STORE_TTL, forceRefresh: options.forceRefresh }
  );
}

/** Lectura síncrona para pintar el tab al instante sin spinner. */
export function peekMyStore() {
  return peekCache(storeKey());
}

export async function updateStorePrepTime(minutes) {
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > 240) {
    throw new Error('Ingresa un tiempo entre 0 y 240 minutos.');
  }
  const { org } = await getMyStore();
  const { data, error } = await supabase.from('organizations')
    .update({ prep_time: minutes }).eq('id', org.id)
    .select('prep_time').single();
  if (error || data?.prep_time !== minutes) throw new Error('No se pudo guardar el tiempo. Inténtalo de nuevo.');
  await invalidateCache(storeKey());
  return data.prep_time;
}

/** Últimas órdenes del local con sus ítems (mismo detalle que la web).
 * Cacheadas con SWR: si hay datos, se devuelven al instante y se
 * revalidan en background para que el cambio de tab se sienta suave. */
export async function getRecentOrders(branchIds, limit = 60, options = {}) {
  if (!branchIds.length) return [];
  return cachedFetch(
    ordersKey(branchIds, limit),
    async () => {
      const { data, error } = await supabase
        .from('orders')
        .select(
          ORDER_DETAILS
        )
        .in('branch_id', branchIds)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data || [];
    },
    { ttl: ORDERS_TTL, forceRefresh: options.forceRefresh }
  );
}

/** Lectura síncrona para estado inicial de los tabs. */
export function peekRecentOrders(branchIds, limit = 60) {
  if (!branchIds?.length) return null;
  return peekCache(ordersKey(branchIds, limit));
}

/** Llamar tras crear/anular un pedido para que los tabs se refresquen. */
export function invalidateOrdersCache() {
  invalidateCache('orders:');
}

/** Llamar al cerrar sesión para no mezclar locales. */
export function clearStoreCache() {
  clearAllCache();
}

export const fmtMoney = (n) =>
  `$${Math.round(Number(n) || 0).toLocaleString('es-CL')}`;

export const isToday = (iso) => {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
};

// Estados que cuentan como venta (no canceladas).
export const isCounted = (status) => status !== 'cancelled';

export function summarizeToday(orders) {
  const today = orders.filter((o) => isToday(o.created_at) && isCounted(o.status));
  const revenue = today.reduce((acc, o) => acc + Number(o.total || 0), 0);
  const count = today.length;
  return {
    revenue,
    count,
    ticket: count > 0 ? Math.round(revenue / count) : 0,
  };
}

export function summarizeYesterday(orders) {
  const y = new Date();
  y.setDate(y.getDate() - 1);
  const sameDay = (iso) => {
    const d = new Date(iso);
    return (
      d.getFullYear() === y.getFullYear() &&
      d.getMonth() === y.getMonth() &&
      d.getDate() === y.getDate()
    );
  };
  const list = orders.filter((o) => sameDay(o.created_at) && isCounted(o.status));
  return list.reduce((acc, o) => acc + Number(o.total || 0), 0);
}

export function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 20) return 'Buenas tardes';
  return 'Buenas noches';
}

export const STATUS_LABELS = {
  pending: 'Pendiente',
  confirmed: 'Confirmado',
  preparing: 'En cocina',
  ready: 'Listo',
  delivered: 'Entregado',
  paid: 'Pagado',
  cancelled: 'Anulado',
};

// Lenguaje de estado único: mismo punto en lista y detalle (§16).
export const ORDER_DOT = {
  cancelled: '#FF3B30',
  ready: '#34C759',
  delivered: '#34C759',
  paid: '#34C759',
  preparing: '#FF9F0A',
  pending: '#C7C7CC',
  confirmed: '#007AFF',
};

export const ORDER_TYPE_LABELS = {
  pickup: 'Retiro',
  delivery: 'Delivery',
};

// Fetch every row for totals; only the eight visible orders need nested details.
export async function getDashboardPeriod(branchIds, bounds, options = {}) {
  if (!branchIds.length) return { orders: [], recent: [] };
  const key = `orders:period:${[...branchIds].sort().join(',')}:${bounds.previousStart}:${bounds.start}:${bounds.end}`;
  return cachedFetch(key, async () => {
    const orders = [];
    const size = 500;
    for (let offset = 0; ; offset += size) {
      const { data, error } = await supabase.from('orders')
        .select('id, created_at, total, status')
        .in('branch_id', branchIds)
        .gte('created_at', bounds.previousStart).lt('created_at', bounds.end)
        .order('created_at', { ascending: false }).order('id', { ascending: false })
        .range(offset, offset + size - 1);
      if (error) throw error;
      orders.push(...data);
      if (data.length < size) break;
    }
    const { data: recent, error } = await supabase.from('orders').select(ORDER_DETAILS)
      .in('branch_id', branchIds).gte('created_at', bounds.start).lt('created_at', bounds.end)
      .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(8);
    if (error) throw error;
    return { orders, recent };
  }, { ttl: ORDERS_TTL, persist: false, forceRefresh: options.forceRefresh });
}

// Visits are daily totals for the organization, rather than individual events.
export async function getStoreVisits(organizationId, range, options = {}) {
  const key = `visits:period:${organizationId}:${range.start}:${range.end}`;
  return cachedFetch(key, async () => {
    let visits = 0;
    const size = 500;
    for (let offset = 0; ; offset += size) {
      const { data, error } = await supabase.from('store_visits')
        .select('visit_count')
        .eq('organization_id', organizationId)
        .gte('date', range.start).lte('date', range.end)
        .order('date', { ascending: true }).order('id', { ascending: true })
        .range(offset, offset + size - 1);
      if (error) throw error;
      visits += data.reduce((sum, row) => sum + (Number(row.visit_count) || 0), 0);
      if (data.length < size) break;
    }
    return visits;
  }, { ttl: ORDERS_TTL, persist: false, forceRefresh: options.forceRefresh });
}
