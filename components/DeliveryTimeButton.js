import React, { useRef, useState } from 'react';
import { View, Text, Pressable, Modal, ScrollView, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, StyleSheet } from 'react-native';
import { Clock3, ChevronDown, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function DeliveryTimeButton({ value, disabled, onSave }) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  function close() { if (!pending.current) setOpen(false); }
  async function save() {
    if (pending.current) return;
    const minutes = Number(draft);
    if (!/^\d+$/.test(draft) || !Number.isInteger(minutes) || minutes > 240) {
      setError('Ingresa un tiempo entre 0 y 240 minutos.');
      return;
    }
    pending.current = true;
    setSaving(true);
    setError('');
    try {
      await onSave(minutes);
      setOpen(false);
    } catch (err) {
      setError(err.message || 'No se pudo guardar el tiempo.');
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }
  return <>
    <Pressable disabled={disabled} accessibilityRole="button" accessibilityLabel={`Cambiar tiempo de entrega: ${value ?? 0} minutos`}
      accessibilityState={{ disabled, expanded: open }} style={({ pressed }) => [s.trigger, pressed && { opacity: 0.65 }]}
      onPress={() => { setDraft(String(value ?? 0)); setError(''); setOpen(true); }}>
      <Clock3 size={17} color="#111" />
      <Text style={s.triggerText}>{value ?? 0} min</Text>
      <ChevronDown size={14} color="#6E6E73" />
    </Pressable>
    <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
      <KeyboardAvoidingView style={s.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityRole="button" accessibilityLabel="Cerrar tiempo de entrega" disabled={saving} />
        <View accessibilityViewIsModal style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={s.heading}>
              <Text style={s.title}>Tiempo de entrega</Text>
              <Pressable style={s.close} onPress={close} disabled={saving} accessibilityRole="button" accessibilityLabel="Cerrar"><X size={22} color="#111" /></Pressable>
            </View>
            <Text style={s.description}>Define los minutos estimados para entregar tus pedidos.</Text>
            <View style={s.options}>
              {[0, 15, 20, 25, 30, 45, 60, 90].map(minutes => <Pressable key={minutes} disabled={saving}
                accessibilityRole="button" accessibilityState={{ selected: draft === String(minutes), disabled: saving }}
                onPress={() => { setDraft(String(minutes)); setError(''); }}
                style={[s.option, draft === String(minutes) && s.selected]}>
                <Text style={[s.optionText, draft === String(minutes) && s.white]}>{minutes === 0 ? 'Sin espera' : `${minutes} min`}</Text>
              </Pressable>)}
            </View>
            <Text style={s.label}>Personalizar en minutos</Text>
            <TextInput value={draft} onChangeText={text => { setDraft(text); setError(''); }} editable={!saving}
              style={s.input} keyboardType="number-pad" maxLength={3} selectTextOnFocus
              accessibilityLabel="Tiempo de entrega en minutos" placeholder="Ej. 35" />
            <View style={s.errorSlot} accessibilityLiveRegion="polite">{error ? <Text style={s.error}>{error}</Text> : null}</View>
            <Pressable disabled={saving} onPress={save} style={s.save} accessibilityRole="button" accessibilityLabel="Guardar tiempo de entrega" accessibilityState={{ disabled: saving, busy: saving }}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveText}>Guardar</Text>}
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  </>;
}

const s = StyleSheet.create({
  trigger: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: 12, borderRadius: 22, backgroundColor: '#fff' },
  triggerText: { fontSize: 13, fontWeight: '600', color: '#111' },
  overlay: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', backgroundColor: '#0006' },
  sheet: { width: '100%', maxWidth: 500, maxHeight: '90%', padding: 20, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: '#F2F2F7' },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { flex: 1, fontSize: 22, lineHeight: 28, fontWeight: '800', color: '#111' },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  description: { fontSize: 14, lineHeight: 20, color: '#6E6E73', marginTop: 4, marginBottom: 20 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  option: { minHeight: 44, paddingHorizontal: 16, borderRadius: 22, justifyContent: 'center', backgroundColor: '#fff' },
  selected: { backgroundColor: '#000' }, optionText: { fontSize: 14, fontWeight: '600', color: '#111' }, white: { color: '#fff' },
  label: { fontSize: 13, fontWeight: '600', color: '#6E6E73', marginBottom: 8 },
  input: { minHeight: 52, backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 16, fontSize: 18, color: '#111' },
  errorSlot: { minHeight: 40, paddingVertical: 8 }, error: { fontSize: 13, lineHeight: 18, color: '#B42318' },
  save: { minHeight: 52, backgroundColor: '#000', borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  saveText: { fontSize: 16, fontWeight: '600', color: '#fff' },
});
