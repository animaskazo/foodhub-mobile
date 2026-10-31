import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Pressable,
} from 'react-native';
import { ArrowLeft, Banknote, CreditCard, Landmark, Check, Ticket, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fmtMoney } from '../lib/store';

const METHODS = [
  { id: 'cash', label: 'Efectivo', Icon: Banknote },
  { id: 'card', label: 'Tarjeta', Icon: CreditCard },
  { id: 'transfer', label: 'Transferencia', Icon: Landmark },
];

// Cobro (§16): una pregunta, una respuesta — ¿cuánto y cómo se paga?
// El monto es lo más importante: grande, centrado verticalmente,
// sin fondo oscuro. Detalle (subtotal/IVA), método y confirmación
// debajo en superficies neutras.
export default function CheckoutScreen({
  lines,
  taxRate,
  method,
  onMethod,
  onConfirm,
  confirming,
  onBack,
  onCancel,
  discount = 0,
  couponCode = null,
  onApplyCoupon,
  onRemoveCoupon,
  couponMinTotal = 0,
  error = '',
  customer = { name: '', phone: '' },
  onCustomerChange,
}) {
  const [couponOpen, setCouponOpen] = useState(false);
  const [draftCode, setDraftCode] = useState('');
  const [applying, setApplying] = useState(false);
  const [couponError, setCouponError] = useState('');
  const applyingRef = useRef(false);
  const scrollRef = useRef(null);
  const couponInputRef = useRef(null);
  const phoneInputRef = useRef(null);
  const busy = confirming || applying;
  const paymentDisabled = busy || (!!couponCode && discount <= 0);
  const linesTotal = lines.reduce((acc, l) => acc + l.price * l.qty, 0);
  const total = Math.max(0, linesTotal - Math.round(Number(discount) || 0));
  const tax = total - Math.round(total / (1 + taxRate));
  const count = lines.reduce((acc, l) => acc + l.qty, 0);
  // Sin barra de navegación en esta sección: solo el área segura.
  const insets = useSafeAreaInsets();

  const handleMethod = (id) => {
    if (id === method) return;
    Haptics.selectionAsync().catch(() => {});
    onMethod(id);
  };

  const handleConfirm = () => {
    if (paymentDisabled || applyingRef.current) return;
    Keyboard.dismiss();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onConfirm();
  };

  const closeCoupon = () => {
    if (applyingRef.current) return;
    Keyboard.dismiss();
    setCouponOpen(false);
    setCouponError('');
  };

  const applyCoupon = async () => {
    if (!draftCode.trim() || !onApplyCoupon || confirming || applyingRef.current) return;
    applyingRef.current = true;
    setApplying(true);
    setCouponError('');
    try {
      await onApplyCoupon(draftCode.trim());
      Keyboard.dismiss();
      setDraftCode('');
      setCouponOpen(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (err) {
      setCouponError(err.message || 'No se pudo aplicar el cupón.');
    } finally {
      applyingRef.current = false;
      setApplying(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={insets.top}
      style={styles.container}
    >
      <View style={styles.header}>
        <TouchableOpacity
          onPress={onBack}
          disabled={busy}
          style={styles.back}
          hitSlop={8}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Volver al pedido"
        >
          <ArrowLeft size={20} color="#000" />
        </TouchableOpacity>
        <Text style={styles.title}>Cobrar</Text>
        <TouchableOpacity style={[styles.back, couponCode && styles.couponSelected]} disabled={busy}
          onPress={() => { Keyboard.dismiss(); setDraftCode(couponCode || ''); setCouponOpen(true); setCouponError(''); }}
          accessibilityRole="button" accessibilityLabel={couponOpen ? 'Cerrar ingreso de cupón' : couponCode ? `Gestionar cupón ${couponCode}` : 'Agregar cupón'}
          accessibilityState={{ expanded: couponOpen, disabled: busy }}>
          {couponOpen ? <X size={20} color={couponCode ? '#fff' : '#111'} /> : <Ticket size={20} color={couponCode ? '#fff' : '#111'} />}
        </TouchableOpacity>
      </View>

      <ScrollView ref={scrollRef} style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <View style={styles.hero}>
        <Text style={styles.heroLabel}>Total a cobrar</Text>
        {discount > 0 && <Text style={styles.originalTotal}>{fmtMoney(linesTotal)}</Text>}
        <Text style={styles.heroTotal}>{fmtMoney(total)}</Text>
        <Text style={styles.heroSub}>
          {count} {count === 1 ? 'producto' : 'productos'}
        </Text>
        <Text style={styles.heroTax}>
          En esta compra el IVA fue de {fmtMoney(tax)}
        </Text>
      </View>

      {couponCode ? <View style={styles.couponCard} accessibilityLiveRegion="polite">
        <View style={styles.appliedCoupon}>
          <Ticket size={18} color="#111" />
          <View style={styles.couponIdentity}>
            <Text style={styles.couponTitle}>{couponCode}</Text>
            <Text style={styles.couponHint}>{discount > 0 ? 'Descuento aplicado' : `Compra mínima: ${fmtMoney(couponMinTotal)}`}</Text>
          </View>
          <Text style={styles.discountValue}>{discount > 0 ? `−${fmtMoney(discount)}` : fmtMoney(0)}</Text>
          <TouchableOpacity disabled={busy} style={styles.removeCoupon} accessibilityRole="button" accessibilityLabel={`Quitar cupón ${couponCode}`}
            onPress={() => { onRemoveCoupon?.(); setCouponError(''); }}><X size={18} color="#6E6E73" /></TouchableOpacity>
        </View>
      </View> : null}

      <Text style={styles.section}>Medio de pago</Text>
      <Text style={styles.caption}>
        Selecciona el método de pago que usará el cliente
      </Text>
      <View style={styles.methods}>
        {METHODS.map(({ id, label, Icon }) => {
          const active = method === id;
          return (
            <TouchableOpacity
              key={id}
              onPress={() => handleMethod(id)}
              disabled={busy}
              hitSlop={4}
              activeOpacity={0.7}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              accessibilityLabel={`Pagar con ${label}`}
              style={[styles.method, active && styles.methodActive]}
            >
              <View
                style={[styles.check, active && styles.checkActive]}
                pointerEvents="none"
              >
                <Check size={12} color={active ? '#064BFF' : '#C7C7CC'} strokeWidth={3} />
              </View>
              <Icon size={22} color={active ? '#fff' : '#000'} />
              <Text style={[styles.methodText, active && styles.methodTextActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={styles.customerSection}>
        <View style={styles.customerHeading}><Text style={styles.section}>Datos del cliente</Text><Text style={styles.optional}>Opcional</Text></View>
        <TextInput style={styles.customerInput} value={customer.name} onChangeText={name => onCustomerChange?.('name', name)}
          placeholder="Nombre" placeholderTextColor="#8E8E93" accessibilityLabel="Nombre del cliente, opcional"
          editable={!busy} maxLength={100} autoCapitalize="words" autoCorrect={false} autoComplete="name" textContentType="name"
          returnKeyType="next" onSubmitEditing={() => phoneInputRef.current?.focus()}
          onFocus={() => scrollRef.current?.scrollToEnd({ animated: true })} />
        <TextInput ref={phoneInputRef} style={styles.customerInput} value={customer.phone} onChangeText={phone => onCustomerChange?.('phone', phone)}
          placeholder="Teléfono" placeholderTextColor="#8E8E93" accessibilityLabel="Teléfono del cliente, opcional"
          editable={!busy} maxLength={30} keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber"
          returnKeyType="done" onSubmitEditing={Keyboard.dismiss}
          onFocus={() => scrollRef.current?.scrollToEnd({ animated: true })} />
      </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
      {error ? <Text style={styles.couponError} accessibilityLiveRegion="polite">{error}</Text> : null}
      <TouchableOpacity
        style={[styles.pay, paymentDisabled && styles.payDisabled]}
        onPress={handleConfirm}
        activeOpacity={0.7}
        disabled={paymentDisabled}
        accessibilityState={{ disabled: paymentDisabled, busy: confirming }}
        accessibilityRole="button"
        accessibilityLabel={`Confirmar pago de ${fmtMoney(total)}`}
      >
        {confirming ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.payText}>Confirmar pago · {fmtMoney(total)}</Text>
        )}
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.cancel}
        onPress={onCancel}
        activeOpacity={0.7}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel="Cancelar cobro y seguir vendiendo"
      >
        <Text style={styles.cancelText}>Cancelar</Text>
      </TouchableOpacity>
      </View>
      <Modal visible={couponOpen} transparent animationType="fade" onRequestClose={closeCoupon}
        onShow={() => couponInputRef.current?.focus()}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={StyleSheet.absoluteFill} disabled={applying} onPress={closeCoupon}
            accessibilityRole="button" accessibilityLabel="Cerrar ingreso de cupón" />
          <View accessibilityViewIsModal style={[styles.couponSheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <View style={styles.modalHeading}>
                <Text style={styles.modalTitle}>Aplicar cupón</Text>
                <TouchableOpacity style={styles.removeCoupon} disabled={applying} onPress={closeCoupon}
                  accessibilityRole="button" accessibilityLabel="Cerrar cupón"><X size={22} color="#111" /></TouchableOpacity>
              </View>
              <Text style={styles.modalDescription}>Ingresa el código para validar y aplicar el descuento.</Text>
              <View style={styles.couponInputRow}>
                <TextInput ref={couponInputRef} style={styles.couponInput} value={draftCode}
                  onChangeText={text => { setDraftCode(text.toUpperCase().replace(/\s+/g, '')); setCouponError(''); }}
                  placeholder="Código del cupón" placeholderTextColor="#8E8E93" autoCapitalize="characters" autoCorrect={false}
                  editable={!busy} returnKeyType="done" onSubmitEditing={applyCoupon} accessibilityLabel="Código del cupón" />
                <TouchableOpacity style={[styles.couponApply, (!draftCode.trim() || busy) && styles.payDisabled]} disabled={!draftCode.trim() || busy}
                  onPress={applyCoupon} accessibilityRole="button" accessibilityLabel="Validar y aplicar cupón"
                  accessibilityState={{ disabled: !draftCode.trim() || busy, busy: applying }}>
                  {applying ? <ActivityIndicator color="#fff" /> : <Text style={styles.couponApplyText}>Aplicar</Text>}
                </TouchableOpacity>
              </View>
              <View style={styles.modalErrorSlot} accessibilityLiveRegion="polite">
                {couponError ? <Text style={styles.couponError}>{couponError}</Text> : null}
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    padding: 20,
    paddingTop: 8,
    paddingBottom: 0,
  },
  header: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  body: { flex: 1, minHeight: 0 },
  bodyContent: { flexGrow: 1, paddingBottom: 8 },
  footer: { flexShrink: 0, paddingTop: 12, backgroundColor: '#F2F2F7' },
  customerSection: { marginTop: 24 },
  customerHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 },
  optional: { fontSize: 12, color: '#8E8E93' },
  customerInput: { minHeight: 50, borderRadius: 14, backgroundColor: '#fff', paddingHorizontal: 14, paddingVertical: 12, color: '#111', fontSize: 15, marginTop: 8 },
  modalOverlay: { flex: 1, backgroundColor: '#0006', justifyContent: 'flex-end', alignItems: 'center' },
  couponSheet: { width: '100%', maxWidth: 500, maxHeight: '90%', borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: '#F2F2F7', padding: 20 },
  modalHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  modalTitle: { flex: 1, fontSize: 22, lineHeight: 28, fontWeight: '800', color: '#111' },
  modalDescription: { fontSize: 14, lineHeight: 20, color: '#6E6E73', marginTop: 4, marginBottom: 12 },
  modalErrorSlot: { minHeight: 44 },
  couponSelected: { backgroundColor: '#000' },
  originalTotal: { fontSize: 18, lineHeight: 24, color: '#8E8E93', textDecorationLine: 'line-through', marginTop: 8 },
  couponCard: { backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 16 },
  couponTitle: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: '#111' },
  couponInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  couponInput: { flex: 1, minWidth: 0, minHeight: 48, backgroundColor: '#F2F2F7', borderRadius: 12, paddingHorizontal: 12, fontSize: 15, color: '#111' },
  couponApply: { minHeight: 48, paddingHorizontal: 16, borderRadius: 12, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  couponApplyText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  couponError: { fontSize: 13, lineHeight: 18, color: '#B42318', marginTop: 8 },
  appliedCoupon: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  couponIdentity: { flex: 1, minWidth: 0 },
  couponHint: { fontSize: 12, lineHeight: 18, color: '#6E6E73', marginTop: 2 },
  discountValue: { fontSize: 15, fontWeight: '700', color: '#111' },
  removeCoupon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  back: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 17, fontWeight: '700', color: '#000' },
  // Sin superficie oscura: el número respira sobre el fondo agrupado
  // y se centra en el espacio libre (§15: display grande, tracking
  // negativo y leading apretado).
  hero: {
    flex: 1,
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  heroLabel: { fontSize: 13, fontWeight: '600', color: '#8E8E93' },
  heroTotal: {
    color: '#000',
    fontSize: 60,
    fontWeight: '800',
    letterSpacing: -2,
    lineHeight: 64,
    marginTop: 4,
  },
  heroSub: { color: '#8E8E93', fontSize: 13, fontWeight: '600', marginTop: 6 },
  heroTax: { color: '#8E8E93', fontSize: 13, fontWeight: '500', marginTop: 2 },
  section: { fontSize: 15, fontWeight: '700', color: '#000', marginBottom: 4 },
  caption: { fontSize: 13, color: '#8E8E93', marginBottom: 10 },
  methods: { flexDirection: 'row', gap: 10 },
  // Objetivos táctiles amplios con feedback instantáneo (§1, §10).
  method: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.06)',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    gap: 8,
  },
  methodActive: { backgroundColor: '#064BFF', borderColor: '#064BFF' },
  // Check chiquito en la esquina: lleno cuando está seleccionado.
  check: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#EFEFF2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkActive: { backgroundColor: '#fff' },
  methodText: { fontSize: 12, fontWeight: '700', color: '#000' },
  methodTextActive: { color: '#fff' },
  // Acción primaria flotante en jerarquía (§12): sombra que la
  // separa del contenido; háptico al confirmar (§13).
  pay: {
    backgroundColor: '#000',
    borderRadius: 16,
    minHeight: 54,
    flexShrink: 0,
    paddingHorizontal: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  payDisabled: { opacity: 0.5 },
  payText: { color: '#fff', fontWeight: '700', fontSize: 17 },
  // Acción secundaria: superficie neutra, no compite con Confirmar.
  cancel: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    borderRadius: 16,
    minHeight: 48,
    flexShrink: 0,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  cancelText: { color: '#000', fontWeight: '600', fontSize: 16 },
});
