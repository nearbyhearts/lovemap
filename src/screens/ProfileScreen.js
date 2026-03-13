import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Switch,
  Alert,
  ActivityIndicator,
  ScrollView,
  Image,
  Modal,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { supabase } from '../lib/supabase'
import QRCode from 'react-native-qrcode-svg'

const GENDER_OPTIONS = ['Mann', 'Frau', 'Nicht-binär', 'Andere']
const ORIENTATION_OPTIONS = ['Heterosexuell', 'Homosexuell', 'Bisexuell', 'Pansexuell', 'Andere']
const LOOKING_FOR_OPTIONS = ['Date', 'Freundschaft', 'Gespräch', 'Beziehung']

function SelectModal({ visible, title, options, selected, onSelect, onClose }) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={modal.overlay}>
        <View style={modal.container}>
          <Text style={modal.title}>{title}</Text>
          {options.map((opt) => (
            <TouchableOpacity
              key={opt}
              style={[modal.option, selected === opt && modal.optionSelected]}
              onPress={() => { onSelect(opt); onClose() }}
            >
              <Text style={[modal.optionText, selected === opt && modal.optionTextSelected]}>
                {opt}
              </Text>
              {selected === opt && <Text style={modal.check}>✓</Text>}
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={modal.cancelBtn} onPress={onClose}>
            <Text style={modal.cancelText}>Abbrechen</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

export default function ProfileScreen() {
  const [profile, setProfile] = useState(null)
  const [username, setUsername] = useState('')
  const [bio, setBio] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [gender, setGender] = useState('')
  const [height, setHeight] = useState('')
  const [orientation, setOrientation] = useState('')
  const [lookingFor, setLookingFor] = useState('')
  const [avatarUrl, setAvatarUrl] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [userId, setUserId] = useState(null)
  const [showQR, setShowQR] = useState(false)
  const [genderModal, setGenderModal] = useState(false)
  const [orientationModal, setOrientationModal] = useState(false)
  const [lookingForModal, setLookingForModal] = useState(false)

  useEffect(() => { loadProfile() }, [])

  async function loadProfile() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserId(user.id)

    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (data) {
      setProfile(data)
      setUsername(data.username || '')
      setBio(data.bio || '')
      setIsOpen(data.is_open || false)
      setGender(data.gender || '')
      setHeight(data.height ? String(data.height) : '')
      setOrientation(data.orientation || '')
      setLookingFor(data.looking_for || '')
      setAvatarUrl(data.avatar_url || null)
    }
    setLoading(false)
  }

  async function pickImage() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Berechtigung benötigt', 'Bitte erlaube den Zugriff auf deine Fotos.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    })
    if (!result.canceled && result.assets[0]) {
      await uploadAvatar(result.assets[0].uri)
    }
  }

  async function uploadAvatar(uri) {
    setUploading(true)
    try {
      const response = await fetch(uri)
      const blob = await response.blob()
      const arrayBuffer = await new Response(blob).arrayBuffer()
      const fileExt = uri.split('.').pop()
      const fileName = `${userId}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, arrayBuffer, {
          contentType: `image/${fileExt}`,
          upsert: true,
        })

      if (uploadError) throw uploadError

      const { data } = supabase.storage.from('avatars').getPublicUrl(fileName)
      const publicUrl = data.publicUrl + '?t=' + Date.now()

      await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', userId)
      setAvatarUrl(publicUrl)
    } catch (e) {
      Alert.alert('Upload-Fehler', e.message)
    }
    setUploading(false)
  }

  async function toggleOpen(value) {
    setIsOpen(value)
    await supabase.from('profiles').update({ is_open: value }).eq('id', userId)
  }

  async function saveProfile() {
    if (!username.trim()) {
      Alert.alert('Fehler', 'Benutzername darf nicht leer sein.')
      return
    }
    setSaving(true)
    const { error } = await supabase.from('profiles').update({
      username: username.trim(),
      bio: bio.trim(),
      gender,
      height: height ? parseInt(height) : null,
      orientation,
      looking_for: lookingFor,
      updated_at: new Date().toISOString(),
    }).eq('id', userId)

    if (error) Alert.alert('Fehler', 'Profil konnte nicht gespeichert werden.')
    else Alert.alert('Gespeichert ✅', 'Dein Profil wurde aktualisiert.')
    setSaving(false)
  }

  async function handleLogout() {
    Alert.alert('Ausloggen', 'Wirklich ausloggen?', [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Ausloggen', style: 'destructive', onPress: () => supabase.auth.signOut() },
    ])
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    )
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <Text style={styles.title}>Mein Profil</Text>

      {/* Avatar */}
      <View style={styles.avatarSection}>
        <TouchableOpacity onPress={pickImage} style={styles.avatarWrapper}>
          {uploading ? (
            <View style={styles.avatarPlaceholder}>
              <ActivityIndicator color="#4CAF50" />
            </View>
          ) : avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarEmoji}>📷</Text>
              <Text style={styles.avatarHint}>Foto hinzufügen</Text>
            </View>
          )}
        </TouchableOpacity>
        <Text style={styles.avatarSub}>Tippen zum Ändern</Text>
      </View>

      {/* Status Toggle */}
      <View style={styles.card}>
        <View style={styles.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.toggleLabel}>
              {isOpen ? '🟢 Offen für Gespräch' : '⚫ Nicht verfügbar'}
            </Text>
            <Text style={styles.toggleSub}>
              {isOpen ? 'Du bist auf der Karte sichtbar' : 'Du bist unsichtbar'}
            </Text>
          </View>
          <Switch
            value={isOpen}
            onValueChange={toggleOpen}
            trackColor={{ false: '#333', true: '#2e7d32' }}
            thumbColor={isOpen ? '#4CAF50' : '#666'}
          />
        </View>
      </View>

      {/* QR Code */}
      <TouchableOpacity style={styles.card} onPress={() => setShowQR(true)}>
        <View style={styles.qrRow}>
          <View>
            <Text style={styles.qrLabel}>📱 Mein QR-Code</Text>
            <Text style={styles.qrSub}>Andere scannen deinen Code um zu chatten</Text>
          </View>
          <Text style={styles.qrArrow}>›</Text>
        </View>
      </TouchableOpacity>

      {/* Profile Fields */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Über mich</Text>

        <Text style={styles.label}>Benutzername</Text>
        <TextInput
          style={styles.input}
          value={username}
          onChangeText={setUsername}
          placeholder="Dein Name"
          placeholderTextColor="#555"
        />

        <Text style={styles.label}>Bio</Text>
        <TextInput
          style={[styles.input, styles.bioInput]}
          value={bio}
          onChangeText={setBio}
          placeholder="Kurz über dich..."
          placeholderTextColor="#555"
          multiline
          numberOfLines={3}
        />

        <Text style={styles.label}>Größe (cm)</Text>
        <TextInput
          style={styles.input}
          value={height}
          onChangeText={setHeight}
          placeholder="z.B. 178"
          placeholderTextColor="#555"
          keyboardType="numeric"
          maxLength={3}
        />
      </View>

      {/* Categories */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Angaben</Text>

        <Text style={styles.label}>Geschlecht</Text>
        <TouchableOpacity style={styles.selector} onPress={() => setGenderModal(true)}>
          <Text style={gender ? styles.selectorValue : styles.selectorPlaceholder}>
            {gender || 'Auswählen...'}
          </Text>
          <Text style={styles.selectorArrow}>›</Text>
        </TouchableOpacity>

        <Text style={styles.label}>Sexuelle Orientierung</Text>
        <TouchableOpacity style={styles.selector} onPress={() => setOrientationModal(true)}>
          <Text style={orientation ? styles.selectorValue : styles.selectorPlaceholder}>
            {orientation || 'Auswählen...'}
          </Text>
          <Text style={styles.selectorArrow}>›</Text>
        </TouchableOpacity>

        <Text style={styles.label}>Ich suche</Text>
        <TouchableOpacity style={styles.selector} onPress={() => setLookingForModal(true)}>
          <Text style={lookingFor ? styles.selectorValue : styles.selectorPlaceholder}>
            {lookingFor || 'Auswählen...'}
          </Text>
          <Text style={styles.selectorArrow}>›</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.saveBtn} onPress={saveProfile} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Speichern</Text>}
      </TouchableOpacity>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>Ausloggen</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />

      {/* QR Modal */}
      <Modal visible={showQR} transparent animationType="fade">
        <View style={modal.overlay}>
          <View style={[modal.container, { alignItems: 'center' }]}>
            <Text style={modal.title}>Dein QR-Code</Text>
            <Text style={[modal.cancelText, { color: '#aaa', marginBottom: 24, fontSize: 13 }]}>
              Lass andere diesen Code scannen
            </Text>
            {userId && (
              <View style={styles.qrContainer}>
                <QRCode
                  value={`lovemap://user/${userId}`}
                  size={200}
                  backgroundColor="#1e1e1e"
                  color="#fff"
                />
              </View>
            )}
            <TouchableOpacity style={[modal.cancelBtn, { marginTop: 24 }]} onPress={() => setShowQR(false)}>
              <Text style={modal.cancelText}>Schließen</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Select Modals */}
      <SelectModal
        visible={genderModal}
        title="Geschlecht"
        options={GENDER_OPTIONS}
        selected={gender}
        onSelect={setGender}
        onClose={() => setGenderModal(false)}
      />
      <SelectModal
        visible={orientationModal}
        title="Sexuelle Orientierung"
        options={ORIENTATION_OPTIONS}
        selected={orientation}
        onSelect={setOrientation}
        onClose={() => setOrientationModal(false)}
      />
      <SelectModal
        visible={lookingForModal}
        title="Ich suche"
        options={LOOKING_FOR_OPTIONS}
        selected={lookingFor}
        onSelect={setLookingFor}
        onClose={() => setLookingForModal(false)}
      />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  content: { padding: 20, paddingTop: 60 },
  loadingContainer: { flex: 1, backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center' },
  title: { color: '#fff', fontSize: 28, fontWeight: 'bold', marginBottom: 24 },
  avatarSection: { alignItems: 'center', marginBottom: 24 },
  avatarWrapper: {
    width: 110, height: 110, borderRadius: 55,
    overflow: 'hidden', borderWidth: 3, borderColor: '#4CAF50',
  },
  avatar: { width: '100%', height: '100%' },
  avatarPlaceholder: {
    width: '100%', height: '100%',
    backgroundColor: '#1e1e1e',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarEmoji: { fontSize: 28, marginBottom: 4 },
  avatarHint: { color: '#666', fontSize: 11 },
  avatarSub: { color: '#555', fontSize: 12, marginTop: 8 },
  card: {
    backgroundColor: '#161616', borderRadius: 16, padding: 20,
    marginBottom: 12, borderWidth: 1, borderColor: '#222',
  },
  sectionTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 16 },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  toggleLabel: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 3 },
  toggleSub: { color: '#666', fontSize: 13 },
  qrRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  qrLabel: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 3 },
  qrSub: { color: '#666', fontSize: 13 },
  qrArrow: { color: '#555', fontSize: 22 },
  qrContainer: {
    padding: 20, backgroundColor: '#1e1e1e',
    borderRadius: 16, borderWidth: 1, borderColor: '#333',
  },
  label: { color: '#666', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, marginTop: 4 },
  input: {
    backgroundColor: '#1e1e1e', color: '#fff', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 13, fontSize: 16,
    marginBottom: 16, borderWidth: 1, borderColor: '#2a2a2a',
  },
  bioInput: { height: 90, textAlignVertical: 'top' },
  selector: {
    backgroundColor: '#1e1e1e', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 13,
    marginBottom: 16, borderWidth: 1, borderColor: '#2a2a2a',
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  selectorValue: { color: '#fff', fontSize: 16 },
  selectorPlaceholder: { color: '#555', fontSize: 16 },
  selectorArrow: { color: '#555', fontSize: 20 },
  saveBtn: {
    backgroundColor: '#4CAF50', borderRadius: 12,
    paddingVertical: 16, alignItems: 'center', marginTop: 4, marginBottom: 12,
  },
  saveBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  logoutBtn: {
    borderRadius: 12, paddingVertical: 14, alignItems: 'center',
    borderWidth: 1, borderColor: '#c0392b',
  },
  logoutText: { color: '#c0392b', fontSize: 16, fontWeight: '600' },
})

const modal = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#161616', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
  },
  title: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 20 },
  option: {
    paddingVertical: 16, paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: '#222',
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  optionSelected: { borderBottomColor: '#2a2a2a' },
  optionText: { color: '#ccc', fontSize: 17 },
  optionTextSelected: { color: '#4CAF50', fontWeight: '600' },
  check: { color: '#4CAF50', fontSize: 18 },
  cancelBtn: {
    marginTop: 16, paddingVertical: 14, alignItems: 'center',
    backgroundColor: '#1e1e1e', borderRadius: 12,
  },
  cancelText: { color: '#fff', fontSize: 16, fontWeight: '600' },
})
