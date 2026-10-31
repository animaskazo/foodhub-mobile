import Image from '../components/SkeletonImage';
import ScreenHeader from '../components/ScreenHeader';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, SectionList, Switch, RefreshControl, Pressable, Alert, ActivityIndicator, TextInput, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router, useFocusEffect } from 'expo-router';
import { Package, Search, X } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { peekMyStore, fmtMoney } from '../lib/store';
import { getManagedProducts, getManagedCategories, peekManagedProducts, peekManagedCategories, setProductAvailability } from '../lib/products';
import { groupProducts } from '../lib/productGroups';
import TabBar, { TAB_BAR_CLEARANCE } from '../components/TabBar';
import { MAIN_TABS } from '../components/MainTabs';
import { Bone, SkeletonSlot } from '../components/Skeleton';

export default function ProductsScreen() {
  const [products, setProducts] = useState(() => peekManagedProducts(peekMyStore()?.org?.id) || []);
  const [categories, setCategories] = useState(() => peekManagedCategories(peekMyStore()?.org?.id) || []);
  const [loading, setLoading] = useState(() => !peekManagedProducts(peekMyStore()?.org?.id) || !peekManagedCategories(peekMyStore()?.org?.id));
  const [refreshing, setRefreshing] = useState(false);
  const [pending, setPending] = useState({});
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const saving = useRef(new Set());
  const generation = useRef(0);
  const load = useCallback(async (force = false) => {
    if (saving.current.size) return;
    const version = ++generation.current;
    if (force) setRefreshing(true);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/'); return; }
      const [data, categoryData] = await Promise.all([
        getManagedProducts({ forceRefresh: force }), getManagedCategories({ forceRefresh: force }),
      ]);
      if (version === generation.current) { setProducts(data); setCategories(categoryData); }
    } catch (err) {
      if (version === generation.current) setError(err.message || 'No se pudo cargar el catálogo.');
    } finally {
      if (version === generation.current) { setLoading(false); setRefreshing(false); }
    }
  }, []);
  useFocusEffect(useCallback(() => {
    load();
    return () => { generation.current += 1; };
  }, [load]));

  async function toggle(product, enabled) {
    if (saving.current.has(product.id)) return;
    saving.current.add(product.id);
    generation.current += 1; // Ignore any older catalog response while saving.
    setRefreshing(false);
    setPending(v => ({ ...v, [product.id]: true }));
    setProducts(list => list.map(p => p.id === product.id ? { ...p, status: enabled ? 'available' : 'unavailable' } : p));
    try {
      await setProductAvailability(product.id, enabled, product.status);
    } catch (err) {
      setProducts(list => list.map(p => p.id === product.id ? { ...p, status: product.status } : p));
      Alert.alert('No se pudo actualizar', `${product.name}: ${err.message}`);
    } finally {
      saving.current.delete(product.id);
      setPending(v => { const next = { ...v }; delete next[product.id]; return next; });
    }
  }

  const filtered = useMemo(() => products.filter(product => product.name.toLocaleLowerCase('es').includes(query.trim().toLocaleLowerCase('es'))), [products, query]);
  const sections = useMemo(() => loading && !products.length
    ? [{ key: 'loading', title: 'Categoría', data: Array.from({ length: 6 }, (_, i) => ({ id: `loading-${i}`, name: 'Producto', status: 'available' })) }]
    : groupProducts(filtered, categories), [loading, products.length, filtered, categories]);
  return <SafeAreaView style={s.screen} edges={['top']}>
    <StatusBar style="dark" />
    <ScreenHeader title="Productos" description="Activa o pausa tus productos." action={
      <Pressable style={s.searchButton} accessibilityRole="button" accessibilityLabel={searchOpen ? 'Cerrar búsqueda' : 'Buscar productos'}
        accessibilityState={{ expanded: searchOpen }} onPress={() => {
          if (searchOpen) { setQuery(''); Keyboard.dismiss(); }
          setSearchOpen(value => !value);
        }}>
        {searchOpen ? <X size={22} color="#111" /> : <Search size={22} color="#111" />}
      </Pressable>
    } />
    {searchOpen && <View style={s.searchWrap}>
      <Search size={16} color="#8E8E93" />
      <TextInput style={s.search} value={query} onChangeText={setQuery} placeholder="Buscar producto"
        accessibilityLabel="Buscar productos" autoFocus autoCorrect={false} clearButtonMode="while-editing"
        returnKeyType="search" onSubmitEditing={Keyboard.dismiss} />
    </View>}
    {error ? <View style={s.error}><Text style={s.errorText}>{error}</Text><Pressable accessibilityRole="button" onPress={() => load(true)} style={s.retry}><Text style={s.retryText}>Reintentar</Text></Pressable></View> : null}
    <SectionList
      sections={sections} stickySectionHeadersEnabled extraData={pending} keyExtractor={p => p.id} contentContainerStyle={s.list}
      keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
      renderSectionHeader={({ section }) => <View style={s.categoryHeader}>
        <SkeletonSlot loading={loading}><Text style={s.categoryTitle}>{section.title}</Text>
          <Text style={s.categoryCount}>{section.data.length} {section.data.length === 1 ? 'producto' : 'productos'} · {section.data.filter(product => product.status === 'available').length} disponibles</Text>
        </SkeletonSlot>
      </View>}
      renderSectionFooter={() => <View style={{ height: 12 }} />}
      renderItem={({ item, index, section }) => <View style={[s.row, index === 0 && s.first, index === section.data.length - 1 && s.last]}>
        <SkeletonSlot loading={loading} placeholder={<Bone width={48} height={48} radius={12} />}>
          {item.image ? <Image source={{ uri: item.image }} style={s.image} /> : <View style={[s.image, s.fallback]}><Package size={22} color="#8E8E93" /></View>}
        </SkeletonSlot>
        <View style={s.identity}><SkeletonSlot loading={loading} placeholder={<View>
          <Bone width="80%" height={20} /><Bone width="45%" height={20} style={{ marginTop: 3 }} />
        </View>}>
          <Text style={s.name} numberOfLines={2}>{item.name}</Text>
          <Text style={s.price}>{item.isFrom ? 'Desde ' : ''}{fmtMoney(item.price)}</Text>
        </SkeletonSlot></View>
        <View style={s.control}>
          {pending[item.id] && <ActivityIndicator size="small" color="#8E8E93" />}
          <SkeletonSlot loading={loading} placeholder={<Bone width={51} height={31} radius={16} />}>
          <Switch value={item.status === 'available'} onValueChange={enabled => toggle(item, enabled)}
            disabled={loading || !!pending[item.id]} accessibilityLabel={`Disponibilidad de ${item.name}`}
            trackColor={{ false: '#E5E5EA', true: '#000' }} thumbColor="#fff" ios_backgroundColor="#E5E5EA" />
          </SkeletonSlot>
        </View>
      </View>}
      ListEmptyComponent={!loading && !error ? <View style={s.empty}><Package size={40} color="#8E8E93" /><Text style={s.emptyTitle}>{query.trim() ? 'Sin resultados' : 'Sin productos'}</Text><Text style={s.subtitle}>{query.trim() ? 'Prueba con otro nombre.' : 'Aquí aparecerán los productos de tu local.'}</Text></View> : null}
    />
    <TabBar tabs={MAIN_TABS} active="products" onChange={id => { if (id !== 'products') router.dismissTo({ pathname: '/', params: { section: id } }); }} />
  </SafeAreaView>;
}
const s = StyleSheet.create({
  categoryHeader: { backgroundColor: '#F2F2F7', paddingHorizontal: 4, paddingTop: 6, paddingBottom: 12 },
  categoryTitle: { fontSize: 22, lineHeight: 28, fontWeight: '800', color: '#111' },
  categoryCount: { fontSize: 13, lineHeight: 20, color: '#6E6E73', marginTop: 4 },
  price: { fontSize: 14, lineHeight: 20, fontWeight: '400', color: '#000', marginTop: 3 },
  searchButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#E3E3E8', borderRadius: 12, paddingHorizontal: 12, height: 38, marginHorizontal: 16, marginBottom: 4 },
  search: { flex: 1, fontSize: 16, color: '#000', height: '100%' },
  screen: { flex: 1, backgroundColor: '#F2F2F7' }, subtitle: { fontSize: 13, lineHeight: 19, color: '#8E8E93', marginTop: 5 }, list: { paddingHorizontal: 16, paddingBottom: TAB_BAR_CLEARANCE, flexGrow: 1 }, row: { flexDirection: 'row', gap: 12, alignItems: 'center', minHeight: 92, padding: 14, backgroundColor: '#fff', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5E5EA' }, first: { borderTopLeftRadius: 14, borderTopRightRadius: 14 }, last: { borderBottomLeftRadius: 14, borderBottomRightRadius: 14, borderBottomWidth: 0 }, image: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#F2F2F7' }, fallback: { justifyContent: 'center', alignItems: 'center' }, identity: { flex: 1, minWidth: 0 }, name: { minHeight: 20, fontSize: 15, lineHeight: 20, fontWeight: '700', color: '#000' }, control: { width: 80, justifyContent: 'flex-end', flexDirection: 'row', alignItems: 'center', gap: 6 }, error: { paddingHorizontal: 20, paddingBottom: 12 }, errorText: { color: '#FF3B30', fontSize: 13 }, retry: { minHeight: 44, justifyContent: 'center' }, retryText: { fontSize: 14, fontWeight: '600', color: '#000' }, empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }, emptyTitle: { fontSize: 18, fontWeight: '700', marginTop: 12 },
});
