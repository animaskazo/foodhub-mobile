import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ShoppingBag, Store, Truck, CircleHelp, Tag } from 'lucide-react-native';
import Svg, { Polyline } from 'react-native-svg';
import { fmtMoney } from '../lib/store';

const CHANNELS = {
  pickup: { label: 'Retiro', Icon: ShoppingBag, color: '#007AFF' },
  delivery: { label: 'Delivery', Icon: Truck, color: '#5AC8FA' },
  local: { label: 'Local', Icon: Store, color: '#8E8E93' },
  other: { label: 'Otros', Icon: CircleHelp, color: '#AF52DE' },
};

export function classifyOrderChannel(order) {
  const deliveryType = String(order.delivery_type || '').trim().toLowerCase();
  const orderType = String(order.order_type || '').trim().toLowerCase();
  const values = [deliveryType, orderType];

  if (values.some(value => ['delivery', 'dispatch', 'despacho', 'shipping'].includes(value))) {
    return 'delivery';
  }
  if (values.some(value => ['pickup', 'pick_up', 'takeaway', 'take_away', 'retiro', 'retira'].includes(value))) {
    return 'pickup';
  }
  if (values.some(value => ['local', 'in_store', 'dine_in', 'dine-in', 'table', 'pos'].includes(value))) {
    return 'local';
  }
  return 'other';
}

export function summarizeChannels(orders) {
  const values = Object.fromEntries(Object.keys(CHANNELS).map(key => [key, { key, revenue: 0, count: 0 }]));
  (orders || []).filter(order => order.status !== 'cancelled').forEach(order => {
    const channel = values[classifyOrderChannel(order)];
    channel.revenue += Number(order.total) || 0;
    channel.count += 1;
  });

  const totalRevenue = Object.values(values).reduce((sum, channel) => sum + channel.revenue, 0);
  return Object.values(values)
    .filter(channel => channel.count > 0)
    .map(channel => ({
      ...channel,
      percent: totalRevenue ? Math.round((channel.revenue / totalRevenue) * 100) : 0,
      ...CHANNELS[channel.key],
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

export function summarizeDailySales(orders, dateKeys) {
  const totals = Object.fromEntries(dateKeys.map(key => [key, 0]));
  (orders || []).filter(order => order.status !== 'cancelled').forEach(order => {
    const created = new Date(order.created_at);
    const key = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, '0')}-${String(created.getDate()).padStart(2, '0')}`;
    if (Object.prototype.hasOwnProperty.call(totals, key)) totals[key] += Number(order.total) || 0;
  });
  return dateKeys.map(key => ({ key, revenue: totals[key] }));
}

export function SalesSparkline({ days }) {
  const width = 82;
  const height = 32;
  const maxRevenue = Math.max(...days.map(day => day.revenue), 0);
  const points = days.map((day, index) => {
    const x = days.length > 1 ? (index / (days.length - 1)) * width : width / 2;
    const y = maxRevenue ? height - 3 - (day.revenue / maxRevenue) * (height - 7) : height - 3;
    return `${x},${y}`;
  }).join(' ');

  return (
    <Svg width={width} height={height} accessible accessibilityLabel="Tendencia reciente de ventas">
      <Polyline points={points} fill="none" stroke="#007AFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function DashboardMetricCards({ totalOrders, ticket }) {
  return (
    <View style={styles.metricsRow}>
      <View style={styles.metricCard}>
        <View style={styles.metricIcon}><ShoppingBag size={18} color="#1C1C1E" /></View>
        <View style={styles.metricCopy}>
          <Text style={styles.metricLabel}>Pedidos</Text>
          <Text style={styles.metricValue}>{totalOrders.toLocaleString('es-CL')}</Text>
        </View>
      </View>
      <View style={styles.metricCard}>
        <View style={styles.metricIcon}><Tag size={18} color="#1C1C1E" /></View>
        <View style={styles.metricCopy}>
          <Text style={styles.metricLabel}>Ticket promedio</Text>
          <Text style={styles.metricValue} numberOfLines={1} adjustsFontSizeToFit>{fmtMoney(ticket)}</Text>
        </View>
      </View>
    </View>
  );
}

export function SalesByChannelCard({ channels }) {
  return (
    <View style={styles.card} accessibilityLabel="Ventas por canal">
      <View style={styles.headingRow}>
        <Text style={styles.title}>Ventas por canal</Text>
        <Text style={styles.detailLabel}>Según ventas</Text>
      </View>
      {channels.length ? channels.map(channel => {
        const Icon = channel.Icon;
        const width = channel.revenue ? Math.max(channel.percent, 2) : 0;
        return (
          <View key={channel.key} style={styles.channelRow}>
            <View style={styles.channelTop}>
              <View style={styles.channelName}>
                <Icon size={16} color={channel.color} strokeWidth={2} />
                <Text style={styles.channelLabel}>{channel.label}</Text>
                <Text style={styles.orderCount}>{channel.count} {channel.count === 1 ? 'pedido' : 'pedidos'}</Text>
              </View>
              <View style={styles.channelValues}>
                <Text style={styles.channelAmount}>{fmtMoney(channel.revenue)}</Text>
                <Text style={styles.channelPercent}>{channel.percent}%</Text>
              </View>
            </View>
            <View
              style={styles.track}
              accessible
              accessibilityRole="progressbar"
              accessibilityLabel={`${channel.label}: ${channel.percent}% de las ventas`}
              accessibilityValue={{ min: 0, max: 100, now: channel.percent }}
            >
              <View style={[styles.fill, { width: `${width}%`, backgroundColor: channel.color }]} />
            </View>
          </View>
        );
      }) : <Text style={styles.empty}>Aún no hay ventas en este período.</Text>}
    </View>
  );
}

export function SalesTrendCard({ days }) {
  const maxRevenue = Math.max(...days.map(day => day.revenue), 0);
  const total = days.reduce((sum, day) => sum + day.revenue, 0);
  return (
    <View style={styles.card} accessibilityLabel="Tendencia de ventas de los últimos siete días">
      <View style={styles.headingRow}>
        <View>
          <Text style={styles.title}>Tendencia de ventas</Text>
          <Text style={styles.trendTotal}>7 días · {fmtMoney(total)}</Text>
        </View>
        <Text style={styles.detailLabel}>Por día</Text>
      </View>
      <View style={styles.chart}>
        {days.map((day, index) => {
          const height = maxRevenue ? Math.max((day.revenue / maxRevenue) * 64, day.revenue ? 4 : 2) : 2;
          const date = new Date(`${day.key}T12:00:00`);
          const label = date.toLocaleDateString('es-CL', { weekday: 'short' }).replace('.', '');
          return (
            <View key={day.key} style={styles.barColumn} accessible accessibilityLabel={`${date.toLocaleDateString('es-CL', { weekday: 'long' })}, ventas ${fmtMoney(day.revenue)}`}>
              <View style={styles.barTrack}>
                <View style={[styles.bar, { height, backgroundColor: index === days.length - 1 ? '#007AFF' : '#B7D4FF' }]} />
              </View>
              <Text style={[styles.dayLabel, index === days.length - 1 && styles.todayLabel]}>{label}</Text>
            </View>
          );
        })}
      </View>
      {!total ? <Text style={styles.emptyTrend}>Sin ventas registradas en estos días.</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  metricsRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  metricCard: { flex: 1, minWidth: 0, minHeight: 82, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)', borderRadius: 18, paddingHorizontal: 12, paddingVertical: 12 },
  metricIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: '#F2F2F7', alignItems: 'center', justifyContent: 'center' },
  metricCopy: { flex: 1, minWidth: 0 },
  metricLabel: { color: '#6E6E73', fontSize: 11, lineHeight: 16, fontWeight: '500' },
  metricValue: { color: '#1C1C1E', fontSize: 18, lineHeight: 23, fontWeight: '750', letterSpacing: -0.5 },
  card: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
  },
  headingRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 14 },
  title: { color: '#1C1C1E', fontSize: 17, lineHeight: 22, fontWeight: '700', letterSpacing: -0.3 },
  detailLabel: { color: '#8E8E93', fontSize: 11, lineHeight: 18, fontWeight: '500' },
  trendTotal: { color: '#6E6E73', fontSize: 12, lineHeight: 18, marginTop: 2 },
  channelRow: { marginTop: 2, marginBottom: 12 },
  channelTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 7 },
  channelName: { flexDirection: 'row', alignItems: 'center', gap: 7, flex: 1, minWidth: 0 },
  channelLabel: { color: '#3A3A3C', fontSize: 13, fontWeight: '600' },
  orderCount: { color: '#8E8E93', fontSize: 11, flexShrink: 1 },
  channelValues: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  channelAmount: { color: '#1C1C1E', fontSize: 12, fontWeight: '600' },
  channelPercent: { width: 32, color: '#6E6E73', fontSize: 11, textAlign: 'right' },
  track: { width: '100%', height: 7, overflow: 'hidden', backgroundColor: '#F2F2F7', borderRadius: 5 },
  fill: { height: '100%', borderRadius: 5 },
  chart: { height: 94, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8, paddingTop: 8 },
  barColumn: { flex: 1, alignItems: 'center', height: '100%' },
  barTrack: { flex: 1, width: '100%', justifyContent: 'flex-end', alignItems: 'center' },
  bar: { width: '54%', minWidth: 10, borderTopLeftRadius: 5, borderTopRightRadius: 5 },
  dayLabel: { marginTop: 6, color: '#8E8E93', fontSize: 10, textTransform: 'capitalize' },
  todayLabel: { color: '#007AFF', fontWeight: '700' },
  empty: { color: '#8E8E93', fontSize: 13, lineHeight: 20, paddingVertical: 3 },
  emptyTrend: { color: '#8E8E93', fontSize: 11, marginTop: 8 },
});
