import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Animated,
  AccessibilityInfo,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Espacio libre que las pantallas deben dejar abajo para que el
// contenido nunca quede oculto tras la barra flotante.
export const TAB_BAR_CLEARANCE = 112;

function TabButton({ tab: { id, label, Icon }, selected, reduceMotion, onChange }) {
  const [focus] = useState(() => new Animated.Value(selected ? 1 : 0));
  useEffect(() => {
    if (reduceMotion) {
      focus.stopAnimation();
      focus.setValue(selected ? 1 : 0);
      return;
    }
    const transition = Animated.timing(focus, {
      toValue: selected ? 1 : 0,
      duration: 150,
      useNativeDriver: Platform.OS !== 'web',
      isInteraction: false,
    });
    transition.start();
    return () => transition.stop();
  }, [selected, reduceMotion, focus]);

  return <Pressable
    onPress={() => {
      if (selected) return;
      Haptics.selectionAsync().catch(() => {});
      onChange(id);
    }}
    hitSlop={12}
    delayPressIn={0}
    accessibilityRole="tab"
    accessibilityState={{ selected }}
    accessibilityLabel={label}
    style={({ pressed }) => [styles.cell, pressed && styles.cellPressed]}>
    <Animated.View pointerEvents="none" style={[styles.pill, { opacity: focus }]} />
    <View pointerEvents="none" style={styles.icon}>
      <Icon size={24} color={selected ? '#fff' : '#000'} strokeWidth={selected ? 2.4 : 2} />
    </View>
  </Pressable>;
}

export default function TabBar({ tabs, active, onChange }) {
  const insets = useSafeAreaInsets();
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then(value => {
      if (mounted) setReduceMotion(value);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { mounted = false; subscription.remove(); };
  }, []);

  return (
    <View
      style={[styles.wrap, { bottom: Math.max(insets.bottom, 0) + 2 }]}
      pointerEvents="box-none"
    >
      <View style={styles.bar}>
        <BlurView intensity={75} tint="light" style={StyleSheet.absoluteFill} />
        <View style={styles.tint} pointerEvents="none" />
        <View style={styles.edge} pointerEvents="none" />
        <View style={styles.row}>
          {tabs.map(tab => <TabButton key={tab.id} tab={tab} selected={tab.id === active}
            reduceMotion={reduceMotion} onChange={onChange} />)}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 16,
    right: 16,
  },
  bar: {
    borderRadius: 30,
    overflow: 'hidden',
    // Sombra contextual: separa el material del contenido (§12).
    shadowColor: '#000',
    shadowOpacity: Platform.OS === 'ios' ? 0.12 : 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
    // Borde brillante: la luz atrapa el material (§12).
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
  },
  tint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(244,244,246,0.42)',
  },
  edge: {
    position: 'absolute',
    top: 0,
    left: 20,
    right: 20,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  row: {
    flexDirection: 'row',
    padding: 6,
  },
  // Capa sólida para el color: el acento va en sólido, no en translúcido (§12).
  pill: {
    position: 'absolute',
    left: 4,
    right: 4,
    top: 0,
    bottom: 0,
    backgroundColor: '#000',
    borderRadius: 24,
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 54,
    paddingVertical: 12,
    borderRadius: 24,
  },
  icon: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  // Feedback instantáneo al presionar, commit al soltar (§1, §10).
  cellPressed: {
    transform: [{ scale: 0.94 }],
    opacity: 0.7,
  },
});
