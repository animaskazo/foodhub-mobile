import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { fmtMoney, STATUS_LABELS, ORDER_DOT, isCounted } from '../lib/store';

function itemsCount(o) {
  return (o.order_items || []).reduce((acc, it) => acc + Number(it.quantity || 0), 0);
}

function payLabel(o) {
  const m = o.payments?.[0]?.method;
  return m === 'cash'
    ? 'Efectivo'
    : m === 'card'
      ? 'Tarjeta'
      : m === 'transfer'
        ? 'Transf.'
        : null;
}

// Fila de pedido compartida (Resumen y Pedidos): una columna hacia
// abajo con código, cliente · pago · hora, cantidad de productos y estado.
export default function OrderRow({ order: o, onPress, first = false, last = false }) {
  const code = o.order_number || o.id.slice(0, 6);
  const customer = o.customer_name || null;
  const n = itemsCount(o);
  const sub = [
    customer,
    payLabel(o),
    new Date(o.created_at).toLocaleTimeString('es-CL', {
      hour: '2-digit',
      minute: '2-digit',
    }),
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <Pressable
      onPress={onPress}
      delayPressIn={0}
      accessibilityRole="button"
      accessibilityLabel={`Pedido ${code}${customer ? `, ${customer}` : ''}, ${fmtMoney(o.total)}, ${n} productos`}
      style={({ pressed }) => [
        styles.row,
        first && styles.rowFirst,
        last && styles.rowLast,
        pressed && styles.rowPressed,
      ]}
    >
      <View style={styles.rowLeft}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {code}
        </Text>
        <Text style={styles.rowSub} numberOfLines={1}>
          {sub}
        </Text>
        <Text style={styles.productCount} numberOfLines={1}>
          {n} {n === 1 ? 'producto' : 'productos'}
        </Text>
        <View style={styles.statusLine}>
          <View
            style={[styles.statusDot, { backgroundColor: ORDER_DOT[o.status] || '#C7C7CC' }]}
          />
          <Text style={styles.statusText}>{STATUS_LABELS[o.status] || o.status}</Text>
        </View>
      </View>
      <Text
        style={[styles.rowTotal, !isCounted(o.status) && styles.rowTotalCancelled]}
      >
        {fmtMoney(o.total)}
      </Text>
      <ChevronRight size={16} color="#C7C7CC" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  rowFirst: { borderTopLeftRadius: 14, borderTopRightRadius: 14 },
  rowLast: {
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    borderBottomWidth: 0,
    marginBottom: 4,
  },
  rowPressed: { opacity: 0.55, backgroundColor: '#EFEFF2' },
  rowLeft: { flex: 1, marginRight: 8 },
  rowTitle: { lineHeight: 24, fontSize: 18, fontWeight: '800', color: '#000', letterSpacing: -0.2 },
  rowSub: { lineHeight: 18, fontSize: 13, color: '#8E8E93', marginTop: 1 },
  productCount: { lineHeight: 18, fontSize: 13, color: '#6E6E73', marginTop: 3 },
  rowTotal: { fontSize: 15, fontWeight: '700', color: '#000', marginRight: 4 },
  rowTotalCancelled: { color: '#C7C7CC', textDecorationLine: 'line-through' },
  statusLine: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginTop: 8,
    backgroundColor: '#F2F2F7',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusDot: { width: 12, height: 12, borderRadius: 6 },
  statusText: { lineHeight: 16, fontSize: 12, fontWeight: '400', color: '#6E6E73' },
});
