import React, { useState, useEffect } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { supabase } from '../lib/supabase'
import { colors } from '../theme'

export default function QRScannerScreen({ navigation }) {
  const [permission, requestPermission] = useCameraPermissions()
  const [scanned, setScanned] = useState(false)
  const [connecting, setConnecting] = useState(false)

  useEffect(() => {
    if (!permission?.granted) requestPermission()
  }, [])

  async function handleBarCodeScanned({ data }) {
    if (scanned || connecting) return
    setScanned(true)

    // Expected format: nearbyme://user/<userId>
    const match = data.match(/^nearbyme:\/\/user\/([a-f0-9-]+)$/)
    if (!match) {
      Alert.alert('Ungültiger Code', 'Das ist kein gültiger nearbyme QR-Code.', [
        { text: 'Nochmal', onPress: () => setScanned(false) }
      ])
      return
    }

    const targetUserId = match[1]
    setConnecting(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    if (targetUserId === user.id) {
      Alert.alert('Oops', 'Das ist dein eigener QR-Code! 😄', [
        { text: 'OK', onPress: () => setScanned(false) }
      ])
      setConnecting(false)
      return
    }

    // Check if already connected
    const { data: existing } = await supabase
      .from('connections')
      .select('id')
      .or(`and(user1_id.eq.${user.id},user2_id.eq.${targetUserId}),and(user1_id.eq.${targetUserId},user2_id.eq.${user.id})`)
      .single()

    if (existing) {
      setConnecting(false)
      Alert.alert('Bereits verbunden!', 'Ihr seid schon in Kontakt.', [
        { text: 'Zum Chat', onPress: () => navigation.replace('Chat', { connectionId: existing.id, userId: targetUserId }) }
      ])
      return
    }

    // Create connection (always user1 = smaller UUID for uniqueness)
    const [u1, u2] = [user.id, targetUserId].sort()
    const { data: conn, error } = await supabase
      .from('connections')
      .insert({ user1_id: u1, user2_id: u2 })
      .select()
      .single()

    setConnecting(false)

    if (error) {
      Alert.alert('Fehler', 'Verbindung konnte nicht hergestellt werden.')
      setScanned(false)
      return
    }

    // Get target profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', targetUserId)
      .single()

    Alert.alert(
      '🎉 Verbunden!',
      `Du bist jetzt mit ${profile?.username || 'diesem Nutzer'} verbunden!`,
      [{ text: 'Zum Chat', onPress: () => navigation.replace('Chat', { connectionId: conn.id, otherUserId: targetUserId }) }]
    )
  }

  if (!permission) return <View style={styles.container} />

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.permText}>Kamera-Zugriff wird benötigt</Text>
        <TouchableOpacity style={styles.btn} onPress={requestPermission}>
          <Text style={styles.btnText}>Erlauben</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        facing="back"
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
      />

      {/* Overlay */}
      <View style={styles.overlay}>
        <View style={styles.topSection}>
          <TouchableOpacity style={styles.closeBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.title}>QR-Code scannen</Text>
          <Text style={styles.subtitle}>Halte die Kamera auf den Code einer anderen Person</Text>
        </View>

        <View style={styles.scanArea}>
          <View style={styles.corner} />
          <View style={[styles.corner, styles.cornerTR]} />
          <View style={[styles.corner, styles.cornerBL]} />
          <View style={[styles.corner, styles.cornerBR]} />
        </View>

        {connecting && (
          <View style={styles.connectingBox}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.connectingText}>Verbindung wird hergestellt...</Text>
          </View>
        )}

        {scanned && !connecting && (
          <TouchableOpacity style={styles.rescanBtn} onPress={() => setScanned(false)}>
            <Text style={styles.rescanText}>🔄 Nochmal scannen</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'space-between', alignItems: 'center', paddingVertical: 60,
  },
  topSection: { alignItems: 'center', width: '100%', paddingHorizontal: 24 },
  closeBtn: {
    position: 'absolute', left: 24, top: 0,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center',
  },
  closeText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  title: { color: '#fff', fontSize: 22, fontWeight: '700', marginTop: 8, marginBottom: 8 },
  subtitle: { color: 'rgba(255,255,255,0.7)', fontSize: 14, textAlign: 'center' },
  scanArea: {
    width: 240, height: 240,
    position: 'relative',
    justifyContent: 'center', alignItems: 'center',
  },
  corner: {
    position: 'absolute', top: 0, left: 0,
    width: 36, height: 36,
    borderTopWidth: 4, borderLeftWidth: 4,
    borderColor: colors.primary, borderRadius: 4,
  },
  cornerTR: { left: undefined, right: 0, borderLeftWidth: 0, borderRightWidth: 4 },
  cornerBL: { top: undefined, bottom: 0, borderTopWidth: 0, borderBottomWidth: 4 },
  cornerBR: { top: undefined, bottom: 0, left: undefined, right: 0, borderTopWidth: 0, borderLeftWidth: 0, borderBottomWidth: 4, borderRightWidth: 4 },
  connectingBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(255,255,255,0.9)', paddingHorizontal: 20, paddingVertical: 14,
    borderRadius: 16,
  },
  connectingText: { color: colors.text, fontWeight: '600' },
  rescanBtn: {
    backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 14,
    borderRadius: 14,
  },
  rescanText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  permText: { color: '#fff', fontSize: 16, textAlign: 'center', marginBottom: 20, paddingHorizontal: 32 },
  btn: { backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
})
