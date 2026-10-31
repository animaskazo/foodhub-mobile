import Image from './SkeletonImage';
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { fmtMoney } from '../lib/store';

export default React.memo(function PosProductCard({ product: p, inCart, onAdd, onOpen }) {
  return (
    <View style={styles.card}>
      <TouchableOpacity
        onPress={() => onAdd(p)}
        onLongPress={() => onOpen(p)}
        delayLongPress={450}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`Agregar ${p.name}, ${fmtMoney(p.price)}${inCart > 0 ? `, ${inCart} en el pedido` : ''}`}
        accessibilityHint="Mantén presionado para ver el detalle del producto"
        accessibilityActions={[{ name: 'showDetails', label: 'Ver detalle del producto' }]}
        onAccessibilityAction={event => {
          if (event.nativeEvent.actionName === 'showDetails') onOpen(p);
        }}
        style={styles.cardTouch}
      >
        {p.image ? (
          <Image source={{ uri: p.image }} style={styles.cardImage} />
        ) : (
          <View style={[styles.cardImage, styles.cardFallback]}>
            <Text style={styles.cardFallbackText}>
              {(p.name || '?').charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <Svg
          style={StyleSheet.absoluteFill}
          width="100%"
          height="100%"
          preserveAspectRatio="xMidYMax slice"
          pointerEvents="none"
        >
          <Defs>
            <LinearGradient id={`cardShade-${p.id}`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#000" stopOpacity="0" />
              <Stop offset="0.45" stopColor="#000" stopOpacity="0" />
              <Stop offset="1" stopColor="#000" stopOpacity="0.75" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill={`url(#cardShade-${p.id})`} />
        </Svg>
        <View style={styles.cardInfo} pointerEvents="none">
          <Text style={styles.cardName} numberOfLines={2}>
            {p.name}
          </Text>
          <Text style={styles.cardPrice}>{fmtMoney(p.price)}</Text>
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => onAdd(p)}
        hitSlop={8}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={
          inCart > 0
            ? `Agregar ${p.name}, ${inCart} en el pedido`
            : `Agregar ${p.name} al pedido`
        }
        style={[styles.quickAdd, inCart > 0 && styles.quickAddActive]}
      >
        <Text style={[styles.quickAddText, inCart > 0 && styles.quickAddTextActive]}>
          {inCart > 0 ? `+ ${inCart}` : '+'}
        </Text>
      </TouchableOpacity>
    </View>
    );
});
const styles = StyleSheet.create({
  card: {
    flex: 1,
    aspectRatio: 1,
    backgroundColor: '#F2F2F7',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 10,
    marginHorizontal: 2,
  },
  cardTouch: { flex: 1 },
  cardImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F2F2F7',
  },
  cardFallback: { alignItems: 'center', justifyContent: 'center' },
  cardFallbackText: { fontSize: 32, fontWeight: '800', color: '#8E8E93' },
  cardInfo: {
    position: 'absolute',
    left: 10,
    right: 48,
    bottom: 10,
  },
  cardName: { fontSize: 13, fontWeight: '700', color: '#fff' },
  cardPrice: { fontSize: 14, fontWeight: '800', color: '#fff', marginTop: 2 },
  // Agregar rápido: negro primario (§16), algo más compacto.
  // Posición absoluta como hermano: no anida zonas táctiles.
  quickAdd: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickAddText: { color: '#fff', fontSize: 19, fontWeight: '700', marginTop: -2 },
  // Con unidades en el pedido el + crece a chip blanco con el conteo.
  quickAddActive: {
    backgroundColor: '#fff',
    width: undefined,
    minWidth: 58,
    paddingHorizontal: 12,
  },
  quickAddTextActive: { color: '#000', fontSize: 15, fontWeight: '800', marginTop: 0 },
});
