import Image from '../components/SkeletonImage';
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { X, Ticket, ChevronRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { fmtMoney } from '../lib/store';
import OrderDetail from '../components/OrderDetail';
import ProductSelectionSummary from '../components/ProductSelectionSummary';

// Detalle del pedido en pageSheet (componente original).
// En modo lectura (readOnly) muestra un pedido ya creado:
// sin steppers ni botón continuar.
// En modo venta: productos con steppers y abajo el resumen
// simplificado (conteo + cupón) con la acción Continuar.
export default function CartSheet({
  visible,
  onClose,
  lines,
  taxRate = 0.19,
  onChangeQty,
  onCheckout,
  coupon = null,
  discount = 0,
  onApplyCoupon,
  onRemoveCoupon,
  readOnly = false,
  title,
  subtitle,
  totalOverride,
  subtotalOverride,
  discountOverride,
  order,
  onEdit,
  canEdit,
  editor,
}) {
  const linesTotal = lines.reduce((acc, l) => acc + l.price * l.qty, 0);
  const count = lines.reduce((acc, l) => acc + l.qty, 0);
  const total = totalOverride ?? Math.max(0, linesTotal - (discountOverride ?? discount));
  const [showCouponInput, setShowCouponInput] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [applying, setApplying] = useState(false);
  const [couponError, setCouponError] = useState('');

  const canApply = couponCode.trim().length > 0 && !applying;
  const handleApplyCoupon = async () => {
    if (!onApplyCoupon || !canApply) return;
    setApplying(true);
    setCouponError('');
    try {
      await onApplyCoupon(couponCode.trim());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setShowCouponInput(false);
      setCouponCode('');
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setCouponError(err.message || 'Cupón no válido.');
    } finally {
      setApplying(false);
    }
  };
  const dismissCouponInput = () => {
    Haptics.selectionAsync().catch(() => {});
    setShowCouponInput(false);
    setCouponCode('');
    setCouponError('');
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.grabber} />
        <View style={styles.header}>
          <Text style={styles.title}>{title ?? 'Pedido'}</Text>
          <TouchableOpacity
            onPress={onClose}
            style={styles.close}
            accessibilityLabel="Cerrar"
          >
            <X size={17} color="#3A3A3C" strokeWidth={2.5} />
          </TouchableOpacity>
        </View>
        <Text style={styles.subtitle}>
          {subtitle ?? `${count} ${count === 1 ? 'producto' : 'productos'} · ${fmtMoney(total)}`}
        </Text>

        {readOnly && order ? (
          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}
          >
            <OrderDetail order={order} />
          </ScrollView>
        ) : (
        <>
        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.section}>Productos</Text>
          <View style={styles.group}>
            {lines.length === 0 && (
              <Text style={styles.empty}>El pedido está vacío.</Text>
            )}
            {lines.map((l, i) => (
              <View
                key={l.id}
                style={[styles.row, i === lines.length - 1 && styles.rowLast]}
              >
                {l.image ? (
                  <Image source={{ uri: l.image }} style={styles.thumb} />
                ) : (
                  <View style={[styles.thumb, styles.thumbFallback]}>
                    <Text style={styles.thumbText}>
                      {(l.name || '?').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={styles.lineInfo}>
                  <Text style={styles.lineName} numberOfLines={2}>
                    {l.name}
                  </Text>
                  <ProductSelectionSummary line={l} />
                  <Text style={styles.lineUnit}>
                    {fmtMoney(l.price * l.qty)}
                  </Text>
                  {!readOnly && onEdit && canEdit?.(l) ? <TouchableOpacity style={styles.edit} onPress={() => onEdit(l)} accessibilityRole="button" accessibilityLabel={`Editar ${l.name}`}>
                    <Text style={styles.editText}>Editar</Text>
                  </TouchableOpacity> : null}
                </View>
                {readOnly ? (
                  <Text style={styles.qtyStatic}>{l.qty} u.</Text>
                ) : (
                  <View style={styles.stepper}>
                    <TouchableOpacity
                      onPress={() => onChangeQty(l.id, -1)}
                      style={styles.step}
                    >
                      <Text style={styles.stepText}>−</Text>
                    </TouchableOpacity>
                    <Text style={styles.lineQty}>{l.qty}</Text>
                    <TouchableOpacity
                      onPress={() => onChangeQty(l.id, 1)}
                      style={styles.step}
                    >
                      <Text style={styles.stepText}>+</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))}
          </View>

        </ScrollView>
        </>
        )}

        {readOnly && order ? (
          <View style={styles.pinnedTotals}>
            <View style={styles.pinnedRow}>
              <Text style={styles.pinnedLabel}>Subtotal</Text>
              <Text style={styles.pinnedValue}>{fmtMoney(order.subtotal)}</Text>
            </View>
            {Number(order.discount_amount) > 0 && (
              <View style={styles.pinnedRow}>
                <Text style={styles.pinnedLabel}>Descuento</Text>
                <Text style={styles.pinnedDiscount}>−{fmtMoney(order.discount_amount)}</Text>
              </View>
            )}
            {Number(order.delivery_fee) > 0 && (
              <View style={styles.pinnedRow}>
                <Text style={styles.pinnedLabel}>Despacho</Text>
                <Text style={styles.pinnedValue}>{fmtMoney(order.delivery_fee)}</Text>
              </View>
            )}
            <View style={styles.pinnedRow}>
              <Text style={styles.pinnedLabel}>IVA</Text>
              <Text style={styles.pinnedValue}>{fmtMoney(order.tax_amount)}</Text>
            </View>
            <View style={[styles.pinnedRow, styles.pinnedGrandRow]}>
              <Text style={styles.pinnedGrandLabel}>Total</Text>
              <Text style={styles.pinnedGrandValue}>{fmtMoney(order.total)}</Text>
            </View>
            {/* Salida explícita (wayfinding §16): nunca atrapar al usuario.
                Feedback instantáneo al presionar (§1) con activeOpacity. */}
            <TouchableOpacity
              onPress={onClose}
              activeOpacity={0.7}
              style={styles.closeInline}
              accessibilityRole="button"
              accessibilityLabel="Cerrar detalle del total"
              accessibilityHint="Cierra el detalle del pedido y vuelve a la lista"
            >
              <Text style={styles.closeInlineText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {!readOnly && lines.length > 0 && (
          <View style={styles.checkout}>
            {coupon ? (
              <View style={styles.couponSlim}>
                <Ticket size={15} color="#000" />
                <Text style={styles.couponCode}>{coupon.code}</Text>
                <Text style={styles.couponDiscount}>−{fmtMoney(discount)}</Text>
                <TouchableOpacity
                  onPress={() => {
                    onRemoveCoupon?.();
                    setShowCouponInput(false);
                    setCouponCode('');
                    setCouponError('');
                  }}
                  hitSlop={8}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={`Quitar cupón ${coupon.code}`}
                  style={styles.couponRemove}
                >
                  <X size={14} color="#8E8E93" strokeWidth={2.5} />
                </TouchableOpacity>
              </View>
            ) : showCouponInput ? (
              <View style={styles.couponBox}>
                <View style={styles.couponInputRow}>
                  <TextInput
                    style={styles.couponInput}
                    value={couponCode}
                    onChangeText={(t) => {
                      setCouponCode(t.toUpperCase().replace(/\s+/g, ''));
                      setCouponError('');
                    }}
                    placeholder="Código del cupón"
                    autoCapitalize="characters"
                    autoCorrect={false}
                    autoFocus
                    maxLength={16}
                    returnKeyType="done"
                    onSubmitEditing={handleApplyCoupon}
                    accessibilityLabel="Código del cupón"
                  />
                  <TouchableOpacity
                    style={[styles.couponApply, !canApply && styles.couponApplyDisabled]}
                    onPress={handleApplyCoupon}
                    activeOpacity={0.7}
                    disabled={!canApply}
                    accessibilityRole="button"
                    accessibilityLabel="Aplicar cupón"
                  >
                    {applying ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.couponApplyText}>Aplicar</Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.couponDismiss}
                    onPress={dismissCouponInput}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel="Cerrar ingreso de cupón"
                  >
                    <X size={15} color="#8E8E93" strokeWidth={2.5} />
                  </TouchableOpacity>
                </View>
                {couponError ? (
                  <Text style={styles.couponError}>{couponError}</Text>
                ) : null}
              </View>
            ) : (
              <TouchableOpacity
                style={styles.couponSlimBtn}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setCouponError('');
                  setShowCouponInput(true);
                }}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Agregar cupón"
              >
                <Ticket size={15} color="#000" />
                <Text style={styles.couponText}>Agregar cupón</Text>
                <ChevronRight size={15} color="#C7C7CC" />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.pay}
              onPress={onCheckout}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`Continuar al cobro, ${fmtMoney(total)}`}
            >
              <Text style={styles.payText}>Continuar · {fmtMoney(total)}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cancel}
              onPress={onClose}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Cancelar y seguir vendiendo"
            >
              <Text style={styles.cancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        )}
        {editor}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7', paddingTop: 8 },
  grabber: {
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#C7C7CC',
    alignSelf: 'center',
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  title: { fontSize: 28, fontWeight: '800', color: '#000', letterSpacing: -0.5 },
  close: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#E3E3E8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtitle: { fontSize: 13, color: '#8E8E93', paddingHorizontal: 20, marginTop: 2 },
  body: { flex: 1, marginTop: 12 },
  bodyContent: { paddingHorizontal: 16, paddingBottom: 16 },
  section: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000',
    marginLeft: 4,
    marginBottom: 8,
    marginTop: 4,
  },
  group: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.06)',
    borderRadius: 14,
    paddingLeft: 14,
    overflow: 'hidden',
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 18,
    paddingRight: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  rowLast: { borderBottomWidth: 0 },
  empty: { padding: 16, paddingLeft: 2, color: '#8E8E93', fontSize: 14 },
  thumb: { width: 52, height: 52, borderRadius: 13, backgroundColor: '#F2F2F7' },
  thumbFallback: { alignItems: 'center', justifyContent: 'center' },
  thumbText: { fontSize: 18, fontWeight: '800', color: '#C7C7CC' },
  lineInfo: { flex: 1, marginLeft: 16, marginRight: 16 },
  lineName: { fontSize: 15, fontWeight: '600', color: '#000' },
  lineVariant: { fontSize: 12, color: '#8E8E93', marginTop: 1 },
  lineUnit: { fontSize: 13, color: '#8E8E93', marginTop: 2 },
  edit: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start', paddingRight: 12 },
  editText: { fontSize: 13, fontWeight: '600', color: '#000', textDecorationLine: 'underline' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  step: {
    backgroundColor: '#F2F2F7',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { fontSize: 17, fontWeight: '700', color: '#000' },
  lineQty: { fontSize: 15, fontWeight: '700', minWidth: 24, textAlign: 'center' },
  qtyStatic: { fontSize: 13, fontWeight: '600', color: '#8E8E93' },
  // Bloque inferior fijo: resumen con presencia + acciones.
  checkout: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 28,
    backgroundColor: '#F2F2F7',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5EA',
  },
  // Acceso al cupón: botón pequeño sobre las acciones.
  couponSlimBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    marginBottom: 8,
  },
  couponSlim: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    marginBottom: 8,
  },
  couponText: { fontSize: 14, fontWeight: '600', color: '#000' },
  couponBox: { marginTop: 4, marginBottom: 8 },
  couponInputRow: { flexDirection: 'row', gap: 8 },
  couponInput: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 46,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: '#000',
  },
  couponDismiss: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  couponApply: {
    backgroundColor: '#000',
    borderRadius: 12,
    minWidth: 80,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  couponApplyDisabled: { opacity: 0.5 },
  couponApplyText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  couponError: { fontSize: 12, color: '#FF3B30', marginTop: 6, marginLeft: 4 },
  couponApplied: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  couponCode: { fontSize: 14, fontWeight: '800', color: '#000', letterSpacing: 0.4 },
  couponDiscount: { fontSize: 14, fontWeight: '700', color: '#000' },
  couponRemove: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Material claro (§12): superficie blanca sobre fondo agrupado #F2F2F7,
  // con borde hairline y sombra suave con contexto. Superficie grande =
  // material con presencia sin endurecer.
  pinnedTotals: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.06)',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 8,
    marginHorizontal: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  pinnedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  pinnedGrandRow: { borderBottomWidth: 0 },
  // Jerarquía por peso sobre material claro (§15): secundario gris,
  // valores en negro con peso medio.
  pinnedLabel: { fontSize: 13, color: '#8E8E93' },
  pinnedValue: { fontSize: 13, fontWeight: '600', color: '#000' },
  pinnedDiscount: { fontSize: 13, fontWeight: '600', color: '#000' },
  pinnedGrandLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000',
    letterSpacing: -0.2,
  },
  pinnedGrandValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#000',
    letterSpacing: -0.5,
  },
  // Acción primaria (§16): negro sólido, misma jerarquía que
  // "Continuar". Feedback instantáneo al presionar (§1).
  closeInline: {
    marginTop: 10,
    marginBottom: 6,
    backgroundColor: '#000',
    borderRadius: 12,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeInlineText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  pay: {
    backgroundColor: '#000',
    borderRadius: 16,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payText: { color: '#fff', fontWeight: '700', fontSize: 17 },
  // Acción secundaria: superficie neutra, no compite con Continuar.
  cancel: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    borderRadius: 16,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  cancelText: { color: '#000', fontWeight: '600', fontSize: 16 },
});
