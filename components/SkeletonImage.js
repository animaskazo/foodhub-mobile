import React, { useState } from 'react';
import { Image, View, StyleSheet } from 'react-native';
import { ImageOff } from 'lucide-react-native';
import { Bone } from './Skeleton';

function LoadingImage({ source, style, onLoad, onError, ...props }) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  return <View style={[style, { overflow: 'hidden' }]} accessibilityState={{ busy: !ready }}>
    {failed ? <View style={s.fallback}><ImageOff size={20} color="#8E8E93" /></View> : <Image {...props} source={source}
      style={[StyleSheet.absoluteFill, !ready && { opacity: 0 }]}
      onLoad={event => { setReady(true); onLoad?.(event); }}
      onError={event => { setReady(true); setFailed(true); onError?.(event); }} />}
    {!ready && <Bone radius={0} style={StyleSheet.absoluteFill} />}
  </View>;
}

// Reset readiness when a recycled list row receives another image.
export default function SkeletonImage(props) {
  return <LoadingImage key={props.source?.uri || String(props.source)} {...props} />;
}
const s = StyleSheet.create({ fallback: { ...StyleSheet.absoluteFillObject, backgroundColor: '#E3E3E8', alignItems: 'center', justifyContent: 'center' } });
