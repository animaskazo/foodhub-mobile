import Image from './SkeletonImage';
import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  User,
  ShoppingBag,
  CalendarClock,
  Info,
  MapPin,
  Banknote,
  CreditCard,
  ArrowLeftRight,
  Globe,
  MessageCircle,
  Bike,
  Store,
  Clock,
  Check,
  ChefHat,
  Bell,
  Package,
  CircleDollarSign,
  X,
} from 'lucide-react-native';
import {
  fmtMoney,
  STATUS_LABELS,
  ORDER_TYPE_LABELS,
} from '../lib/store';
import { findCachedProductImage } from '../lib/pos';

const PAY_META = {
  cash: { label: 'Efectivo', Icon: Banknote, tint: '#34C759' },
  card: { label: 'Tarjeta', Icon: CreditCard, tint: '#007AFF' },
  transfer: { label: 'Transferencia', Icon: ArrowLeftRight, tint: '#5856D6' },
  online_gateway: { label: 'Online', Icon: Globe, tint: '#007AFF' },
  whatsapp_pay: { label: 'WhatsApp Pay', Icon: MessageCircle, tint: '#34C759' },
};

const STATUS_META = {
  pending: { Icon: Clock, tint: '#8E8E93' },
  confirmed: { Icon: Check, tint: '#007AFF' },
  preparing: { Icon: ChefHat, tint: '#FF9F0A' },
  ready: { Icon: Bell, tint: '#34C759' },
  delivered: { Icon: Package, tint: '#34C759' },
  paid: { Icon: CircleDollarSign, tint: '#34C759' },
  cancelled: { Icon: X, tint: '#FF3B30' },
};

function InfoRow({ Icon, children, last }) {
  return (
    <View style={[styles.infoRow, last && styles.rowLast]}>
      <Icon size={17} color="#8E8E93" />
      <View style={styles.infoBody}>{children}</View>
    </View>
  );
}

// Chip compacto: solo el icono con color, texto siempre negro (§16).
// Sin fondos de color: una sola superficie neutra por chip.
function Chip({ Icon, tint, text }) {
  return (
    <View style={styles.chip}>
      <Icon size={14} color={tint || '#000'} />
      <Text style={styles.chipText} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

// Detalle de pedido (solo lectura, desde Pedidos).
// Jerarquía: resumen contextual arriba (estado, pago, entrega con
// icono), qué trae (detalle), quién/dónde (cliente).
// El monto vive solo abajo, en los totales fijados del sheet.
export default function OrderDetail({ order }) {
  const items = order?.order_items || [];
  // Inyecta la foto del catálogo cacheado (el pedido solo trae
  // product_name). Si el catálogo aún no está en caché, null y
  // se pinta el fallback con la cantidad.
  const itemsWithImage = useMemo(
    () =>
      items.map((it) => ({
        ...it,
        image: findCachedProductImage(it.product_name),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [order?.id]
  );
  if (!order) return null;
  const statusLabel = STATUS_LABELS[order.status] || order.status;
  const statusMeta = STATUS_META[order.status] || { Icon: Info, tint: '#8E8E93' };
  const StatusIcon = statusMeta.Icon;
  const payment = order.payments?.[0];
  const payMeta = (payment && PAY_META[payment.method]) || {
    label: (payment && payment.method) || 'Sin pago',
    Icon: Info,
    tint: '#8E8E93',
  };
  const count = items.reduce((acc, it) => acc + Number(it.quantity || 0), 0);
  const isDelivery =
    order.delivery_type === 'delivery' || order.order_type === 'delivery';
  const typeLabel =
    ORDER_TYPE_LABELS[order.delivery_type] ||
    ORDER_TYPE_LABELS[order.order_type] ||
    (isDelivery ? 'Delivery' : 'Retiro');
  const DeliveryIcon = isDelivery ? Bike : Store;
  const deliveryTint = isDelivery ? '#FF9F0A' : '#007AFF';

  const scheduled = order.scheduled_at
    ? new Date(order.scheduled_at).toLocaleString('es-CL', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  const hasInfo =
    order.customer_name ||
    order.delivery_type != null ||
    order.delivery_notes ||
    order.notes;

  return (
    <View style={styles.container}>
      {scheduled ? (
        <View style={styles.scheduled}>
          <CalendarClock size={16} color="#3A3A3C" />
          <Text style={styles.scheduledText}>Programado: {scheduled}</Text>
        </View>
      ) : null}

      {/* Resumen superior en chips: estado, pago y entrega.
          Sin montos: el total vive solo abajo, en los totales fijados. */}
      <View style={styles.chips}>
        <Chip
          Icon={StatusIcon}
          tint={statusMeta.tint}
          text={statusLabel}
        />
        <Chip Icon={payMeta.Icon} tint={payMeta.tint} text={payMeta.label} />
        <Chip Icon={DeliveryIcon} tint={deliveryTint} text={typeLabel} />
      </View>

      {/* Qué trae */}
      <Text style={styles.label}>
        Detalle · {count} {count === 1 ? 'producto' : 'productos'}
      </Text>
      <View style={styles.group}>
        {itemsWithImage.map((it, i) => (
          <View
            key={i}
            style={[styles.row, i === itemsWithImage.length - 1 && styles.rowLast]}
          >
            {it.image ? (
              <View style={styles.thumbWrap}>
                <Image source={{ uri: it.image }} style={styles.thumb} />
                <View style={styles.qtyOverlay}>
                  <Text style={styles.qtyOverlayText}>{it.quantity}</Text>
                </View>
              </View>
            ) : (
              <View style={styles.qtyBadge}>
                <Text style={styles.qtyBadgeText}>{it.quantity}</Text>
              </View>
            )}
            <View style={styles.rowInfo}>
              <Text style={styles.rowName}>{it.product_name}</Text>
              <Text style={styles.rowUnit}>{fmtMoney(it.unit_price)} c/u</Text>
            </View>
            <Text style={styles.rowTotal}>{fmtMoney(it.total_price)}</Text>
          </View>
        ))}
      </View>

      {/* Quién / dónde */}
      {hasInfo ? (
        <>
          <Text style={styles.label}>Cliente</Text>
          <View style={styles.group}>
            {order.customer_name ? (
              <InfoRow
                Icon={User}
                last={
                  order.delivery_type == null &&
                  !order.delivery_notes &&
                  !order.notes
                }
              >
                <Text style={styles.primary}>{order.customer_name}</Text>
                {order.customer_phone ? (
                  <Text style={styles.secondary}>{order.customer_phone}</Text>
                ) : null}
              </InfoRow>
            ) : null}
            {order.delivery_type === 'delivery' ? (
              <InfoRow
                Icon={MapPin}
                last={!order.delivery_notes && !order.notes}
              >
                <Text style={styles.primary}>Despacho a domicilio</Text>
                <Text style={styles.secondary}>
                  {order.delivery_address || 'Dirección no especificada'}
                </Text>
              </InfoRow>
            ) : order.delivery_type ? (
              <InfoRow
                Icon={ShoppingBag}
                last={!order.delivery_notes && !order.notes}
              >
                <Text style={styles.primary}>Retiro en local</Text>
              </InfoRow>
            ) : null}
            {order.delivery_notes ? (
              <InfoRow Icon={Info} last={!order.notes}>
                <Text style={styles.smallLabel}>Referencia de entrega</Text>
                <Text style={styles.primary}>{order.delivery_notes}</Text>
              </InfoRow>
            ) : null}
            {order.notes ? (
              <InfoRow Icon={Info} last>
                <Text style={styles.smallLabel}>Nota del cliente</Text>
                <Text style={styles.primary}>{order.notes}</Text>
              </InfoRow>
            ) : null}
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: 8 },
  scheduled: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  scheduledText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#000',
    flex: 1,
    textTransform: 'capitalize',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.06)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#000',
    letterSpacing: -0.1,
  },
  // Etiquetas de sección pequeñas: jerarquía por peso, no por tamaño (§15).
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8E8E93',
    marginLeft: 4,
    marginBottom: 6,
  },
  group: {
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingLeft: 14,
    overflow: 'hidden',
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 11,
    paddingRight: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  infoBody: { flex: 1 },
  primary: { fontSize: 15, fontWeight: '600', color: '#000' },
  secondary: { fontSize: 13, color: '#8E8E93', marginTop: 2, lineHeight: 18 },
  smallLabel: { fontSize: 11, color: '#8E8E93', fontWeight: '600' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingRight: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  rowLast: { borderBottomWidth: 0 },
  qtyBadge: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBadgeText: { fontSize: 13, fontWeight: '800', color: '#3A3A3C' },
  thumbWrap: { width: 44, height: 44, marginRight: 2 },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F2F2F7',
  },
  qtyOverlay: {
    position: 'absolute',
    right: -6,
    bottom: -6,
    backgroundColor: '#000',
    borderRadius: 999,
    minWidth: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    borderWidth: 2,
    borderColor: '#fff',
  },
  qtyOverlayText: { fontSize: 11, fontWeight: '800', color: '#fff' },
  rowInfo: { flex: 1, marginLeft: 10, marginRight: 8 },
  rowName: { fontSize: 14, fontWeight: '600', color: '#000' },
  rowUnit: { fontSize: 12, color: '#8E8E93', marginTop: 2 },
  rowTotal: { fontSize: 14, fontWeight: '700', color: '#000' },
});
