import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, AppState, Animated, Image, StyleSheet, View, Text } from 'react-native';
import { useEvent } from 'expo';
import { LinearGradient } from 'expo-linear-gradient';
import { Bone } from './Skeleton';
import { useVideoPlayer, VideoView } from 'expo-video';

function VideoCover({ uri, active }) {
  const [foreground, setForeground] = useState(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  const [reduceMotion, setReduceMotion] = useState(true);
  const player = useVideoPlayer(uri, (video) => {
    video.loop = true;
    video.muted = true;
  });
  const { status } = useEvent(player, 'statusChange', { status: player.status });

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    const app = AppState.addEventListener('change', (state) => setForeground(state === 'active'));
    return () => { motion.remove(); app.remove(); };
  }, []);

  useEffect(() => {
    if (status !== 'readyToPlay') return;
    if (active && foreground && !reduceMotion) player.play();
    else player.pause();
  }, [active, foreground, reduceMotion, player, status]);

  if (status === 'error') return <View style={styles.error}><Text style={styles.errorText}>No se pudo cargar el video de portada.</Text></View>;
  return <View style={styles.video}>
    <VideoView player={player} style={styles.video} contentFit="cover"
      nativeControls={false} surfaceType="textureView" allowsPictureInPicture={false} />
    {(status === 'loading' || status === 'idle') && <Bone radius={0} style={StyleSheet.absoluteFill} />}
  </View>;
}

export const COVER_HEIGHT = 110;

export default function StoreCover({ uri, active, scrollY, height = COVER_HEIGHT }) {
  const [reduceMotion, setReduceMotion] = useState(true);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => subscription.remove();
  }, []);
  const [failedUri, setFailedUri] = useState(null);
  const [loadedUri, setLoadedUri] = useState(null);
  const video = /\.(mp4|mov|m4v|webm|m3u8)(?:[?#]|$)/i.test(uri || '') || (uri && failedUri === uri);
  return (
    <View style={[styles.cover, { height }]} pointerEvents="none" accessible={false}>
      <Animated.View collapsable={false} style={[styles.media, !reduceMotion && scrollY && { transform: [
        { translateY: scrollY.interpolate({ inputRange: [-600, 0, 120], outputRange: [-300, 0, 30], extrapolateRight: 'clamp' }) },
        { scale: scrollY.interpolate({ inputRange: [-600, 0], outputRange: [1 + 600 / height, 1], extrapolateRight: 'clamp' }) },
      ] } ]}>
      {uri ? (
        video ? <VideoCover key={uri} uri={uri} active={active} /> :
          <>
            <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover"
              onLoad={() => setLoadedUri(uri)} onError={() => setFailedUri(uri)} />
            {loadedUri !== uri && <Bone radius={0} style={StyleSheet.absoluteFill} />}
          </>
      ) : null}
      <LinearGradient
        colors={['rgba(0,0,0,0.16)', 'rgba(0,0,0,0.12)', 'rgba(0,0,0,0.82)']}
        locations={[0, 0.35, 1]}
        style={StyleSheet.absoluteFill}
      />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { width: '100%', height: COVER_HEIGHT },
  media: { width: '100%', height: '100%', backgroundColor: '#DDE6E1', overflow: 'hidden' },
  video: { width: '100%', height: '100%' },
  error: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
  errorText: { color: '#475569', fontSize: 12, textAlign: 'center' },
});
