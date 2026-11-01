import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { supabase } from '../lib/supabase';
import { pilotInfo, pushPilotEnabled, registerPush, unregisterPush } from '../lib/push';
import { parseOrderPush } from '../lib/pushPayload.mjs';

const Context = createContext(null);
if (pushPilotEnabled) Notifications.setNotificationHandler({
  handleNotification: async notification => {
    const show = !!parseOrderPush(notification.request.content.data);
    return { shouldShowBanner: show, shouldShowList: show, shouldPlaySound: show, shouldSetBadge: false };
  },
});

export function PushPilotProvider({ children }) {
  const [userId, setUserId] = useState(null);
  const [pending, setPending] = useState(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const handledResponse = useRef(null);
  useEffect(() => {
    if (!pushPilotEnabled) return;
    let alive = true;
    supabase.auth.getSession().then(({ data }) => { if (alive) setUserId(data.session?.user.id || null); });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id || null);
      if (!session) { setEnabled(false); setMessage(''); }
    });
    const receive = response => {
      const id = response?.notification.request.identifier;
      if (!id || id === handledResponse.current) return;
      const data = parseOrderPush(response?.notification.request.content.data);
      if (data) { handledResponse.current = id; setPending(data); }
    };
    const listener = Notifications.addNotificationResponseReceivedListener(receive);
    Notifications.getLastNotificationResponseAsync().then(response => {
      if (alive && response) receive(response);
    }).catch(() => {});
    return () => { alive = false; sub.subscription.unsubscribe(); listener.remove(); };
  }, []);

  useEffect(() => {
    if (!userId || !pushPilotEnabled) return;
    let alive = true;
    const renew = () => registerPush(userId).then(value => { if (alive) setEnabled(value); }).catch(error => {
      if (alive) setMessage(error.message);
    });
    renew();
    const timer = setInterval(renew, 60 * 60 * 1000);
    const foreground = AppState.addEventListener('change', state => { if (state === 'active') renew(); });
    const rotation = Notifications.addPushTokenListener(renew);
    return () => { alive = false; clearInterval(timer); foreground.remove(); rotation.remove(); };
  }, [userId]);

  useEffect(() => {
    if (!pending || !userId) return;
    let alive = true;
    pilotInfo().then(info => {
      if (!alive) return;
      if (pending.organizationId === info.organization_id) router.replace({
        pathname: '/', params: { section: 'sales', orderId: pending.orderId },
      });
      else setMessage('Este pedido pertenece a otro negocio.');
      setPending(null);
      Notifications.clearLastNotificationResponseAsync().catch(() => {});
    }).catch(error => { if (alive) { setMessage(error.message); setPending(null); } });
    return () => { alive = false; };
  }, [pending, userId]);

  const toggle = async () => {
    if (!userId || busy) return;
    setBusy(true); setMessage('');
    try {
      if (enabled) { await unregisterPush(); setEnabled(false); }
      else setEnabled(await registerPush(userId, true));
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  };
  return <Context.Provider value={{ enabled, busy, message, toggle }}>{children}</Context.Provider>;
}

export default function PushPilotControl() {
  const state = useContext(Context);
  if (!pushPilotEnabled || !state) return null;
  return <View style={{ padding: 16, gap: 8 }}>
    <Pressable onPress={state.toggle} disabled={state.busy} accessibilityRole="button">
      <Text style={{ color: '#007AFF', fontSize: 16 }}>{state.busy ? 'Guardando…' : state.enabled ? 'Desactivar avisos de pedidos nuevos' : 'Activar avisos de pedidos nuevos'}</Text>
    </Pressable>
    {!!state.message && <Text accessibilityLiveRegion="polite">{state.message}</Text>}
  </View>;
}
