import React from 'react';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SkeletonProvider } from '../../components/Skeleton';
import { PushPilotProvider } from '../../components/PushPilot';
export default function Layout() {
  return <SafeAreaProvider><SkeletonProvider><PushPilotProvider><Stack screenOptions={{ headerShown: false, animation: 'none', gestureEnabled: false }} /></PushPilotProvider></SkeletonProvider></SafeAreaProvider>;
}
