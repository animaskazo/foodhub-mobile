import ScreenHeader from './ScreenHeader';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing, AccessibilityInfo, AppState, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TAB_BAR_CLEARANCE } from './TabBar';
import OrderRow from './OrderRow';

const SkeletonOpacity = createContext(null);

// One shared pulse avoids a separate animation and listener for every bone.
export function SkeletonProvider({ children }) {
  const [opacity] = useState(() => new Animated.Value(0.45));
  const [reduceMotion, setReduceMotion] = useState(true);
  const [active, setActive] = useState(AppState.currentState !== 'background');
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then(value => { if (mounted) setReduceMotion(value); });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    const appSub = AppState.addEventListener('change', state => setActive(state === 'active'));
    return () => { mounted = false; sub.remove(); appSub.remove(); };
  }, []);
  useEffect(() => {
    if (reduceMotion || !active) { opacity.setValue(0.65); return; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 750,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: Platform.OS !== 'web',
          isInteraction: false,
        }),
        Animated.timing(opacity, {
          toValue: 0.45,
          duration: 750,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: Platform.OS !== 'web',
          isInteraction: false,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity, reduceMotion, active]);
  return <SkeletonOpacity.Provider value={opacity}>{children}</SkeletonOpacity.Provider>;
}

export function Bone({ width, height, radius = 8, style }) {
  const opacity = useContext(SkeletonOpacity) ?? 0.65;
  return (
    <Animated.View
      accessible={false}
      importantForAccessibility="no"
      style={[{ width, height, borderRadius: radius, backgroundColor: '#E3E3E8', opacity }, style]}
    />
  );
}

// Keep real content mounted so loading never collapses or repositions its frame.
export function SkeletonSlot({ loading, children, placeholder, style }) {
  return <View style={style} accessibilityState={{ busy: loading }}>
    <View style={loading && { opacity: 0 }} pointerEvents={loading ? 'none' : 'auto'}
      accessibilityElementsHidden={loading} importantForAccessibility={loading ? 'no-hide-descendants' : 'auto'}>
      {children}
    </View>
    {loading && <View pointerEvents="none" style={StyleSheet.absoluteFill} accessible={false}>
      {placeholder || <Bone radius={6} style={StyleSheet.absoluteFill} />}
    </View>}
  </View>;
}

export function DashboardSalesPlaceholder() {
  return <View style={{ ...StyleSheet.absoluteFillObject, bottom: 16, borderRadius: 20, backgroundColor: '#fff', padding: 17 }}>
    <Bone width={96} height={13} style={{ marginTop: 2 }} />
    <Bone width="55%" height={34} style={{ marginTop: 5 }} />
    <Bone width="65%" height={11} style={{ marginTop: 8 }} />
    <View style={{ flexDirection: 'row', gap: 24, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E5E5EA', paddingTop: 12, marginTop: 12 }}>
      {[0, 1].map(index => (
        <View key={index} style={{ flex: 1, gap: 6 }}>
          <Bone width="65%" height={20} />
          <Bone width="75%" height={14} />
        </View>
      ))}
    </View>
  </View>;
}

export function OrderRowPlaceholder() {
  return <View style={{ ...StyleSheet.absoluteFillObject, paddingVertical: 16, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff' }}>
    <View style={{ flex: 1, marginRight: 24 }}>
      <Bone width="48%" height={18} style={{ marginVertical: 3 }} />
      <Bone width="85%" height={13} style={{ marginTop: 3, marginBottom: 2 }} />
      <Bone width={90} height={13} style={{ marginTop: 6, marginBottom: 2 }} />
      <Bone width={84} height={26} radius={13} style={{ marginTop: 8 }} />
    </View>
    <Bone width={64} height={15} />
    <Bone width={12} height={12} style={{ marginLeft: 8 }} />
  </View>;
}

function ListRows({ count = 4 }) {
  return (
    <View style={styles.card}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonSlot key={i} loading placeholder={<OrderRowPlaceholder />}>
          <OrderRow order={{ id: `skeleton-${i}`, order_number: '#0000', created_at: '2026-01-01T12:00:00Z', total: 0, status: 'paid' }} first={i === 0} last={i === count - 1} />
        </SkeletonSlot>
      ))}
    </View>
  );
}

// Resumen: header + hero + lista. Mismos paddings que la vista real.
export function DashboardSkeleton() {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.dash}>
      <Bone height={110 + insets.top} radius={0} style={{ marginHorizontal: -16, marginTop: -16, marginBottom: 12 }} />
      <View style={styles.dashHeader}>
        <Bone width={48} height={48} radius={24} />
        <View style={styles.dashHeaderText}>
          <Bone width="70%" height={22} radius={6} />
          <View style={styles.gap6} />
          <Bone width="50%" height={13} radius={6} />
        </View>
        <Bone width={36} height={36} radius={18} />
      </View>
      <View style={styles.dashHero}>
        <Bone width="40%" height={13} radius={6} />
        <Bone height={40} radius={8} style={styles.mt8} />
        <Bone width="55%" height={12} radius={6} style={styles.mt8} />
        <View style={styles.dashStats}>
          <View style={styles.dashStat}>
            <Bone width="50%" height={17} radius={6} />
            <View style={styles.gap6} />
            <Bone width="80%" height={12} radius={6} />
          </View>
          <View style={styles.dashSep} />
          <View style={styles.dashStat}>
            <Bone width="60%" height={17} radius={6} />
            <View style={styles.gap6} />
            <Bone width="75%" height={12} radius={6} />
          </View>
        </View>
      </View>
      <Bone width={130} height={15} radius={6} style={styles.section} />
      <ListRows count={4} />
    </View>
  );
}

// Pedidos: título + acceso a búsqueda + lista.
export function SalesSkeleton() {
  return (
    <View style={styles.sales}>
      <ScreenHeader title="Pedidos" description="Revisa y gestiona tus pedidos."
        action={<Bone width={44} height={44} radius={22} />} />
      <View style={styles.salesSection}>
        <Bone width={160} height={28} radius={6} />
        <Bone width={190} height={20} radius={6} style={{ marginTop: 4 }} />
      </View>
      <View style={styles.salesList}>
        <ListRows count={5} />
      </View>
    </View>
  );
}

function SellCard() {
  return (
    <View style={styles.sellCard}>
      <Bone radius={16} style={StyleSheet.absoluteFill} />
      <View style={styles.sellInfo}>
        <Bone width="75%" height={16} radius={6} />
        <View style={styles.gap6} />
        <Bone width="55%" height={14} radius={6} />
      </View>
      <Bone width={32} height={32} radius={16} style={{ position: 'absolute', right: 8, bottom: 8 }} />
    </View>
  );
}

// POS: buscador + tabs + grilla de 2 columnas.
export function SellSkeleton() {
  return (
    <View style={styles.sell}>
      <ScreenHeader title="Punto de venta" description="Selecciona productos y registra ventas."
        action={<Bone width={44} height={44} radius={22} />} />
      <View style={styles.sellTabs}>
        <Bone width={72} height={40} radius={999} />
        <Bone width={110} height={40} radius={999} />
        <Bone width={88} height={40} radius={999} />
      </View>
      <Bone width={140} height={18} style={{ marginTop: 12, marginBottom: 6, marginLeft: 16 }} />
      <View style={styles.sellGrid}>
        <View style={styles.sellCol}>
          <SellCard />
          <SellCard />
          <SellCard />
        </View>
        <View style={styles.sellCol}>
          <SellCard />
          <SellCard />
          <SellCard />
        </View>
      </View>
    </View>
  );
}

export function ProductOptionsSkeleton() {
  return <View accessibilityLabel="Cargando opciones del producto" accessibilityState={{ busy: true }}>
    {[0, 1].map(group => <View key={group} style={{ marginBottom: 20 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10, marginLeft: 4 }}>
        <Bone width={110} height={20} /><Bone width={70} height={20} />
      </View>
      {[0, 1].map(row => <View key={row} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, height: 52, paddingHorizontal: 12, borderRadius: 12, backgroundColor: '#fff', marginBottom: 8 }}>
        <Bone width={20} height={20} radius={10} /><View style={{ flex: 1 }}><Bone width="70%" height={16} /></View><Bone width={50} height={16} />
      </View>)}
    </View>)}
  </View>;
}

export function LoginSkeleton() {
  const insets = useSafeAreaInsets();
  return <View style={{ flex: 1, backgroundColor: '#fff', paddingTop: insets.top, paddingBottom: insets.bottom, paddingHorizontal: 28 }} accessibilityLabel="Cargando aplicación" accessibilityState={{ busy: true }}>
    <Text style={{ fontSize: 30, lineHeight: 38, fontWeight: '700', letterSpacing: -1, textAlign: 'center', paddingVertical: 20 }}>FoodHub</Text>
    <View style={{ flex: 1, justifyContent: 'center', paddingVertical: 32 }}>
      <View style={{ width: '100%', maxWidth: 420, alignSelf: 'center' }}>
        <Bone width={190} height={38} style={{ alignSelf: 'center' }} />
        <Bone width="85%" height={46} style={{ alignSelf: 'center', marginTop: 12, marginBottom: 36 }} />
        <Bone height={56} radius={28} /><Bone height={56} radius={28} style={{ marginTop: 20 }} />
        <Bone height={56} radius={28} style={{ marginTop: 56 }} />
        <Bone width="80%" height={21} style={{ alignSelf: 'center', marginTop: 35 }} />
        <Bone width="65%" height={21} style={{ alignSelf: 'center', marginTop: 31 }} />
      </View>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  gap6: { height: 6 },
  mt8: { marginTop: 8 },
  card: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.06)',
    borderRadius: 14,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingRight: 16,
  },
  rowLast: { borderBottomWidth: 0 },
  rowLeft: { flex: 1, marginRight: 8 },
  // Resumen
  dash: { flex: 1, backgroundColor: '#F2F2F7', padding: 16, paddingBottom: TAB_BAR_CLEARANCE },
  dashHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  dashHeaderText: { flex: 1, marginLeft: 12, marginRight: 12 },
  dashHero: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.06)',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
  },
  dashStats: { flexDirection: 'row', marginTop: 12, alignItems: 'center' },
  dashStat: { flex: 1 },
  dashSep: { width: 1, height: 32, backgroundColor: '#E5E5EA', marginHorizontal: 12 },
  section: { marginLeft: 4, marginBottom: 8 },
  // Pedidos
  sales: { flex: 1, backgroundColor: '#F2F2F7' },
  salesHeader: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 2 },
  salesSearch: { marginHorizontal: 16 },
  salesSection: { marginLeft: 20, marginTop: 6, marginBottom: 12 },
  salesList: { paddingHorizontal: 16, paddingBottom: TAB_BAR_CLEARANCE },
  // POS
  sell: { flex: 1, backgroundColor: '#F2F2F7' },
  sellSearch: { marginHorizontal: 16, marginBottom: 8 },
  sellTabs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    height: 48,
    marginBottom: 16,
  },
  sellGrid: { flexDirection: 'row', gap: 10, padding: 12, paddingTop: 4 },
  sellCol: { flex: 1, gap: 10 },
  sellCard: {
    aspectRatio: 1,
    backgroundColor: '#E3E3E8',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 10,
    marginHorizontal: 2,
  },
  sellImage: { aspectRatio: 1, width: '100%' },
  sellInfo: { position: 'absolute', left: 10, right: 48, bottom: 10 },
});
