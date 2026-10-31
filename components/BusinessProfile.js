import Image from './SkeletonImage';
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { X, Phone, Mail, MapPin, Info } from 'lucide-react-native';
import { peekMyStore } from '../lib/store';

// Perfil del negocio en pageSheet: avatar, datos básicos de contacto
// y salida de sesión. Sin montos ni acciones de venta.
export default function BusinessProfile({ visible, onClose, onLogout }) {
  const org = peekMyStore()?.org || {};
  const logo = org.logo_url || org.cover_url || null;

  const rows = [
    org.phone
      ? { Icon: Phone, label: 'Teléfono', value: org.phone }
      : null,
    org.email
      ? { Icon: Mail, label: 'Correo', value: org.email }
      : null,
    org.address
      ? { Icon: MapPin, label: 'Dirección', value: org.address }
      : null,
    org.description
      ? { Icon: Info, label: 'Acerca de', value: org.description }
      : null,
  ].filter(Boolean);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.grabber} />
        <View style={styles.header}>
          <Text style={styles.title}>Negocio</Text>
          <TouchableOpacity
            onPress={onClose}
            style={styles.close}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Cerrar perfil"
          >
            <X size={17} color="#3A3A3C" strokeWidth={2.5} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.identity}>
            {logo ? (
              <Image source={{ uri: logo }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarText}>
                  {(org.name || 'M').charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <Text style={styles.name} numberOfLines={2}>
              {org.name || 'Mi local'}
            </Text>
          </View>

          {rows.length > 0 ? (
            <View style={styles.group}>
              {rows.map(({ Icon, label, value }, i) => (
                <View
                  key={label}
                  style={[styles.row, i === rows.length - 1 && styles.rowLast]}
                >
                  <Icon size={17} color="#8E8E93" />
                  <View style={styles.rowBody}>
                    <Text style={styles.rowLabel}>{label}</Text>
                    <Text style={styles.rowValue}>{value}</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.hint}>
              Completa los datos de tu negocio en el panel web para verlos aquí.
            </Text>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.logout}
            onPress={onLogout}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Cerrar sesión"
          >
            <Text style={styles.logoutText}>Cerrar sesión</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7', paddingTop: 8 },
  grabber: {
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#C7C7CC',
    alignSelf: 'center',
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  title: { fontSize: 28, fontWeight: '800', color: '#000', letterSpacing: -0.5 },
  close: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#E3E3E8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, marginTop: 12 },
  bodyContent: { paddingHorizontal: 16, paddingBottom: 16 },
  identity: { alignItems: 'center', marginTop: 8, marginBottom: 20 },
  avatar: { width: 84, height: 84, borderRadius: 42, backgroundColor: '#E3E3E8' },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 34, fontWeight: '800', color: '#000' },
  name: {
    fontSize: 22,
    fontWeight: '800',
    color: '#000',
    letterSpacing: -0.3,
    marginTop: 12,
    textAlign: 'center',
  },
  group: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.06)',
    borderRadius: 14,
    paddingLeft: 14,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 11,
    paddingRight: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  rowLast: { borderBottomWidth: 0 },
  rowBody: { flex: 1 },
  rowLabel: { fontSize: 11, fontWeight: '600', color: '#8E8E93' },
  rowValue: { fontSize: 15, fontWeight: '600', color: '#000', marginTop: 1 },
  hint: { fontSize: 13, color: '#8E8E93', textAlign: 'center', marginTop: 24, lineHeight: 18 },
  footer: { padding: 16, paddingBottom: 28 },
  // Salida de sesión: acción destructiva en rojo sobre neutro (§16).
  logout: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.06)',
    borderRadius: 16,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutText: { color: '#FF3B30', fontWeight: '700', fontSize: 17 },
});
