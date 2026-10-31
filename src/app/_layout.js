import React from 'react';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SkeletonProvider } from '../../components/Skeleton';
export default function Layout() {
  return <SafeAreaProvider><SkeletonProvider><Stack screenOptions={{ headerShown: false, animation: 'none', gestureEnabled: false }} /></SkeletonProvider></SafeAreaProvider>;
}
