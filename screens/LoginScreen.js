import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Pressable,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import { Eye, EyeOff } from 'lucide-react-native';
import { supabase } from '../lib/supabase';

export default function LoginScreen() {
  const passwordInput = useRef(null);
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const openingLink = useRef(false);

  const openAccountPage = async (url) => {
    if (openingLink.current) return;
    openingLink.current = true;
    Keyboard.dismiss();
    setError('');
    try {
      await WebBrowser.openBrowserAsync(url, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
        dismissButtonStyle: 'close',
        toolbarColor: '#FFFFFF',
        controlsColor: '#111111',
        createTask: false,
      });
    } catch {
      setError('No se pudo abrir la página. Inténtalo de nuevo.');
    } finally {
      openingLink.current = false;
    }
  };

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError('Ingresa tu correo y contraseña.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (authError) throw authError;

      const { data: staff } = await supabase
        .from('staff')
        .select('is_active')
        .eq('id', data.user.id)
        .maybeSingle();
      if (staff && staff.is_active === false) {
        await supabase.auth.signOut();
        setError('Cuenta desactivada. Habla con tu administrador.');
        return;
      }
      if (data.user?.user_metadata?.must_change_pin === true) {
        await supabase.auth.signOut();
        setError('Tienes un PIN pendiente. Cámbialo primero en la versión web.');
        return;
      }
    } catch (err) {
      setError(
        err.message === 'Invalid login credentials'
          ? 'Correo o contraseña incorrectos.'
          : err.message || 'No se pudo iniciar sesión.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={styles.brand} accessibilityLabel="FoodHub">FoodHub</Text>
          <View style={styles.body}>
            <View style={styles.form}>
              <Text style={styles.heading} accessibilityRole="header">Inicia sesión</Text>
              <Text style={styles.description}>Ingresa tu correo y contraseña{ '\n' }para acceder a tu cuenta.</Text>

              <TextInput
                style={[styles.input, email.length > 0 && styles.inputFilled, focused === 'email' && styles.inputFocused]}
                accessibilityLabel="Correo electrónico"
                value={email} onChangeText={setEmail} placeholder="Correo electrónico"
                placeholderTextColor="#8E8E93" autoCapitalize="none" autoCorrect={false}
                keyboardType="email-address" autoComplete="email" textContentType="emailAddress"
                returnKeyType="next" onSubmitEditing={() => passwordInput.current?.focus()}
                onFocus={() => setFocused('email')} onBlur={() => setFocused(null)} editable={!loading}
              />

              <View style={[styles.passwordField, password.length > 0 && styles.inputFilled, focused === 'password' && styles.inputFocused]}>
                <TextInput ref={passwordInput} style={styles.passwordInput} accessibilityLabel="Contraseña"
                  value={password} onChangeText={setPassword} placeholder="Contraseña"
                  placeholderTextColor="#8E8E93" secureTextEntry={!showPassword}
                  autoCapitalize="none" autoCorrect={false} autoComplete="current-password" textContentType="password"
                  onFocus={() => setFocused('password')} onBlur={() => setFocused(null)}
                  editable={!loading} onSubmitEditing={handleLogin} returnKeyType="go"
                />
                <Pressable accessibilityRole="button" accessibilityLabel={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  onPress={() => setShowPassword(value => !value)} style={styles.eye} disabled={loading}>
                  {showPassword ? <EyeOff size={21} color="#111" /> : <Eye size={21} color="#111" />}
                </Pressable>
              </View>

              <View style={styles.errorSlot} accessibilityLiveRegion="polite">
                {error ? <Text style={styles.error}>{error}</Text> : null}
              </View>
              <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={handleLogin}
                disabled={loading} accessibilityRole="button" accessibilityLabel="Iniciar sesión" accessibilityState={{ disabled: loading, busy: loading }} activeOpacity={0.75}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Iniciar sesión</Text>}
              </TouchableOpacity>
              <View style={styles.signupRow}>
                <Text style={styles.signupPrompt}>¿No tienes cuenta?</Text>
                <Pressable accessibilityRole="button" disabled={loading} style={styles.accountLink}
                  onPress={() => openAccountPage('https://app.foodhub.work/signup')}>
                  <Text style={styles.accountLinkText}>Regístrate gratis</Text>
                </Pressable>
              </View>
              <View style={styles.recoveryRow}>
                <Pressable accessibilityRole="button" disabled={loading} style={styles.accountLink}
                  onPress={() => openAccountPage('https://app.foodhub.work/forgot-password')}>
                  <Text style={styles.accountLinkText}>¿Olvidaste tu contraseña?</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  content: { flexGrow: 1, paddingHorizontal: 28 },
  brand: { textAlign: 'center', fontSize: 30, lineHeight: 38, fontWeight: '700', color: '#000', letterSpacing: -1, paddingTop: 20, paddingBottom: 20 },
  body: { flex: 1, justifyContent: 'center', paddingTop: 32, paddingBottom: 32 },
  form: { width: '100%', maxWidth: 420, alignSelf: 'center' },
  heading: { fontSize: 30, lineHeight: 38, fontWeight: '800', color: '#000', letterSpacing: -0.8, textAlign: 'center' },
  description: { fontSize: 16, lineHeight: 23, color: '#787878', textAlign: 'center', marginTop: 12, marginBottom: 36 },
  recoveryRow: { alignItems: 'center', marginTop: 8 },
  signupRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', columnGap: 4, marginTop: 24 },
  signupPrompt: { fontSize: 14, lineHeight: 21, color: '#787878' },
  accountLink: { minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  accountLinkText: { fontSize: 14, lineHeight: 21, fontWeight: '600', color: '#787878', textDecorationLine: 'underline', textAlign: 'center' },
  input: { minHeight: 56, borderRadius: 28, borderWidth: 1, borderColor: '#E2E5EA', backgroundColor: '#FFFFFF', paddingHorizontal: 20, paddingVertical: 14, fontSize: 16, color: '#000' },
  inputFilled: { backgroundColor: '#F5F5F5' },
  inputFocused: { borderColor: '#6E6E73' },
  passwordField: { flexDirection: 'row', alignItems: 'center', marginTop: 20, minHeight: 56, borderRadius: 28, borderWidth: 1, borderColor: '#E2E5EA', backgroundColor: '#FFFFFF', paddingLeft: 20, paddingRight: 8 },
  passwordInput: { flex: 1, minHeight: 54, paddingVertical: 14, fontSize: 16, color: '#000' },
  eye: { width: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  errorSlot: { minHeight: 48, paddingTop: 8, paddingHorizontal: 20, paddingBottom: 4 },
  error: { color: '#B42318', fontSize: 13, lineHeight: 18 },
  button: { backgroundColor: '#000', borderRadius: 28, marginTop: 8, minHeight: 56, paddingHorizontal: 20, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 18, lineHeight: 26 },
});
