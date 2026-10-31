import ScreenHeader from '../components/ScreenHeader';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ScrollView,
  useWindowDimensions,
  Animated,
  Easing,
  Pressable,
  Keyboard,
} from 'react-native';
import { Search, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import PosProductCard from '../components/PosProductCard';
import PosCatalogPage from '../components/PosCatalogPage';
import { buildPosCatalog, pageAtOffset } from '../lib/posCatalog';
import { addCartLine, editCartLine, canEditCartLine } from '../lib/cart';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getMyStore, peekMyStore, fmtMoney } from '../lib/store';
import {
  getAvailableProducts,
  peekAvailableProducts,
  getCategories,
  peekCategories,
  createPosOrder,
  getProductOptions,
  peekProductOptions,
  validateCoupon,
  calcCouponDiscount,
} from '../lib/pos';
import CartSheet from './CartSheet';
import ProductSheet from './ProductSheet';
import CheckoutScreen from './CheckoutScreen';
import { SellSkeleton } from '../components/Skeleton';

const METHOD_LABELS = { cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia' };

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

function TabPill({ id, name, selected, onPress, a11yLabel, onMeasure }) {
  const anim = useRef(new Animated.Value(selected ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: selected ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [selected, anim]);
  const backgroundColor = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#ffffff', '#000000'],
  });
  const borderColor = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(0,0,0,0.06)', '#000000'],
  });
  const color = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#000000', '#ffffff'],
  });
  return (
    <AnimatedTouchable
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      accessibilityLabel={a11yLabel}
      onLayout={(e) => onMeasure(id, e.nativeEvent.layout)}
      style={[styles.tab, { backgroundColor, borderColor }]}
    >
      <Animated.Text style={[styles.tabText, { color }]} numberOfLines={1}>
        {name}
      </Animated.Text>
    </AnimatedTouchable>
  );
}

export default function SellScreen({ active, onFullscreenChange }) {
  const insets = useSafeAreaInsets();
  // La barra flotante ocupa ~85pt sobre el área segura: el botón
  // se eleva dinámicamente para nunca chocar con ella.
  const barClearance = Math.max(insets.bottom, 0) + 92;
  // Catálogo cacheado: el tab abre al instante en la 2ª visita.
  const [products, setProducts] = useState(() => {
    const s = peekMyStore();
    return (s && peekAvailableProducts(s.org.id)) || [];
  });
  const [categories, setCategories] = useState(() => {
    const s = peekMyStore();
    return (s && peekCategories(s.org.id)) || [];
  });
  const [toolbarHeight, setToolbarHeight] = useState(160);
  const catalogOffsets = useRef({});
  const [activeCat, setActiveCat] = useState(null); // null = Todo
  const [loading, setLoading] = useState(() => {
    const s = peekMyStore();
    return !(s && peekAvailableProducts(s.org.id));
  });
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const scrollKey = search.trim() ? `search:${search.trim()}` : activeCat || '__all';
  const readCatalogOffset = useCallback(key => catalogOffsets.current[key] || 0, []);
  const catalogScroll = (key) => event => {
    catalogOffsets.current[key] = Math.max(0, event.nativeEvent.contentOffset.y);
  };
  const [cart, setCart] = useState({}); // id -> { ...product, qty }
  const [coupon, setCoupon] = useState(null); // { id, code, type, value }
  const [customer, setCustomer] = useState({ name: '', phone: '' });
  const [method, setMethod] = useState('cash');
  const [cartOpen, setCartOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [editingLine, setEditingLine] = useState(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [paidMethod, setPaidMethod] = useState(null);
  const [taxRate, setTaxRate] = useState(0.19);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);
  const mounted = React.useRef(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const { org } = await getMyStore();
      if (org.default_tax_rate != null) {
        setTaxRate(Number(org.default_tax_rate) / 100);
      }
      const [prods, cats] = await Promise.all([
        getAvailableProducts(org.id),
        getCategories(org.id).catch(() => []),
      ]);
      setProducts(prods);
      setCategories(cats);
      setActiveCat((prev) =>
        prev && !cats.some((c) => c.id === prev) ? null : prev
      );
    } catch (err) {
      setError(err.message || 'Error al cargar productos.');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    mounted.current = true;
    load();
  }, [load]);

  // Refresca el catálogo en background al volver al tab.
  React.useEffect(() => {
    if (active && mounted.current) load();
  }, [active, load]);

  // El cobro es flujo completo: oculta la barra de navegación.
  React.useEffect(() => {
    onFullscreenChange?.(!checkoutOpen);
  }, [checkoutOpen, onFullscreenChange]);

  const add = useCallback((product, qty = 1, selection = null) =>
    setCart(current => addCartLine(current, product, qty, selection)), []);

  const editProduct = (line) => {
    Keyboard.dismiss();
    const productId = line.productId || line.id.split('|')[0];
    const product = products.find(item => item.id === productId);
    setEditingLine(line);
    setSelectedProduct({ ...product, id: productId, name: line.name, image: line.image, price: line.basePrice ?? product?.price ?? line.price });
  };

  const canEditProduct = line => canEditCartLine(line, peekProductOptions(line.productId || line.id.split('|')[0]));

  const changeQty = (id, delta) =>
    setCart((c) => {
      const line = c[id];
      if (!line) return c;
      const qty = line.qty + delta;
      if (qty <= 0) {
        const next = { ...c };
        delete next[id];
        return next;
      }
      return { ...c, [id]: { ...line, qty } };
    });

  const lines = Object.values(cart);
  const linesTotal = lines.reduce((acc, l) => acc + l.price * l.qty, 0);
  const discount = calcCouponDiscount(coupon, linesTotal);
  const total = Math.max(0, linesTotal - discount);
  const count = lines.reduce((acc, l) => acc + l.qty, 0);

  // Sin líneas no hay cupón que aplicar.
  React.useEffect(() => {
    if (lines.length === 0 && coupon) setCoupon(null);
  }, [lines.length, coupon]);

  const applyCoupon = async (code) => {
    const { org } = await getMyStore();
    const fresh = await validateCoupon(org.id, code, linesTotal);
    setCoupon(fresh);
    setError('');
  };
  // Unidades por producto (suma todas sus líneas: base + variantes):
  // la tarjeta muestra cuántas lleva en el pedido.
  const qtyByProduct = useMemo(() => {
    const map = {};
    for (const l of Object.values(cart)) {
      const pid = l.productId || l.id;
      map[pid] = (map[pid] || 0) + l.qty;
    }
    return map;
  }, [cart]);
  // Reserva estable: agregar al carrito no cambia el tamaño del scroll.
  const gridContentStyle = useMemo(() => [
    styles.grid,
    { paddingTop: toolbarHeight + 4, paddingBottom: barClearance + 68 },
  ], [toolbarHeight, barClearance]);

  // Tabs + buscador: el texto busca en todo el catálogo,
  // el tab filtra por categoría. Una pregunta, una respuesta.
  const q = search.trim().toLowerCase();
  const filtered = useMemo(() => q ? products.filter(p => p.name.toLowerCase().includes(q)) : products, [products, q]);

  // Páginas del pager: Todo + una por categoría. El slide horizontal
  // cambia de página y sincroniza el tab activo (§10).
  const { width } = useWindowDimensions();
  const pagerRef = useRef(null);
  const tabsRef = useRef(null);
  const tabLayouts = useRef({});
  const tabsWidth = useRef(0);
  const pages = useMemo(() => [{ id: null, name: 'Todo' }, ...categories], [categories]);
  const catalog = useMemo(() => buildPosCatalog(products, categories), [products, categories]);
  const settledPage = useRef(0);
  const requestedPage = useRef(null);
  const pageIndexFor = (id) => Math.max(pages.findIndex((p) => p.id === id), 0);
  const goToPage = (id) => {
    if (q) setSearch('');
    const index = pageIndexFor(id);
    requestedPage.current = index;
    setActiveCat(id);
    const adjacent = Math.abs(index - settledPage.current) === 1;
    pagerRef.current?.scrollToIndex({ index, animated: adjacent });
    if (!adjacent) settledPage.current = index;
  };
  const onPageSwiped = (event) => {
    const index = pageAtOffset(event.nativeEvent.contentOffset.x, width, pages.length);
    if (requestedPage.current != null && index !== requestedPage.current) return;
    requestedPage.current = null;
    settledPage.current = index;
    const page = pages[index];
    if (page) setActiveCat(page.id);
  };

  // El tab activo siempre visible: centra la tira de tabs en la
  // píldora activa con cada cambio (tap o slide).
  const measureTab = useCallback((id, layout) => {
    tabLayouts.current[id] = layout;
  }, []);
  useEffect(() => {
    const m = tabLayouts.current[activeCat || '__all'];
    const W = tabsWidth.current;
    if (!m || !W) return;
    const target = Math.max(0, m.x + m.width / 2 - W / 2);
    tabsRef.current?.scrollTo({ x: target, animated: true });
  }, [activeCat, categories.length]);

  // Toque en la tarjeta o en +: 1 toque, feedback háptico (§13).
  // Sin variantes ni extras se agrega directo al pedido, sin abrir
  // el detalle. Con opciones, se abre el detalle para elegir.
  // Guarda anti-doble-tap por producto.
  const checkingQuickAdd = useRef({});
  const addOrOpen = useCallback((p) => {
    const hasOptions = (data) =>
      (data?.groups?.length || 0) > 0 || (data?.extras?.length || 0) > 0;
    const cached = peekProductOptions(p.id);
    if (cached) {
      if (hasOptions(cached)) {
        setSelectedProduct(p);
        return;
      }
      add(p, 1);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      return;
    }
    if (checkingQuickAdd.current[p.id]) return;
    checkingQuickAdd.current[p.id] = true;
    getProductOptions(p.id)
      .then((data) => {
        if (hasOptions(data)) setSelectedProduct(p);
        else {
          add(p, 1);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        }
      })
      .catch(() => {
        add(p, 1);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      })
      .finally(() => {
        delete checkingQuickAdd.current[p.id];
      });
  }, [add]);

  const openProductDetail = useCallback(product => {
    Keyboard.dismiss();
    setSelectedProduct(product);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, []);

  const renderCard = useCallback(({ item: product }) => (
    <PosProductCard product={product} inCart={qtyByProduct[product.id] || 0} onAdd={addOrOpen} onOpen={openProductDetail} />
  ), [qtyByProduct, addOrOpen, openProductDetail]);

  const charge = async () => {
    if (lines.length === 0 || confirming) return;
    setConfirming(true);
    setError('');
    try {
      const order = await createPosOrder({
        items: lines,
        paymentMethod: method,
        taxRate,
        coupon,
        customer,
      });
      setSuccess(order);
      setPaidMethod(method);
      setCart({});
      setCoupon(null);
      setCustomer({ name: '', phone: '' });
      setCartOpen(false);
      setCheckoutOpen(false);
    } catch (err) {
      setError(err.message || 'Error al cobrar.');
    } finally {
      setConfirming(false);
    }
  };

  const productEditor = <ProductSheet
    key={editingLine?.id || selectedProduct?.id || 'closed'}
    visible={!!selectedProduct}
    onClose={() => { setSelectedProduct(null); setEditingLine(null); }}
    product={selectedProduct}
    initialSelection={editingLine?.selection || null}
    editing={!!editingLine}
    quantity={editingLine?.qty || 1}
    onAdd={(product, qty, selection) => {
      if (editingLine) setCart(current => editCartLine(current, editingLine.id, product, selection));
      else add(product, qty, selection);
    }}
  />;

  if (loading) {
    return <SellSkeleton />;
  }

  if (success) {
    return (
      <View style={styles.center}>
        <Text style={styles.okCheck}>✓</Text>
        <Text style={styles.okTitle}>Venta registrada</Text>
        <Text style={styles.okTotal}>{fmtMoney(success.total)}</Text>
        <Text style={styles.okSub}>
          Pedido #{success.order_number || success.id.slice(0, 6)}
          {paidMethod ? ` · ${METHOD_LABELS[paidMethod]}` : ''}
        </Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => setSuccess(null)}
        >
          <Text style={styles.buttonText}>Nueva venta</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (checkoutOpen) {
    return (
      <>
      <CheckoutScreen
        lines={lines}
        taxRate={taxRate}
        method={method}
        onMethod={setMethod}
        onConfirm={charge}
        confirming={confirming}
        error={error}
        discount={discount}
        couponCode={coupon?.code}
        couponMinTotal={coupon?.min_total || 0}
        customer={customer}
        onCustomerChange={(field, value) => setCustomer(current => ({ ...current, [field]: value }))}
        onApplyCoupon={applyCoupon}
        onRemoveCoupon={() => { setCoupon(null); setError(''); }}
        onBack={() => {
          setCheckoutOpen(false);
          setCartOpen(true);
        }}
        onCancel={() => setCheckoutOpen(false)}
      />
      {productEditor}
      </>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.catalogToolbar}
        onLayout={event => setToolbarHeight(event.nativeEvent.layout.height)}>
          <ScreenHeader title="Punto de venta" description="Selecciona productos y registra ventas." action={
            <Pressable style={styles.searchButton} accessibilityRole="button"
              accessibilityLabel={searchOpen ? 'Cerrar búsqueda' : 'Buscar productos'}
              accessibilityState={{ expanded: searchOpen }}
              onPress={() => {
                if (searchOpen) { setSearch(''); Keyboard.dismiss(); }
                setSearchOpen(value => !value);
              }}>
              {searchOpen ? <X size={22} color="#111" /> : <Search size={22} color="#111" />}
            </Pressable>
          } />
      {searchOpen && <TextInput
        style={styles.search}
        value={search}
        onChangeText={setSearch}
        placeholder="Buscar producto..."
        accessibilityLabel="Buscar productos"
        autoFocus
        autoCorrect={false}
        clearButtonMode="while-editing"
        returnKeyType="search"
        onSubmitEditing={Keyboard.dismiss}
      />}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {categories.length > 0 && (
        <ScrollView
          ref={tabsRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabs}
          style={styles.tabsScroll}
          onLayout={(e) => {
            tabsWidth.current = e.nativeEvent.layout.width;
          }}
        >
          <TabPill
            id="__all"
            name="Todo"
            selected={activeCat === null}
            onPress={() => goToPage(null)}
            a11yLabel="Todas las categorías"
            onMeasure={measureTab}
          />
          {categories.map((c) => (
            <TabPill
              key={c.id}
              id={c.id}
              name={c.name}
              selected={activeCat === c.id}
              onPress={() => goToPage(c.id)}
              a11yLabel={`Categoría ${c.name}`}
              onMeasure={measureTab}
            />
          ))}
        </ScrollView>
      )}

      </View>
      {q ? (
        <PosCatalogPage key={`search:${q}`} pageKey={scrollKey} width={width}
          products={filtered} title="Resultados" renderCard={renderCard}
          onScroll={catalogScroll(scrollKey)} readOffset={readCatalogOffset} contentStyle={gridContentStyle} />
      ) : (
        <FlatList
          ref={pagerRef}
          data={pages}
          horizontal
          pagingEnabled
          directionalLockEnabled
          decelerationRate="fast"
          disableIntervalMomentum
          initialNumToRender={1}
          maxToRenderPerBatch={2}
          windowSize={3}
          removeClippedSubviews={false}
          onScrollBeginDrag={() => { requestedPage.current = null; }}
          showsHorizontalScrollIndicator={false}
          keyExtractor={(pg) => pg.id || '__all'}
          style={styles.pager}
          initialScrollIndex={pageIndexFor(activeCat)}
          getItemLayout={(_, index) => ({
            length: width,
            offset: width * index,
            index,
          })}
          onLayout={() => {
            const index = pageIndexFor(activeCat);
            settledPage.current = index;
            pagerRef.current?.scrollToIndex({ index, animated: false });
          }}
          onMomentumScrollEnd={onPageSwiped}
          onScrollToIndexFailed={({ index }) => {
            pagerRef.current?.scrollToOffset({ offset: index * width, animated: false });
          }}
          renderItem={({ item: pg }) => (
            <PosCatalogPage pageKey={pg.id || '__all'} width={width}
              sections={!pg.id ? catalog.sections : undefined}
              products={pg.id ? catalog.byCategory.get(pg.id) || [] : undefined}
              title={pg.name} renderCard={renderCard} onScroll={catalogScroll(pg.id || '__all')}
              readOffset={readCatalogOffset} contentStyle={gridContentStyle} />
          )}
        />
      )}

      {lines.length > 0 && (
        <View
          style={[styles.floatWrap, { bottom: barClearance }]}
          pointerEvents="box-none"
        >
          <TouchableOpacity
            style={styles.viewOrder}
            onPress={() => setCartOpen(true)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`Ver pedido, ${count} productos, ${fmtMoney(total)}`}
          >
            <View style={styles.viewQty}>
              <Text style={styles.viewQtyText}>{count}</Text>
            </View>
            <Text style={styles.viewOrderText}>
              Ver pedido · {fmtMoney(total)}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {!cartOpen && productEditor}

      <CartSheet
        onEdit={editProduct}
        canEdit={canEditProduct}
        editor={cartOpen ? productEditor : null}
        visible={cartOpen}
        onClose={() => setCartOpen(false)}
        lines={lines}
        taxRate={taxRate}
        onChangeQty={changeQty}
        coupon={coupon}
        discount={discount}
        onApplyCoupon={applyCoupon}
        onRemoveCoupon={() => setCoupon(null)}
        onCheckout={() => {
          setError('');
          setCartOpen(false);
          setCheckoutOpen(true);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  searchButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  catalogToolbar: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, backgroundColor: '#F2F2F7', paddingBottom: 16 },
  container: { flex: 1, backgroundColor: '#F2F2F7', overflow: 'hidden' },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#F2F2F7',
  },
  search: {
    backgroundColor: '#E3E3E8',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 38,
    fontSize: 16,
    marginHorizontal: 16,
    marginTop: 0,
    marginBottom: 8,
    color: '#000',
  },
  error: { color: '#FF3B30', fontSize: 13, paddingHorizontal: 16 },
  // Tabs superiores: altura fija y sin compresión para que nunca
  // se deformen (carga async, nombres largos o rotación).
  // Píldoras de 40pt con feedback instantáneo al tocar (§1).
  tabsScroll: { height: 48, marginTop: 0, flexGrow: 0, flexShrink: 0 },
  tabs: { paddingHorizontal: 16, alignItems: 'center', gap: 8 },
  tab: {
    height: 40,
    flexShrink: 0,
    maxWidth: 240,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: { fontSize: 14, fontWeight: '600' },
  section: { fontSize: 15, fontWeight: '700', color: '#000', paddingHorizontal: 20, marginBottom: 6, marginTop: 8 },
  // Pager entre categorías: cada página ocupa el ancho completo y
  // el slide sincroniza el tab (§10). Listas internas con scroll propio.
  pager: { flex: 1 },
  page: { flex: 1 },
  list: { flex: 1 },
  // Encabezados de categoría dentro del Todo + filas de a pares.
  catHeader: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000',
    paddingHorizontal: 4,
    marginTop: 14,
    marginBottom: 6,
  },
  catHeaderFirst: { marginTop: 8 },
  catRow: { flexDirection: 'row', gap: 10 },
  cell: { flex: 1 },
  grid: { padding: 12, paddingTop: 4, paddingBottom: 16 },
  gridRow: { gap: 10 },
  empty: { color: '#999', fontSize: 13, textAlign: 'center', marginTop: 24 },
  // Tarjeta: foto a sangre con degradado negro inferior donde
  // asientan nombre y precio en blanco para el contraste.
  // Botón flotante sobre el contenido (§12): sin fondo sólido,
  // el contenido desplaza por debajo. Sombra profunda para
  // separarlo del contenido.
  floatWrap: {
    position: 'absolute',
    left: 16,
    right: 16,
  },
  viewOrder: {
    backgroundColor: '#000',
    borderRadius: 18,
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  viewQty: {
    backgroundColor: '#fff',
    borderRadius: 999,
    minWidth: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    paddingHorizontal: 6,
  },
  viewQtyText: { color: '#000', fontSize: 13, fontWeight: '800' },
  viewOrderText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  button: {
    backgroundColor: '#000',
    borderRadius: 999,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    paddingHorizontal: 32,
  },
  buttonText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  okCheck: {
    width: 72,
    height: 72,
    borderRadius: 999,
    backgroundColor: '#000',
    color: '#fff',
    fontSize: 36,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 72,
    overflow: 'hidden',
  },
  okTitle: { fontSize: 20, fontWeight: '800', color: '#000', marginTop: 16 },
  okTotal: { fontSize: 36, fontWeight: '800', color: '#000', marginTop: 6, letterSpacing: -0.5 },
  okSub: { fontSize: 13, color: '#888', marginTop: 4, marginBottom: 8 },
});
