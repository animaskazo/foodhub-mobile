import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function ProductSelectionSummary({ line }) {
  const extras = line.selection?.extras || [];
  return <View>
    {line.variantLabel ? <Text style={s.detail}>{line.variantLabel}</Text> : null}
    {extras.length ? <View style={s.extras}>
      <Text style={s.label}>Extras</Text>
      {extras.map(extra => <Text key={extra.id} style={s.detail}>
        + {extra.name}
      </Text>)}
    </View> : line.extrasLabel ? <Text style={s.detail}>{line.extrasLabel}</Text> : null}
  </View>;
}
const s = StyleSheet.create({
  extras: { marginTop: 4 }, label: { fontSize: 11, lineHeight: 16, fontWeight: '600', color: '#6E6E73' },
  detail: { fontSize: 12, lineHeight: 18, color: '#6E6E73', marginTop: 1 },
});
