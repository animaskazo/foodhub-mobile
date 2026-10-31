import React, { useCallback, useRef } from 'react';
import { FlatList, SectionList, StyleSheet, Text, View } from 'react-native';

// Every page owns its vertical list. Restoring an offscreen page never resizes
// the viewport or scrolls its neighbors.
export default React.memo(function PosCatalogPage({ pageKey, width, products, sections, title, renderCard, onScroll, readOffset, contentStyle }) {
  const listRef = useRef(null);
  const restored = useRef(false);
  const restore = useCallback(() => {
    if (restored.current || !listRef.current) return;
    restored.current = true;
    const y = readOffset(pageKey);
    if (y > 0) listRef.current.getScrollResponder()?.scrollTo({ y, animated: false });
  }, [pageKey, readOffset]);
  const common = {
    ref: listRef,
    onLayout: restore,
    onScroll,
    scrollEventThrottle: 16,
    style: styles.list,
    contentContainerStyle: contentStyle,
    showsVerticalScrollIndicator: false,
    directionalLockEnabled: true,
    nestedScrollEnabled: true,
    keyboardShouldPersistTaps: 'handled',
    keyboardDismissMode: 'on-drag',
    initialNumToRender: sections ? 4 : 8,
    maxToRenderPerBatch: sections ? 4 : 8,
    windowSize: 5,
    removeClippedSubviews: false,
  };
  return <View style={[styles.list, { width }]}>
    {sections ? <SectionList {...common}
      sections={sections}
      stickySectionHeadersEnabled={false}
      keyExtractor={row => row.map(product => product.id).join(':')}
      renderSectionHeader={({ section }) => <Text style={styles.section}>{section.name} · {section.count}</Text>}
      renderItem={({ item: pair }) => <View style={styles.row}>
        {pair.map(product => <View key={product.id} style={styles.cell}>{renderCard({ item: product })}</View>)}
        {pair.length === 1 && <View style={styles.cell} />}
      </View>}
      ListEmptyComponent={<Text style={styles.empty}>Sin productos disponibles.</Text>}
    /> : <FlatList {...common}
      data={products}
      numColumns={2}
      keyExtractor={product => product.id}
      columnWrapperStyle={styles.row}
      ListHeaderComponent={<Text style={styles.section}>{title} · {products.length}</Text>}
      renderItem={renderCard}
      ListEmptyComponent={<Text style={styles.empty}>Sin productos para esta selección.</Text>}
    />}
  </View>;
});
const styles = StyleSheet.create({
  list: { flex: 1 }, row: { flexDirection: 'row', gap: 10 }, cell: { flex: 1 },
  section: { fontSize: 15, fontWeight: '700', color: '#000', marginTop: 8, marginBottom: 6, paddingHorizontal: 4 },
  empty: { color: '#8E8E93', fontSize: 13, textAlign: 'center', marginTop: 24 },
});
