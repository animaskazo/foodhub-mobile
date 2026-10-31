import Image from '../components/SkeletonImage';
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
} from 'react-native';
import { Check } from 'lucide-react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { fmtMoney, peekMyStore } from '../lib/store';
import { peekCategories, getProductOptions, peekProductOptions } from '../lib/pos';
import { ProductOptionsSkeleton, SkeletonSlot, Bone } from '../components/Skeleton';

// Detalle del producto en pageSheet nativo:
// hero con la foto como fondo + blur y el contenido encima
// (precio y descripción pequeña sobre el blur), variantes/extras
// debajo. Sin cantidad: cada apertura agrega 1 unidad; para más,
// el mesero reabre el producto o multiplica desde el carrito.
export default function ProductSheet({ visible, onClose, product, onAdd, initialSelection = null, editing = false, quantity = 1 }) {
  const productId = product?.id;
  const [options, setOptions] = useState(() =>
    product ? peekProductOptions(product.id) || { groups: [], extras: [] } : { groups: [], extras: [] }
  );
  const [loadingOptions, setLoadingOptions] = useState(() => !!product && !peekProductOptions(product.id));
  const [selected, setSelected] = useState(() => initialVariants(initialSelection, product ? peekProductOptions(product.id)?.groups : []));
  const [optionsError, setOptionsError] = useState('');
  const [retry, setRetry] = useState(0);
  const [extrasPicked, setExtrasPicked] = useState(() => (initialSelection?.extras || []).map(extra => extra.id));

  useEffect(() => {
    if (!visible || !productId) return;
    const cached = peekProductOptions(productId);
    let alive = true;
    getProductOptions(productId)
      .then((data) => {
        if (!alive) return;
        setOptions(data);
        // No pisar lo ya elegido por el mesero si el fetch llega tarde:
        // se conservan selecciones válidas y solo se rellenan los
        // grupos obligatorios aún sin elegir.
        setSelected((prev) => mergeWithDefaults(prev, data.groups));
        setExtrasPicked((prev) => {
          const valid = new Set((data.extras || []).map((e) => e.id));
          return prev.filter((id) => valid.has(id));
        });
      })
      .catch(() => { if (alive && !cached) setOptionsError('No se pudieron cargar las opciones.'); })
      .finally(() => {
        if (alive) setLoadingOptions(false);
      });
    return () => {
      alive = false;
    };
  }, [visible, productId, retry]);

  if (!product) return null;

  // Primera categoría del producto para el caption superior.
  let categoryName = null;
  try {
    const s = peekMyStore();
    const cats = (s && peekCategories(s.org?.id)) || [];
    const ids = product?.categoryIds || [];
    categoryName = cats.find((c) => ids.includes(c.id))?.name || null;
  } catch {}

  const toggleVariant = (group, option) => {
    Haptics.selectionAsync().catch(() => {});
    setSelected((prev) => {
      if (prev[group.id] === option.id) {
        if (group.required) return prev;
        const next = { ...prev };
        delete next[group.id];
        return next;
      }
      return { ...prev, [group.id]: option.id };
    });
  };

  const toggleExtra = (extra) => {
    Haptics.selectionAsync().catch(() => {});
    setExtrasPicked((prev) =>
      prev.includes(extra.id) ? prev.filter((id) => id !== extra.id) : [...prev, extra.id]
    );
  };

  const chosenVariants = (options.groups || [])
    .map((g) => {
      const opt = g.options.find((o) => o.id === selected[g.id]);
      if (!opt) return null;
      return {
        groupId: g.id,
        groupName: g.name,
        optionId: opt.id,
        optionName: opt.name,
        price: opt.price,
      };
    })
    .filter(Boolean);

  const chosenExtras = (options.extras || []).filter((e) => extrasPicked.includes(e.id));

  const unitPrice = Math.max(
    0,
    Number(product.price || 0) +
      chosenVariants.reduce((acc, v) => acc + Number(v.price || 0), 0) +
      chosenExtras.reduce((acc, e) => acc + Number(e.price || 0), 0)
  );

  const groups = options.groups || [];
  const extras = options.extras || [];
  const hasOptions = groups.length > 0 || extras.length > 0;
  const missingRequired = groups.some((g) => g.required && !selected[g.id]);
  // No dejar agregar a ciegas mientras las opciones aún cargan:
  // si ya hay datos (caché), se puede elegir aunque revalide por detrás.
  const optionsReady = !optionsError && (!loadingOptions || hasOptions);
  const addDisabled = missingRequired || !optionsReady;
  // Transparencia del precio: cuánto suman las opciones sobre la base.
  const optionsDelta = unitPrice - Math.max(0, Math.round(Number(product.price) || 0));

  const handleAdd = () => {
    if (addDisabled) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onAdd(product, editing ? quantity : 1, {
      variants: chosenVariants,
      extras: chosenExtras.map((e) => ({ id: e.id, name: e.name, price: e.price })),
      unitPrice,
    });
    onClose();
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
        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            {product.image ? (
              <>
                <Image
                  source={{ uri: product.image }}
                  style={StyleSheet.absoluteFill}
                  resizeMode="cover"
                  accessibilityRole="image"
                  accessibilityLabel={`Foto de ${product.name}`}
                />
                {/* Degradado real sobre la foto: el texto asienta abajo. */}
                <Svg
                  style={StyleSheet.absoluteFill}
                  width="100%"
                  height="100%"
                  preserveAspectRatio="xMidYMax slice"
                  pointerEvents="none"
                >
                  <Defs>
                    <LinearGradient id="heroShade" x1="0" y1="0" x2="0" y2="1">
                      <Stop offset="0" stopColor="#F2F2F7" stopOpacity="0" />
                      <Stop offset="0.55" stopColor="#F2F2F7" stopOpacity="1" />
                      <Stop offset="1" stopColor="#F2F2F7" stopOpacity="1" />
                    </LinearGradient>
                  </Defs>
                  <Rect x="0" y="0" width="100%" height="100%" fill="url(#heroShade)" />
                </Svg>
              </>
            ) : (
              <View style={[StyleSheet.absoluteFill, styles.heroFallback]} />
            )}
            <View style={styles.heroContent}>
              {categoryName ? <Text style={styles.kicker}>{categoryName}</Text> : null}
              <Text style={styles.name}>{product.name}</Text>
              <Text style={styles.price}>{fmtMoney(product.price)}</Text>
              {product.description ? (
                <Text style={styles.description}>{product.description}</Text>
              ) : null}
            </View>
          </View>

          <View style={styles.options}>
            <Text style={styles.bodyHint}>{editing ? `Editando ${quantity} ${quantity === 1 ? 'unidad' : 'unidades'} del pedido.` : 'Agrega de a 1 · multiplica desde el carrito.'}</Text>
            {loadingOptions ? (
              <ProductOptionsSkeleton />
            ) : optionsError ? (
              <View style={styles.optionsError}>
                <Text style={styles.optionsErrorText}>{optionsError}</Text>
                <TouchableOpacity onPress={() => { setLoadingOptions(true); setOptionsError(''); setRetry(value => value + 1); }} style={styles.retry} accessibilityRole="button"><Text>Reintentar</Text></TouchableOpacity>
              </View>
            ) : !hasOptions ? (
              <Text style={styles.noOptions}>Sin opciones adicionales.</Text>
            ) : (
              <>
                {groups.map((g) => {
                  const missing = g.required && !selected[g.id];
                  return (
                  <View key={g.id} style={styles.groupFlat}>
                    <View style={styles.groupHeader}>
                      <Text style={styles.groupTitle}>{g.name}</Text>
                      {missing ? (
                        <Text style={[styles.groupBadge, styles.groupBadgeMissing]}>Falta elegir</Text>
                      ) : (
                        <Text style={[styles.groupBadge, g.required && styles.groupBadgeRequired]}>
                          {g.required ? 'Obligatorio' : 'Opcional'}
                        </Text>
                      )}
                    </View>
                    <View style={styles.optionList}>
                      {g.options.map((o) => {
                        const active = selected[g.id] === o.id;
                        return (
                          <TouchableOpacity
                            key={o.id}
                            onPress={() => toggleVariant(g, o)}
                            activeOpacity={0.7}
                            accessibilityRole="radio"
                            accessibilityState={{ checked: active }}
                            accessibilityLabel={`${o.name}, ${formatDelta(o.price)}`}
                            style={[styles.option, active && styles.optionActive]}
                          >
                            <View style={[styles.radio, active && styles.radioActive]} pointerEvents="none">
                              {active ? <Check size={12} color="#fff" strokeWidth={3} /> : null}
                            </View>
                            <Text style={[styles.optionName, active && styles.optionNameActive]} numberOfLines={2}>
                              {o.name}
                            </Text>
                            <Text style={[styles.optionPrice, active && styles.optionPriceActive]}>
                              {formatDelta(o.price)}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                  );
                })}

                {extras.length > 0 ? (
                  <View style={styles.groupFlat}>
                    <View style={styles.groupHeader}>
                      <Text style={styles.groupTitle}>Extras</Text>
                      <Text style={[styles.groupBadge, extrasPicked.length > 0 && styles.groupBadgeRequired]}>
                        {extrasPicked.length > 0 ? `${extrasPicked.length} elegidos` : 'Opcional'}
                      </Text>
                    </View>
                    <View style={styles.optionList}>
                      {extras.map((e) => {
                        const active = extrasPicked.includes(e.id);
                        return (
                          <TouchableOpacity
                            key={e.id}
                            onPress={() => toggleExtra(e)}
                            activeOpacity={0.7}
                            accessibilityRole="checkbox"
                            accessibilityState={{ checked: active }}
                            accessibilityLabel={`${e.name}, ${formatDelta(e.price)}`}
                            style={[styles.option, active && styles.optionActive]}
                          >
                            <View style={[styles.checkbox, active && styles.checkboxActive]} pointerEvents="none">
                              {active ? <Check size={12} color="#fff" strokeWidth={3} /> : null}
                            </View>
                            <Text style={[styles.optionName, active && styles.optionNameActive]} numberOfLines={2}>
                              {e.name}
                            </Text>
                            <Text style={[styles.optionPrice, active && styles.optionPriceActive]}>
                              {formatDelta(e.price)}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                ) : null}
              </>
            )}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          {optionsDelta !== 0 ? (
            <Text style={styles.breakdown} numberOfLines={2}>
              Base {fmtMoney(product.price)}
              {optionsDelta > 0
                ? `  +  ${fmtMoney(optionsDelta)} en opciones`
                : `  −  ${fmtMoney(-optionsDelta)} en opciones`}
            </Text>
          ) : null}
          <TouchableOpacity
            style={[styles.add, addDisabled && styles.addDisabled]}
            onPress={handleAdd}
            activeOpacity={0.7}
            disabled={addDisabled}
            accessibilityRole="button"
            accessibilityLabel={editing ? 'Guardar cambios del producto' : `Agregar 1 al pedido, ${fmtMoney(unitPrice)}`}
          >
            <SkeletonSlot loading={loadingOptions} placeholder={<Bone width={160} height={20} />}>
              <Text style={styles.addText}>{optionsError ? 'Opciones no disponibles' : `${editing ? 'Guardar cambios' : 'Agregar'} · ${fmtMoney(unitPrice * (editing ? quantity : 1))}`}</Text>
            </SkeletonSlot>
          </TouchableOpacity>
          {missingRequired ? (
            <Text style={styles.requiredHint}>Elige la opción obligatoria para continuar.</Text>
          ) : null}
          <TouchableOpacity
            style={styles.cancel}
            onPress={onClose}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Cancelar y volver"
          >
            <Text style={styles.cancelText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function initialVariants(selection, groups) {
  const selected = Object.fromEntries((selection?.variants || []).map(variant => [variant.groupId, variant.optionId]));
  return groups ? mergeWithDefaults(selected, groups) : selected;
}

// Fusiona la selección actual con los grupos recién cargados:
// mantiene lo elegido si la opción sigue existiendo y completa
// los obligatorios faltantes con su primera opción.
function mergeWithDefaults(prev, groups) {
  const next = { ...(prev || {}) };
  (groups || []).forEach((g) => {
    const stillValid = (g.options || []).some((o) => o.id === next[g.id]);
    if (!stillValid) {
      if (g.required && g.options?.length > 0) next[g.id] = g.options[0].id;
      else delete next[g.id];
    }
  });
  return next;
}

function formatDelta(price) {
  const n = Math.round(Number(price) || 0);
  if (n === 0) return 'Base';
  const abs = fmtMoney(Math.abs(n));
  return n > 0 ? `+${abs}` : `−${abs}`;
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
  body: { flex: 1 },
  bodyContent: { paddingBottom: 16 },
  // Hero: foto a sangre con degradado al color del lienzo, contenido encima.
  hero: { minHeight: 320, justifyContent: 'flex-end', overflow: 'hidden', backgroundColor: '#F2F2F7' },
  heroFallback: { backgroundColor: '#F2F2F7' },
  heroContent: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 20 },
  // Jerarquía sobre el blur (§15): kicker tenue, nombre blanco,
  // precio destacado y descripción pequeña.
  kicker: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(0, 0, 0, 0.5)',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  name: {
    fontSize: 24,
    fontWeight: '800',
    color: '#000',
    letterSpacing: -0.5,
  },
  price: {
    fontSize: 17,
    fontWeight: '800',
    color: '#000',
    letterSpacing: -0.2,
    marginTop: 6,
  },
  description: {
    fontSize: 13,
    color: 'rgba(0, 0, 0, 0.65)',
    lineHeight: 18,
    marginTop: 6,
  },
  options: { paddingHorizontal: 16, paddingTop: 12 },
  optionsError: { alignItems: 'center', padding: 16 },
  optionsErrorText: { fontSize: 13, color: '#B42318' },
  retry: { minHeight: 44, justifyContent: 'center' },
  noOptions: { fontSize: 13, color: '#8E8E93', textAlign: 'center', paddingVertical: 12 },
  // Grupos directo sobre el lienzo: sin tarjeta, solo título + opciones.
  groupFlat: { marginBottom: 20 },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    marginLeft: 4,
  },
  groupTitle: { fontSize: 15, fontWeight: '700', color: '#000' },
  groupBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8E8E93',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.06)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
  },
  groupBadgeRequired: { color: '#000', borderColor: 'rgba(0, 0, 0, 0.12)' },
  groupBadgeMissing: { color: '#fff', backgroundColor: '#FF3B30', borderColor: '#FF3B30' },
  optionList: { gap: 8 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    minHeight: 52,
    gap: 10,
  },
  // Selección liviana: solo borde negro + check, sin relleno pesado.
  optionActive: { backgroundColor: '#fff', borderColor: '#000' },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: { backgroundColor: '#000', borderColor: '#fff' },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: { backgroundColor: '#000', borderColor: '#fff' },
  optionName: { flex: 1, fontSize: 14, fontWeight: '600', color: '#000' },
  optionNameActive: { fontWeight: '700' },
  optionPrice: { fontSize: 13, fontWeight: '700', color: '#8E8E93' },
  optionPriceActive: { color: '#000' },
  // Footer fijo: la acción siempre visible, con borde superior
  // que la separa del contenido que pasa por debajo.
  footer: {
    padding: 16,
    paddingBottom: 28,
    backgroundColor: '#F2F2F7',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5EA',
  },
  add: {
    backgroundColor: '#000',
    borderRadius: 16,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addDisabled: { opacity: 0.4 },
  addText: { color: '#fff', fontWeight: '700', fontSize: 17 },
  // Desglose base + opciones: el total nunca es una sorpresa.
  breakdown: { fontSize: 12, color: '#8E8E93', textAlign: 'center', marginBottom: 8 },
  requiredHint: { fontSize: 12, color: '#FF3B30', textAlign: 'center', marginTop: 8 },
  // Aviso de "de a 1": vive en el cuerpo, sobre las opciones,
  // para no competir con la acción del footer.
  bodyHint: { fontSize: 12, color: '#8E8E93', marginLeft: 4, marginBottom: 10 },
  // Acción secundaria: superficie neutra, no compite con Agregar.
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
