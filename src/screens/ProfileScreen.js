import React, { useState, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Switch, Alert, ActivityIndicator, ScrollView, Image, Modal,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import * as Haptics from 'expo-haptics'
import { supabase } from '../lib/supabase'
import { colors } from '../theme'
import QRCode from 'react-native-qrcode-svg'

const GENDER_OPTIONS = ['Mann', 'Frau', 'Nicht-binär', 'Andere']
const ORIENTATION_OPTIONS = ['Heterosexuell', 'Homosexuell', 'Bisexuell', 'Pansexuell', 'Andere']
const LOOKING_FOR_OPTIONS = ['Date', 'Freundschaft', 'Gespräch', 'Beziehung']
const RELATIONSHIP_OPTIONS = ['Single', 'Vergeben', 'Kompliziert', 'Keine Angabe']

function SelectModal({ visible, title, options, selected, onSelect, onClose }) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={modal.overlay}>
        <View style={modal.container}>
          <Text style={modal.title}>{title}</Text>
          {options.map((opt) => (
            <TouchableOpacity key={opt} style={modal.option} onPress={() => { onSelect(opt); onClose() }}>
              <Text style={[modal.optionText, selected === opt && modal.optionActive]}>{opt}</Text>
              {selected === opt && <Text style={{ color: colors.primary, fontSize: 18 }}>✓</Text>}
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
  const [username, setUsername] = useState('')
  const [bio, setBio] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [gender, setGender] = useState('')
  const [height, setHeight] = useState('')
  const [birthdate, setBirthdate] = useState('')
  const [orientation, setOrientation] = useState('')
  const [lookingFor, setLookingFor] = useState('')
  const [relationshipStatus, setRelationshipStatus] = useState('')
  const [showRelationshipStatus, setShowRelationshipStatus] = useState(true)
  const [avatarUrl, setAvatarUrl] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [userId, setUserId] = useState(null)
  const [showQR, setShowQR] = useState(false)
  const [genderModal, setGenderModal] = useState(false)
  const [orientationModal, setOrientationModal] = useState(false)
  const [lookingForModal, setLookingForModal] = useState(false)
  const [relationshipModal, setRelationshipModal] = useState(false)

  useEffect(() => { loadProfile() }, [])

  async function loadProfile() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserId(user.id)
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (data) {
      setUsername(data.username || '')
      setBio(data.bio || '')
      setIsOpen(data.is_open || false)
      setGender(data.gender || '')
      setHeight(data.height ? String(data.height) : '')
      setBirthdate(data.birthdate || '')
      setOrientation(data.orientation || '')
      setLookingFor(data.looking_for || '')
      setRelationshipStatus(data.relationship_status || '')
      setShowRelationshipStatus(data.show_relationship_status ?? true)
      setAvatarUrl(data.avatar_url || null)
    }
    setLoading(false)
  }

  async function pickImage() {
    Alert.alert('Profilfoto', 'Woher möchtest du das Foto nehmen?', [
      {
        text: '📷 Kamera', onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync()
          if (status !== 'granted') { Alert.alert('Berechtigung benötigt', 'Bitte erlaube den Kamerazugriff.'); return }
          const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.7 })
          if (!result.canceled && result.assets[0]) await uploadAvatar(result.assets[0].uri)
        }
      },
      {
        text: '🖼️ Galerie', onPress: async () => {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
          if (status !== 'granted') { Alert.alert('Berechtigung benötigt', 'Bitte erlaube den Zugriff auf deine Fotos.'); return }
          const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.7 })
          if (!result.canceled && result.assets[0]) await uploadAvatar(result.assets[0].uri)
        }
      },
      { text: 'Abbrechen', style: 'cancel' }
    ])
  }

  async function uploadAvatar(uri) {
    setUploading(true)
    try {
      const fileExt = uri.split('.').pop().toLowerCase().replace('jpg', 'jpeg')
      const fileName = `${userId}.${fileExt}`
      const response = await fetch(uri)
      const blob = await response.blob()

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, blob, { contentType: `image/${fileExt}`, upsert: true })

      if (uploadError) throw uploadError

      const { data } = supabase.storage.from('avatars').getPublicUrl(fileName)
      const url = `${data.publicUrl}?v=${Date.now()}`
      await supabase.from('profiles').update({ avatar_url: url }).eq('id', userId)
      setAvatarUrl(url)
      Alert.alert('✅ Foto gespeichert!')
    } catch (e) {
      Alert.alert('Upload-Fehler', e.message)
    }
    setUploading(false)
  }

  async function toggleOpen(value) {
    Haptics.impactAsync(value ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light)
    setIsOpen(value)
    await supabase.from('profiles').update({ is_open: value }).eq('id', userId)
  }

  async function saveProfile() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    if (!username.trim()) { Alert.alert('Fehler', 'Benutzername darf nicht leer sein.'); return }
    setSaving(true)
    const { error } = await supabase.from('profiles').update({
      username: username.trim(), bio: bio.trim(),
      gender, height: height ? parseInt(height) : null,
      birthdate: birthdate || null,
      orientation, looking_for: lookingFor,
      relationship_status: relationshipStatus,
      show_relationship_status: showRelationshipStatus,
      updated_at: new Date().toISOString(),
    }).eq('id', userId)
    if (error) Alert.alert('Fehler', 'Profil konnte nicht gespeichert werden.')
    else Alert.alert('Gespeichert ✅', 'Dein Profil wurde aktualisiert.')
    setSaving(false)
  }

  if (loading) return (
    <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
  )

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Mein Profil</Text>

      {/* Avatar */}
      <View style={styles.avatarSection}>
        <TouchableOpacity onPress={pickImage} style={styles.avatarWrapper}>
          {uploading ? (
            <View style={styles.avatarBg}><ActivityIndicator color={colors.primary} /></View>
          ) : avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
          ) : (
            <View style={styles.avatarBg}>
              <Text style={{ fontSize: 32 }}>📷</Text>
              <Text style={styles.avatarHint}>Foto hinzufügen</Text>
            </View>
          )}
        </TouchableOpacity>
        <Text style={styles.avatarSub}>Tippen zum Ändern</Text>
      </View>

      {/* Status */}
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{isOpen ? '🟢 Offen für Gespräch' : '⚫ Nicht verfügbar'}</Text>
            <Text style={styles.cardSub}>{isOpen ? 'Du bist auf der Karte sichtbar' : 'Du bist unsichtbar'}</Text>
          </View>
          <Switch value={isOpen} onValueChange={toggleOpen}
            trackColor={{ false: colors.border, true: colors.primaryLight }}
            thumbColor={isOpen ? colors.primary : '#ccc'} />
        </View>
      </View>

      {/* QR Code */}
      <TouchableOpacity style={[styles.card, styles.row]} onPress={() => setShowQR(true)}>
        <View>
          <Text style={styles.cardTitle}>📱 Mein QR-Code</Text>
          <Text style={styles.cardSub}>Zeigen zum Verbinden</Text>
        </View>
        <Text style={{ color: colors.textMuted, fontSize: 22 }}>›</Text>
      </TouchableOpacity>

      {/* Über mich */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Über mich</Text>
        <Text style={styles.label}>Benutzername</Text>
        <TextInput style={styles.input} value={username} onChangeText={setUsername}
          placeholder="Dein Name" placeholderTextColor={colors.textMuted} />
        <Text style={styles.label}>Bio</Text>
        <TextInput style={[styles.input, { height: 90, textAlignVertical: 'top' }]}
          value={bio} onChangeText={setBio} placeholder="Kurz über dich..."
          placeholderTextColor={colors.textMuted} multiline />
        <Text style={styles.label}>Geburtsdatum</Text>
        <TextInput style={styles.input} value={birthdate} onChangeText={setBirthdate}
          placeholder="TT.MM.JJJJ" placeholderTextColor={colors.textMuted}
          keyboardType="numeric" maxLength={10} />

        <Text style={styles.label}>Größe (cm)</Text>
        <TextInput style={styles.input} value={height} onChangeText={setHeight}
          placeholder="z.B. 178" placeholderTextColor={colors.textMuted} keyboardType="numeric" maxLength={3} />
      </View>

      {/* Angaben */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Angaben</Text>
        {[
          { label: 'Geschlecht', value: gender, onPress: () => setGenderModal(true) },
          { label: 'Sexuelle Orientierung', value: orientation, onPress: () => setOrientationModal(true) },
          { label: 'Ich suche', value: lookingFor, onPress: () => setLookingForModal(true) },
          { label: 'Beziehungsstatus', value: relationshipStatus, onPress: () => setRelationshipModal(true) },
        ].map(({ label, value, onPress }) => (
          <View key={label}>
            <Text style={styles.label}>{label}</Text>
            <TouchableOpacity style={styles.selector} onPress={onPress}>
              <Text style={value ? styles.selectorVal : styles.selectorPlaceholder}>
                {value || 'Auswählen...'}
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 20 }}>›</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>

      {/* Beziehungsstatus anzeigen */}
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Beziehungsstatus anzeigen</Text>
            <Text style={styles.cardSub}>
              {showRelationshipStatus ? 'Wird auf deinem Profil angezeigt' : 'Wird verborgen'}
            </Text>
          </View>
          <Switch value={showRelationshipStatus} onValueChange={setShowRelationshipStatus}
            trackColor={{ false: colors.border, true: colors.primaryLight }}
            thumbColor={showRelationshipStatus ? colors.primary : '#ccc'} />
        </View>
      </View>

      <TouchableOpacity style={styles.saveBtn} onPress={saveProfile} disabled={saving}>
        {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveBtnText}>Speichern</Text>}
      </TouchableOpacity>

      <TouchableOpacity style={styles.logoutBtn} onPress={() =>
        Alert.alert('Ausloggen', 'Wirklich ausloggen?', [
          { text: 'Abbrechen', style: 'cancel' },
          { text: 'Ausloggen', style: 'destructive', onPress: () => supabase.auth.signOut() },
        ])
      }>
        <Text style={styles.logoutText}>Ausloggen</Text>
      </TouchableOpacity>

      <View style={{ height: 48 }} />

      {/* QR Modal */}
      <Modal visible={showQR} transparent animationType="fade">
        <View style={modal.overlay}>
          <View style={[modal.container, { alignItems: 'center', borderTopLeftRadius: 28, borderTopRightRadius: 28 }]}>
            <Text style={modal.title}>Dein QR-Code</Text>
            <Text style={{ color: colors.textMuted, marginBottom: 24, fontSize: 13 }}>
              Lass andere diesen Code scannen
            </Text>
            {userId && (
              <View style={styles.qrBox}>
                <QRCode value={`nearbyme://user/${userId}`} size={200}
                  backgroundColor={colors.white} color={colors.text} />
              </View>
            )}
            <TouchableOpacity style={[modal.cancelBtn, { marginTop: 24, width: '100%' }]} onPress={() => setShowQR(false)}>
              <Text style={modal.cancelText}>Schließen</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <SelectModal visible={genderModal} title="Geschlecht" options={GENDER_OPTIONS}
        selected={gender} onSelect={setGender} onClose={() => setGenderModal(false)} />
      <SelectModal visible={orientationModal} title="Sexuelle Orientierung" options={ORIENTATION_OPTIONS}
        selected={orientation} onSelect={setOrientation} onClose={() => setOrientationModal(false)} />
      <SelectModal visible={lookingForModal} title="Ich suche" options={LOOKING_FOR_OPTIONS}
        selected={lookingFor} onSelect={setLookingFor} onClose={() => setLookingForModal(false)} />
      <SelectModal visible={relationshipModal} title="Beziehungsstatus" options={RELATIONSHIP_OPTIONS}
        selected={relationshipStatus} onSelect={setRelationshipStatus} onClose={() => setRelationshipModal(false)} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, paddingTop: 60 },
  center: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' },
  title: { color: colors.text, fontSize: 28, fontWeight: '800', marginBottom: 24 },
  avatarSection: { alignItems: 'center', marginBottom: 24 },
  avatarWrapper: {
    width: 110, height: 110, borderRadius: 55,
    overflow: 'hidden', borderWidth: 3, borderColor: colors.primary,
    shadowColor: colors.primary, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarBg: { width: '100%', height: '100%', backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center' },
  avatarHint: { color: colors.primaryDark, fontSize: 11, marginTop: 4 },
  avatarSub: { color: colors.textMuted, fontSize: 12, marginTop: 8 },
  card: {
    backgroundColor: colors.bgCard, borderRadius: 18, padding: 20,
    marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '600', marginBottom: 3 },
  cardSub: { color: colors.textMuted, fontSize: 13 },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: 16 },
  label: { color: colors.textMuted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, marginTop: 4 },
  input: {
    backgroundColor: colors.bg, color: colors.text, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 13, fontSize: 16, marginBottom: 14,
    borderWidth: 1.5, borderColor: colors.border,
  },
  selector: {
    backgroundColor: colors.bg, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13,
    marginBottom: 14, borderWidth: 1.5, borderColor: colors.border,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  selectorVal: { color: colors.text, fontSize: 16 },
  selectorPlaceholder: { color: colors.textMuted, fontSize: 16 },
  saveBtn: {
    backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 17,
    alignItems: 'center', marginBottom: 12,
    shadowColor: colors.primary, shadowOpacity: 0.25, shadowRadius: 8, elevation: 5,
  },
  saveBtnText: { color: colors.white, fontSize: 17, fontWeight: '700' },
  logoutBtn: {
    borderRadius: 14, paddingVertical: 15, alignItems: 'center',
    borderWidth: 1.5, borderColor: colors.danger,
  },
  logoutText: { color: colors.danger, fontSize: 16, fontWeight: '600' },
  qrBox: {
    padding: 20, backgroundColor: colors.white, borderRadius: 18,
    borderWidth: 1, borderColor: colors.border,
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 10, elevation: 3,
  },
})

const modal = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  container: { backgroundColor: colors.bgCard, padding: 24, paddingBottom: 40 },
  title: { color: colors.text, fontSize: 20, fontWeight: '700', marginBottom: 20 },
  option: {
    paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  optionText: { color: colors.textSecondary, fontSize: 17 },
  optionActive: { color: colors.primary, fontWeight: '700' },
  cancelBtn: { marginTop: 12, paddingVertical: 14, alignItems: 'center', backgroundColor: colors.bg, borderRadius: 12 },
  cancelText: { color: colors.text, fontSize: 16, fontWeight: '600' },
})
