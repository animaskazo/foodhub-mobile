import ScreenHeader from '../components/ScreenHeader';
import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  RefreshControl,
  TextInput,
  Pressable,
  Keyboard,
} from 'react-native';
import { ReceiptText, Search, X } from 'lucide-react-native';
import CartSheet from './CartSheet';
import OrderRow from '../components/OrderRow';
import { SalesSkeleton } from '../components/Skeleton';
import { TAB_BAR_CLEARANCE } from '../components/TabBar';
import {
  getMyStore,
  getRecentOrders,
  peekMyStore,
  peekRecentOrders,
  fmtMoney,
  ORDER_TYPE_LABELS,
} from '../lib/store';
import { findCachedProductImage } from '../lib/pos';
import { groupOrdersByMonth } from '../lib/orderGroups';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';

function detailDate(iso) {
  const d = new Date(iso);
  const time = d.toLocaleTimeString('es-CL', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const now = new Date();
  const sameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (sameDay(d, now)) return `Hoy ${time}`;
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (sameDay(d, y)) return `Ayer ${time}`;
  return `${d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })} ${time}`;
}

// Pedidos agrupados por mes, con el monto vendido en cada grupo.
export default function SalesScreen({ active, pushOrderId }) {
  // Pinta caché al instante; el spinner solo aparece en la primera carga.
  const [orders, setOrders] = useState(() => {
    const s = peekMyStore();
    return (s && peekRecentOrders(s.branchIds, 150)) || [];
  });
  const [loading, setLoading] = useState(() => {
    const s = peekMyStore();
    return !(s && peekRecentOrders(s.branchIds, 150));
  });
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');
  const mounted = React.useRef(false);

  React.useEffect(() => {
    if (!active || typeof pushOrderId !== 'string') return;
    let alive = true;
    setSelected(null);
    supabase.rpc('push_order_detail', { p_order_id: pushOrderId }).then(({ data, error: detailError }) => {
      if (!alive) return;
      if (detailError || !data) setError('No se pudo abrir el pedido o ya no tienes acceso.');
      else { setError(''); setSelected(data); }
      router.setParams({ orderId: undefined });
    });
    return () => { alive = false; };
  }, [active, pushOrderId]);

  const load = useCallback(async (force = false) => {
    setError('');
    if (force) setRefreshing(true);
    try {
      const { branchIds } = await getMyStore(
        force ? { forceRefresh: true } : undefined
      );
      const data = await getRecentOrders(
        branchIds,
        150,
        force ? { forceRefresh: true } : undefined
      );
      setOrders(data);
    } catch (err) {
      setError(err.message || 'No se pudieron cargar las ventas.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    mounted.current = true;
    load();
  }, [load]);

  // Revalida en background al volver al tab, sin pantalla de carga.
  React.useEffect(() => {
    if (active && mounted.current) load(false);
  }, [active, load]);

  const q = query.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      orders.filter(
        (o) =>
          !q ||
          (o.order_number || '').toLowerCase().includes(q) ||
          (o.customer_name || '').toLowerCase().includes(q)
      ),
    [orders, q]
  );

  const sections = useMemo(() => groupOrdersByMonth(filtered), [filtered]);

  if (loading) {
    return <SalesSkeleton />;
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Pedidos" description="Revisa y gestiona tus pedidos." action={
        <Pressable style={styles.searchButton} accessibilityRole="button"
          accessibilityLabel={searchOpen ? 'Cerrar búsqueda' : 'Buscar pedidos'}
          accessibilityState={{ expanded: searchOpen }}
          onPress={() => {
            if (searchOpen) { setQuery(''); Keyboard.dismiss(); }
            setSearchOpen(value => !value);
          }}>
          {searchOpen ? <X size={22} color="#111" /> : <Search size={22} color="#111" />}
        </Pressable>
      } />
      {searchOpen && <View style={styles.searchWrap}>
        <Search size={16} color="#8E8E93" />
        <TextInput
          style={styles.search}
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar por código o cliente"
          accessibilityLabel="Buscar por código o cliente"
          autoFocus
          autoCorrect={false}
          returnKeyType="search"
          onSubmitEditing={Keyboard.dismiss}
          clearButtonMode="while-editing"
        />
      </View>}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <SectionList
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        sections={sections}
        keyExtractor={(o) => o.id}
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIcon}>
              <ReceiptText size={32} color="#8E8E93" />
            </View>
            <Text style={styles.emptyTitle}>
              {q ? 'Sin resultados' : 'Sin ventas todavía'}
            </Text>
            <Text style={styles.emptySub}>
              {q
                ? `No hay coincidencias para “${query.trim()}”.`
                : 'Cuando cierres tu primera venta la verás aquí con su detalle.'}
            </Text>
          </View>
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionRow}>
            <Text style={styles.section}>{section.title}</Text>
            <Text style={styles.sectionSummary}>
              <Text style={styles.sectionTotal}>{fmtMoney(section.total)}</Text>
              {' vendidos · '}{section.data.length} {section.data.length === 1 ? 'pedido' : 'pedidos'}
            </Text>
          </View>
        )}
        renderItem={({ item: o, index, section }) => (
          <OrderRow
            order={o}
            onPress={() => setSelected(o)}
            first={index === 0}
            last={index === section.data.length - 1}
          />
        )}
      />

      <CartSheet
        visible={!!selected}
        onClose={() => setSelected(null)}
        readOnly
        order={selected}
        lines={(selected?.order_items || []).map((it, i) => ({
          id: String(i),
          name: it.product_name,
          price: Number(it.unit_price) || 0,
          qty: it.quantity,
          image: findCachedProductImage(it.product_name),
          variantLabel: (it.order_item_variants || []).map((v) => v.variant_option_name).filter(Boolean).join(' · ') || null,
          extrasLabel: (it.order_item_ingredients || []).length > 0
            ? `+ ${(it.order_item_ingredients || []).map((e) => e.ingredient_name).filter(Boolean).join(', + ')}`
            : null,
        }))}
        title={`${selected?.order_number || selected?.id.slice(0, 6) || 'Pedido'}`}
        subtitle={
          selected
            ? [
                detailDate(selected.created_at),
                ORDER_TYPE_LABELS[selected.delivery_type] ||
                  ORDER_TYPE_LABELS[selected.order_type],
                selected.customer_name,
              ]
                .filter(Boolean)
                .join(' · ')
            : ''
        }
        totalOverride={selected ? Number(selected.total) || 0 : 0}
        subtotalOverride={selected ? Number(selected.subtotal) || 0 : 0}
        discountOverride={selected ? Number(selected.discount_amount) || 0 : 0}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  searchButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#E3E3E8',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 38,
    marginHorizontal: 16,
    marginTop: 0,
    marginBottom: 4,
  },
  search: { flex: 1, fontSize: 16, color: '#000', height: '100%' },
  error: { color: '#FF3B30', fontSize: 13, paddingHorizontal: 16 },
  list: { paddingHorizontal: 16, paddingBottom: TAB_BAR_CLEARANCE, flexGrow: 1 },
  // Empty state a pantalla completa: ocupa el espacio libre y centra
  // icono + mensaje (§16: responde qué hay y qué hacer).
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    paddingHorizontal: 32,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#E3E3E8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: '#000' },
  emptySub: { fontSize: 13, color: '#8E8E93', textAlign: 'center', marginTop: 6, lineHeight: 18 },
  empty: { color: '#8E8E93', fontSize: 14, textAlign: 'center', marginTop: 24 },
  sectionRow: {
    gap: 4,
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 4,
    paddingTop: 6,
    paddingBottom: 12,
  },
  section: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
    color: '#111',
  },
  sectionTotal: { fontSize: 13, fontWeight: '800', color: '#000' },
  sectionSummary: { fontSize: 13, lineHeight: 20, color: '#6E6E73' },
  // Filas en components/OrderRow: una sola superficie por sección
  // en vez de una tarjeta por pedido (menos ruido).
});
