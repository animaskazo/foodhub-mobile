import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function ScreenHeader({ title, description, action }) {
  return <View style={styles.header}>
    <View style={styles.titleRow}>
      <Text accessibilityRole="header" style={styles.title}>{title}</Text>
      {action}
    </View>
    <Text style={styles.description}>{description}</Text>
  </View>;
}
const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  title: { flex: 1, fontSize: 30, lineHeight: 38, fontWeight: '800', color: '#000', letterSpacing: -0.7 },
  description: { fontSize: 13, lineHeight: 19, fontWeight: '400', color: '#8E8E93', marginTop: 5 },
});
