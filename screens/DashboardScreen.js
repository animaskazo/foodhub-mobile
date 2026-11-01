import Image from '../components/SkeletonImage';
import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Platform,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ReceiptText, RotateCw } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { TAB_BAR_CLEARANCE } from '../components/TabBar';
import {
  getMyStore,
  getDashboardPeriod,
  getStoreVisits,
  updateStorePrepTime,
  peekMyStore,
  clearStoreCache,
  fmtMoney,
  STATUS_LABELS,
} from '../lib/store';
import { findCachedProductImage } from '../lib/pos';
import CartSheet from './CartSheet';
import OrderRow from '../components/OrderRow';
import BusinessProfile from '../components/BusinessProfile';
import StoreCover, { COVER_HEIGHT } from '../components/StoreCover';
import DateRangeFilter from '../components/DateRangeFilter';
import DeliveryTimeButton from '../components/DeliveryTimeButton';
import { presetRange, rangeBounds, shiftDate, summarizePeriod } from '../lib/dateRange';
import { Bone, SkeletonSlot, DashboardSalesPlaceholder, OrderRowPlaceholder } from '../components/Skeleton';
import { DashboardMetricCards, SalesByChannelCard, SalesSparkline, SalesTrendCard, summarizeChannels, summarizeDailySales } from '../components/DashboardAnalytics';

export default function DashboardScreen({ onLogout, onSell, storeName, storeLogo, active }) {
  const insets = useSafeAreaInsets();
  const coverHeight = COVER_HEIGHT + insets.top;
  const [period, setPeriod] = useState(() => presetRange(1));
  const [summary, setSummary] = useState({ revenue: 0, count: 0, ticket: 0 });
  const [visits, setVisits] = useState(0);
  const [yesterday, setYesterday] = useState(0);
  const [recent, setRecent] = useState([]);
  const [periodOrders, setPeriodOrders] = useState([]);
  const [totalOrders, setTotalOrders] = useState(0);
  const [loading, setLoading] = useState(true);
  const [periodLoading, setPeriodLoading] = useState(false);
  const request = React.useRef(0);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [prepTime, setPrepTime] = useState(() => peekMyStore()?.org?.prep_time ?? 0);
  const [coverUrl, setCoverUrl] = useState(() => peekMyStore()?.org?.cover_url || null);
  const [coverVisible, setCoverVisible] = useState(true);
  const [scrollY] = useState(() => new Animated.Value(0));
  const load = useCallback(async (force = false) => {
    const id = ++request.current;
    const selectedPeriod = period.days ? presetRange(period.days) : period;
    setError('');
    if (force) setRefreshing(true);
    try {
      const { branchIds, org } = await getMyStore(force ? { forceRefresh: true } : undefined);
      if (id !== request.current) return;
      setCoverUrl(org.cover_url || null);
      setPrepTime(org.prep_time ?? 0);
      const selectedBounds = rangeBounds(selectedPeriod);
      const trendStart = new Date(`${shiftDate(selectedPeriod.end, -6)}T00:00:00`).toISOString();
      const orderBounds = {
        ...selectedBounds,
        previousStart: selectedBounds.previousStart < trendStart ? selectedBounds.previousStart : trendStart,
      };
      const [data, visitCount] = await Promise.all([
        getDashboardPeriod(branchIds, orderBounds, { forceRefresh: force }),
        getStoreVisits(org.id, selectedPeriod, { forceRefresh: force }),
      ]);
      if (id !== request.current) return;
      const d = summarizePeriod(data.orders, selectedPeriod);
      setSummary(d.summary);
      setVisits(visitCount);
      setYesterday(d.previous);
      setRecent(data.recent);
      setPeriodOrders(data.orders);
      setTotalOrders(d.totalOrders);
    } catch (err) {
      if (id === request.current) setError(err.message || 'No se pudo cargar el resumen.');
    } finally {
      if (id === request.current) {
        setLoading(false); setRefreshing(false); setPeriodLoading(false);
      }
    }
  }, [period]);

  React.useEffect(() => {
    if (active) load();
    return () => { request.current += 1; };
  }, [active, load]);

  function changePeriod(next) {
    request.current += 1;
    setPeriodLoading(true);
    setRefreshing(false);
    setPeriod(next);
  }

  const handleLogout = async () => {
    clearStoreCache();
    await supabase.auth.signOut();
    onLogout();
  };

  const contentLoading = loading || periodLoading || refreshing;
  const analytics = useMemo(() => {
    const selectedPeriod = period.days ? presetRange(period.days) : period;
    const bounds = rangeBounds(selectedPeriod);
    const currentOrders = periodOrders.filter(order => {
      const createdAt = Date.parse(order.created_at);
      return createdAt >= Date.parse(bounds.start) && createdAt < Date.parse(bounds.end);
    });
    const trendKeys = Array.from({ length: 7 }, (_, index) => shiftDate(selectedPeriod.end, index - 6));
    return {
      channels: summarizeChannels(currentOrders),
      days: summarizeDailySales(periodOrders, trendKeys),
    };
  }, [period, periodOrders]);

  return (
    <>
      {active && <StatusBar style={coverVisible ? "light" : "dark"} />}
      <Animated.ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: Platform.OS !== 'web',
          listener: (event) => setCoverVisible(event.nativeEvent.contentOffset.y < coverHeight - insets.top),
        })}
        scrollEventThrottle={16}
        contentInsetAdjustmentBehavior="never"
        alwaysBounceVertical
        removeClippedSubviews={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor="transparent"
            colors={['#fff']}
            progressBackgroundColor="#1C1C1E"
            progressViewOffset={insets.top + 8}
          />
        }
      >
      <View style={styles.brandHeader}>
      <SkeletonSlot loading={loading}>
        <StoreCover height={coverHeight} scrollY={scrollY} uri={coverUrl} active={active && coverVisible && !profileOpen && !selected} />
      </SkeletonSlot>
      <View style={styles.header}>
        <SkeletonSlot loading={loading} placeholder={<Bone width={68} height={68} radius={34} />}>
        {storeLogo ? (
          <Image source={{ uri: storeLogo }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarText}>
              {(storeName || 'M').charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        </SkeletonSlot>
        <TouchableOpacity
          onPress={() => setProfileOpen(true)}
          style={styles.profile}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Ver perfil del negocio"
        >
          <Text style={styles.profileLabel}>Perfil</Text>
        </TouchableOpacity>
      </View>
      </View>
        <View style={styles.headerText}>
          <SkeletonSlot loading={loading} style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{storeName || 'Mi local'}</Text>
          </SkeletonSlot>
          <SkeletonSlot loading={loading} placeholder={<Bone width={104} height={44} radius={22} />}>
            <DeliveryTimeButton value={prepTime} disabled={contentLoading} onSave={async minutes => {
              const saved = await updateStorePrepTime(minutes);
              setPrepTime(saved);
            }} />
          </SkeletonSlot>
        </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <>

      <SkeletonSlot loading={contentLoading} placeholder={<DashboardSalesPlaceholder />}>
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={styles.heroMain}>
            <Text style={styles.heroLabel}>{period.days === 1 ? 'Vendido hoy' : 'Ventas del período'}</Text>
            <Text style={styles.heroValue} numberOfLines={1} adjustsFontSizeToFit>{fmtMoney(summary.revenue)}</Text>
          </View>
          <View style={styles.sparkline}><SalesSparkline days={analytics.days} /></View>
        </View>
        <Text style={styles.heroDelta} numberOfLines={1}>
          {yesterday > 0
            ? `${summary.revenue >= yesterday ? '+' : ''}${Math.round(
                ((summary.revenue - yesterday) / yesterday) * 100
              )}% vs ${period.days === 1 ? 'ayer' : 'período anterior'} (${fmtMoney(yesterday)})`
            : 'Sin ventas en el período anterior'}
        </Text>
        <View style={styles.visitsLine}>
          <Text style={styles.visitsValue}>{visits.toLocaleString('es-CL')}</Text>
          <Text style={styles.visitsLabel}>visitas en el período</Text>
        </View>
      </View>

      </SkeletonSlot>
      <SkeletonSlot loading={contentLoading} placeholder={
        <View style={styles.metricsPlaceholder}>
          <Bone width="48%" height={82} radius={18} />
          <Bone width="48%" height={82} radius={18} />
        </View>
      }>
        <DashboardMetricCards totalOrders={totalOrders} ticket={summary.ticket} />
      </SkeletonSlot>
      {!contentLoading && <>
        <SalesByChannelCard channels={analytics.channels} />
        <SalesTrendCard days={analytics.days} />
      </>}
      <View style={styles.filterRow}>
        <Text style={styles.section} numberOfLines={1}>
          {contentLoading ? 'Pedidos' : `${totalOrders} ${totalOrders === 1 ? 'Pedido' : 'Pedidos'}`}
        </Text>
        <DateRangeFilter value={period} onChange={changePeriod} />
      </View>

      {!error && <>
      {!contentLoading && recent.length === 0 ? (
        <View style={styles.emptyWrap}>
          <View style={styles.emptyIcon}>
            <ReceiptText size={30} color="#000" />
          </View>
          <Text style={styles.emptyTitle}>Sin pedidos en este período</Text>
          <TouchableOpacity
            style={styles.emptyCta}
            onPress={onSell}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Registrar una venta"
          >
            <Text style={styles.emptyCtaText}>Registrar una venta</Text>
          </TouchableOpacity>
        </View>
      ) : (
      <>
        {(contentLoading && !recent.length
          ? Array.from({ length: 4 }, (_, i) => ({ id: `loading-${i}`, created_at: new Date().toISOString(), total: 0, status: 'paid' }))
          : recent).map((o, i, rows) => (
          <SkeletonSlot key={o.id} loading={contentLoading} placeholder={<OrderRowPlaceholder />}>
          <OrderRow
            key={o.id}
            order={o}
            onPress={() => { if (!contentLoading) setSelected(o); }}
            first={i === 0}
            last={i === rows.length - 1}
          />
          </SkeletonSlot>
        ))}
      </>
      )}
      </>}
      </>
      </Animated.ScrollView>

      {Platform.OS === 'ios' && (
        <Animated.View
          pointerEvents="none"
          style={[styles.refreshOverlay, {
            top: insets.top + 8,
            opacity: refreshing ? 1 : scrollY.interpolate({
              inputRange: [-65, -12, 0], outputRange: [1, 0, 0], extrapolate: 'clamp',
            }),
          }]}
        >
          {refreshing ? <ActivityIndicator color="#fff" size="small" accessibilityLabel="Actualizando resumen" /> : (
            <Animated.View style={{ transform: [{ rotate: scrollY.interpolate({
              inputRange: [-90, 0], outputRange: ['180deg', '0deg'], extrapolate: 'clamp',
            }) }] }}>
              <RotateCw size={20} color="#fff" />
            </Animated.View>
          )}
        </Animated.View>
      )}

      <CartSheet
        visible={!!selected}
        onClose={() => setSelected(null)}
        readOnly
        order={selected}
        lines={(selected?.order_items || []).map((it, i) => ({
          id: String(i),
          name: it.product_name,
          price: Number(it.unit_price) || 0,
          qty: it.quantity,
          image: findCachedProductImage(it.product_name),
        }))}
        title={`Pedido #${selected?.order_number || selected?.id.slice(0, 6) || ''}`}
        subtitle={
          selected
            ? [
                new Date(selected.created_at).toLocaleTimeString('es-CL', {
                  hour: '2-digit',
                  minute: '2-digit',
                }),
                STATUS_LABELS[selected.status],
                selected.customer_name,
              ]
                .filter(Boolean)
                .join(' · ')
            : ''
        }
        totalOverride={selected ? Number(selected.total) || 0 : 0}
        subtotalOverride={selected ? Number(selected.subtotal) || 0 : 0}
        discountOverride={selected ? Number(selected.discount_amount) || 0 : 0}
      />

      <BusinessProfile
        visible={profileOpen}
        onClose={() => setProfileOpen(false)}
        onLogout={handleLogout}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7' },
  content: { padding: 16, paddingBottom: TAB_BAR_CLEARANCE, flexGrow: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  refreshOverlay: {
    position: 'absolute',
    alignSelf: 'center',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  brandHeader: {
    marginHorizontal: -16,
    marginTop: -16,
    marginBottom: 20,
    backgroundColor: '#1C1C1E',
  },
  header: { position: 'absolute', left: 20, right: 16, bottom: -12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 4,
    borderColor: '#fff',
    backgroundColor: '#fff',

  },
  avatarFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#E3E3E8' },
  avatarText: { fontSize: 30, fontWeight: '800', color: '#000' },
  headerText: { flexDirection: 'row', alignItems: 'center', gap: 12, minWidth: 0, minHeight: 44, marginLeft: 4, marginBottom: 16 },
  title: { lineHeight: 40, fontSize: 32, fontWeight: '800', color: '#1C1C1E', letterSpacing: -1 },
  profile: {
    minWidth: 48,
    minHeight: 44,
    paddingHorizontal: 4,
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileLabel: { color: '#fff', fontSize: 14, fontWeight: '600' },
  error: { color: '#FF3B30', fontSize: 13, marginBottom: 12 },
  // Hero claro para equilibrar el header oscuro (Square: alto
  // contraste negro/blanco, superficies planas, sin degradados).
  filterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10 },
  hero: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.06)',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
  },
  heroMain: { flex: 1, minWidth: 0 },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sparkline: { width: 82, alignItems: 'flex-end', justifyContent: 'center' },
  heroValue: { lineHeight: 42, color: '#000', fontSize: 34, fontWeight: '800', letterSpacing: -1 },
  heroLabel: { lineHeight: 18, color: '#8E8E93', fontSize: 13, fontWeight: '600', marginTop: 2 },
  heroDelta: { minHeight: 16, lineHeight: 16, color: '#6E6E73', fontSize: 11, fontWeight: '600', marginTop: 3 },
  visitsLine: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  visitsValue: { lineHeight: 16, color: '#1C1C1E', fontSize: 12, fontWeight: '700' },
  visitsLabel: { lineHeight: 16, color: '#8E8E93', fontSize: 11 },
  metricsPlaceholder: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  section: { flex: 1, fontSize: 20, fontWeight: '800', color: '#000', marginLeft: 4 },
  empty: { padding: 16, paddingLeft: 0, color: '#8E8E93', fontSize: 14 },
  emptyWrap: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#EAEAEE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: '#000', textAlign: 'center' },
  emptyCta: {
    backgroundColor: '#000',
    borderRadius: 999,
    height: 44,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  emptyCtaText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
