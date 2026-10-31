import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, usePathname } from 'expo-router';
import { MAIN_TABS } from './components/MainTabs';
import { supabase } from './lib/supabase';
import { getMyStore, clearStoreCache } from './lib/store';
import TabBar from './components/TabBar';
import LoginScreen from './screens/LoginScreen';
import DashboardScreen from './screens/DashboardScreen';
import SalesScreen from './screens/SalesScreen';
import SellScreen from './screens/SellScreen';
import { LoginSkeleton } from './components/Skeleton';

export default function App() {
  const { section } = useLocalSearchParams();
  const pathname = usePathname();
  const focused = pathname === '/';
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(true);
  const [tab, setTab] = useState(section || 'dashboard');
  useEffect(() => {
    if (['dashboard', 'sales', 'sell'].includes(section)) setTab(section);
  }, [section]);
  const [storeName, setStoreName] = useState('');
  const [storeLogo, setStoreLogo] = useState(null);
  // Secciones de flujo completo (p. ej. cobro) ocultan la barra.
  const [tabBarVisible, setTabBarVisible] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
      setChecking(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (!s) {
        clearStoreCache();
        setTab('dashboard');
        setStoreName('');
        setStoreLogo(null);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    getMyStore()
      .then(({ org }) => {
        setStoreName(org.name);
        setStoreLogo(org.logo_url || null);
      })
      .catch(() => {
        setStoreName('');
        setStoreLogo(null);
      });
  }, [session]);

  if (checking) {
    return <LoginSkeleton />;
  }

  if (!session) return <LoginScreen />;

  return (
    <SafeAreaProvider>
    <SafeAreaView style={styles.container} edges={tab === 'dashboard' ? [] : ['top']}>
      <StatusBar style="dark" />
      <View style={styles.body}>
        {/* Tabs siempre montados: cambiar de tab no desmonta ni refetchea
            con spinner, solo muestra lo cacheado y revalida por detrás. */}
        <View style={[styles.tabPage, tab === 'dashboard' && styles.tabPageActive]}>
          <DashboardScreen
            storeName={storeName}
            storeLogo={storeLogo}
            onLogout={() => setSession(null)}
            onSell={() => setTab('sell')}
            active={focused && tab === 'dashboard'}
          />
        </View>
        <View style={[styles.tabPage, tab === 'sales' && styles.tabPageActive]}>
          <SalesScreen active={focused && tab === 'sales'} />
        </View>
        <View style={[styles.tabPage, tab === 'sell' && styles.tabPageActive]}>
          <SellScreen
            active={focused && tab === 'sell'}
            onFullscreenChange={setTabBarVisible}
          />
        </View>
        {/* Barra flotante translúcida: el contenido scrollea por debajo.
            Se oculta en secciones de flujo completo (cobro). */}
        {tabBarVisible && <TabBar tabs={MAIN_TABS} active={tab} onChange={(id) => {
          if (id === 'products') router.push('/products');
          else { setTab(id); router.setParams({ section: id }); }
        }} />}
      </View>
    </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1 },
  tabPage: { flex: 1, display: 'none' },
  tabPageActive: { display: 'flex' },
});
