import React, { useState } from 'react';
import { View, Text, Pressable, Modal, ScrollView, StyleSheet } from 'react-native';
import { CalendarDays, ChevronLeft, ChevronRight, ChevronDown, Check, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { dateKey, localDate, presetRange, rangeLabel } from '../lib/dateRange';

export default function DateRangeFilter({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(false);
  const [draft, setDraft] = useState(value);
  const [choosingEnd, setChoosingEnd] = useState(false);
  const [month, setMonth] = useState(() => localDate(value.end));
  const insets = useSafeAreaInsets();
  const today = dateKey(new Date());
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const blanks = (first.getDay() + 6) % 7;
  const canNext = month.getFullYear() < new Date().getFullYear() || month.getMonth() < new Date().getMonth();
  function show() {
    setDraft(value); setMonth(localDate(value.end)); setChoosingEnd(false); setCustom(false); setOpen(true);
  }
  function choose(key) {
    if (!choosingEnd || key < draft.start) {
      setDraft({ start: key, end: key, days: null }); setChoosingEnd(true);
    } else {
      setDraft({ start: draft.start, end: key, days: null }); setChoosingEnd(false);
    }
  }
  const button = (label, action, selected, key = label) => <Pressable key={key} accessibilityRole="button"
    accessibilityState={{ selected }} onPress={action} style={({ pressed }) => [s.chip, selected && s.selected, pressed && { opacity: 0.65 }]}>
    <Text style={[s.chipText, selected && s.white]}>{label}</Text>
  </Pressable>;
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel={`Filtrar por fecha: ${rangeLabel(value)}`}
      accessibilityState={{ expanded: open }} onPress={show}
      style={({ pressed }) => [s.trigger, pressed && { opacity: 0.65 }]}>
      <CalendarDays size={17} color="#1C1C1E" />
      <Text style={s.triggerText}>{rangeLabel(value)}</Text>
      <ChevronDown size={16} color="#6E6E73" />
    </Pressable>
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
      <View style={s.overlay}>
        <Pressable style={StyleSheet.absoluteFill} accessibilityLabel="Cancelar selección de fechas" onPress={() => setOpen(false)} />
        <View accessibilityViewIsModal style={[s.sheet, { paddingBottom: Math.max(20, insets.bottom) }]}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={s.heading}><Text style={s.title}>Filtrar por fecha</Text><Pressable accessibilityRole="button" accessibilityLabel="Cerrar filtro" style={s.nav} onPress={() => setOpen(false)}><X size={20} /></Pressable></View>
            {!custom ? <View style={s.options}>
              {[1, 7, 30, 90].map(days => (
                <Pressable key={days} accessibilityRole="button" accessibilityState={{ selected: value.days === days }}
                  onPress={() => { onChange(presetRange(days)); setOpen(false); }}
                  style={({ pressed }) => [s.option, pressed && { backgroundColor: '#E3E3E8' }]}>
                  <Text style={s.optionText}>{days === 1 ? 'Hoy' : `Últimos ${days} días`}</Text>
                  {value.days === days && <Check size={19} color="#1C1C1E" />}
                </Pressable>
              ))}
              <Pressable accessibilityRole="button" onPress={() => setCustom(true)} style={({ pressed }) => [s.option, pressed && { backgroundColor: '#E3E3E8' }]}>
                <Text style={s.optionText}>Rango personalizado</Text>
                <ChevronRight size={19} color="#6E6E73" />
              </Pressable>
            </View> : <>
            <Pressable accessibilityRole="button" onPress={() => setCustom(false)} style={s.back}>
              <ChevronLeft size={16} color="#6E6E73" /><Text style={s.help}>Volver a períodos rápidos</Text>
            </Pressable>
            <View style={s.dates}>
              {button(`Desde · ${draft.start.split('-').reverse().join('/')}`, () => setChoosingEnd(false), !choosingEnd)}
              {button(`Hasta · ${draft.end.split('-').reverse().join('/')}`, () => setChoosingEnd(true), choosingEnd)}
            </View>
            <View style={s.heading}>
              <Pressable accessibilityRole="button" accessibilityLabel="Mes anterior" style={s.nav} onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft size={22} /></Pressable>
              <Text style={s.month}>{month.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' })}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Mes siguiente" accessibilityState={{ disabled: !canNext }} disabled={!canNext} style={[s.nav, !canNext && { opacity: 0.25 }]} onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight size={22} /></Pressable>
            </View>
            <View style={s.grid}>{['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((day, i) => <View key={i} style={s.cell}><Text style={s.weekday}>{day}</Text></View>)}</View>
            <View style={s.grid}>
              {Array.from({ length: blanks }, (_, i) => <View key={`blank-${i}`} style={s.cell} />)}
              {Array.from({ length: count }, (_, i) => {
                const key = dateKey(new Date(month.getFullYear(), month.getMonth(), i + 1));
                const selected = key === draft.start || key === draft.end;
                const inside = key > draft.start && key < draft.end;
                return <Pressable key={key} accessibilityRole="button" accessibilityLabel={localDate(key).toLocaleDateString('es-CL', { dateStyle: 'full' })}
                  accessibilityState={{ selected, disabled: key > today }} disabled={key > today} onPress={() => choose(key)}
                  style={[s.cell, inside && s.inside, selected && s.selected, key > today && { opacity: 0.25 }]}><Text style={[s.day, selected && s.white]}>{i + 1}</Text></Pressable>;
              })}
            </View>
            <Text style={s.help}>{choosingEnd ? 'Elige la fecha final. Puedes usar el mismo día.' : 'Elige una fecha inicial para comenzar un nuevo rango.'}</Text>
            <Pressable accessibilityRole="button" style={s.apply} onPress={() => { onChange({ ...draft, days: null }); setOpen(false); }}><Text style={s.applyText}>Aplicar rango</Text></Pressable>
            </>}
          </ScrollView>
        </View>
      </View>
    </Modal>
  </>;
}
const s = StyleSheet.create({
  trigger: { alignSelf: 'center', flexShrink: 1, maxWidth: '65%', flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, borderRadius: 22, paddingHorizontal: 14, backgroundColor: '#fff' },
  triggerText: { color: '#1C1C1E', fontSize: 13, fontWeight: '600', flexShrink: 1 },
  options: { backgroundColor: '#fff', borderRadius: 18, overflow: 'hidden' },
  option: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 54, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F2F2F7' },
  optionText: { fontSize: 16, fontWeight: '500', color: '#1C1C1E' },
  back: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, marginBottom: 8 },
  chip: { minHeight: 40, borderRadius: 20, paddingHorizontal: 10, flexShrink: 1, justifyContent: 'center', backgroundColor: '#fff' }, chipText: { fontSize: 12, fontWeight: '600', color: '#3A3A3C' }, selected: { backgroundColor: '#1C1C1E', borderRadius: 20 }, white: { color: '#fff' }, overlay: { flex: 1, backgroundColor: '#0006', justifyContent: 'flex-end', alignItems: 'center' }, sheet: { width: '100%', maxWidth: 500, maxHeight: '90%', borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: '#F2F2F7', padding: 20 }, heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }, title: { fontSize: 22, fontWeight: '800' }, nav: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, dates: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }, month: { fontSize: 16, fontWeight: '700', textTransform: 'capitalize' }, grid: { flexDirection: 'row', flexWrap: 'wrap' }, cell: { width: '14.285714%', minHeight: 42, justifyContent: 'center', alignItems: 'center' }, weekday: { color: '#8E8E93', fontSize: 12, fontWeight: '600' }, day: { fontSize: 15, fontWeight: '600', color: '#1C1C1E' }, inside: { backgroundColor: '#E3E3E8' }, help: { fontSize: 12, color: '#6E6E73', marginVertical: 16, lineHeight: 18 }, apply: { backgroundColor: '#1C1C1E', minHeight: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' }, applyText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
