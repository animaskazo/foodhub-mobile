import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from './supabase';

export const pushPilotEnabled = process.env.EXPO_PUBLIC_PUSH_PILOT === 'true' && Platform.OS !== 'web';
let deviceIdPromise;
let registration = Promise.resolve(false);
let generation = 0;
const optedKey = userId => `push-pilot:opted:${userId}`;

async function deviceId() {
  if (!deviceIdPromise) deviceIdPromise = (async () => {
    let id = await AsyncStorage.getItem('push-pilot:device-id');
    if (!id) {
      id = Crypto.randomUUID();
      await AsyncStorage.setItem('push-pilot:device-id', id);
    }
    return id;
  })();
  return deviceIdPromise;
}

export async function pilotInfo() {
  const { data, error } = await supabase.rpc('push_pilot_info');
  if (error) throw new Error('La prueba de notificaciones aún no está disponible.');
  if (!data) throw new Error('Tu cuenta aún no está habilitada para esta prueba.');
  return data;
}

export function registerPush(userId, requestPermission = false) {
  const currentGeneration = generation;
  const task = registration.catch(() => {}).then(async () => {
    if (!pushPilotEnabled || currentGeneration !== generation) return false;
    if (!requestPermission && await AsyncStorage.getItem(optedKey(userId)) !== 'true') return false;
    const info = await pilotInfo();
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId || projectId !== info.expo_project_id) throw new Error('Falta configurar el proyecto Expo de esta prueba.');
    if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('new-orders', {
      name: 'Pedidos nuevos', importance: Notifications.AndroidImportance.HIGH, sound: 'default',
    });
    let permissions = await Notifications.getPermissionsAsync();
    if (!permissions.granted && requestPermission && permissions.canAskAgain) permissions = await Notifications.requestPermissionsAsync();
    if (!permissions.granted) {
      const { error } = await supabase.rpc('unregister_push_device', { p_id: await deviceId() });
      if (error) throw new Error('No se pudo desactivar el registro anterior. Inténtalo de nuevo.');
      await AsyncStorage.removeItem(optedKey(userId));
      if (requestPermission) throw new Error('Permite las notificaciones en Ajustes para recibir pedidos nuevos.');
      return false;
    }
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user.id !== userId || currentGeneration !== generation) return false;
    const { error } = await supabase.rpc('register_push_device', {
      p_id: await deviceId(), p_token: token, p_platform: Platform.OS, p_project_id: projectId,
    });
    if (error) throw new Error('No se pudo registrar este dispositivo. Inténtalo de nuevo.');
    await AsyncStorage.setItem(optedKey(userId), 'true');
    return true;
  });
  registration = task;
  return task;
}

export async function unregisterPush() {
  generation++;
  await registration.catch(() => {});
  if (!pushPilotEnabled) return;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session || await AsyncStorage.getItem(optedKey(session.user.id)) !== 'true') return;
  const { error } = await supabase.rpc('unregister_push_device', { p_id: await deviceId() });
  if (error) throw new Error('No se pudieron desactivar las notificaciones. Revisa tu conexión e inténtalo de nuevo.');
  await AsyncStorage.removeItem(optedKey(session.user.id));
}
