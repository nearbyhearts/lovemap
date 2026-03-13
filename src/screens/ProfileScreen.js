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
} from 'react-native'
import { supabase } from '../lib/supabase'

export default function ProfileScreen() {
  const [profile, setProfile] = useState(null)
  const [username, setUsername] = useState('')
  const [bio, setBio] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [userId, setUserId] = useState(null)

  useEffect(() => {
    loadProfile()
  }, [])

  async function loadProfile() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserId(user.id)

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (data) {
      setProfile(data)
      setUsername(data.username || '')
      setBio(data.bio || '')
      setIsOpen(data.is_open || false)
    }
    setLoading(false)
  }

  async function toggleOpen(value) {
    setIsOpen(value)
    if (!userId) return

    const { error } = await supabase
      .from('profiles')
      .update({ is_open: value, updated_at: new Date().toISOString() })
      .eq('id', userId)

    if (error) {
      Alert.alert('Fehler', 'Status konnte nicht geändert werden.')
      setIsOpen(!value) // revert
    }
  }

  async function saveProfile() {
    if (!username.trim()) {
      Alert.alert('Fehler', 'Benutzername darf nicht leer sein.')
      return
    }
    setSaving(true)
    const { error } = await supabase
      .from('profiles')
      .update({
        username: username.trim(),
        bio: bio.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)

    if (error) {
      Alert.alert('Fehler', 'Profil konnte nicht gespeichert werden.')
    } else {
      Alert.alert('Gespeichert ✅', 'Dein Profil wurde aktualisiert.')
    }
    setSaving(false)
  }

  async function handleLogout() {
    Alert.alert('Ausloggen', 'Wirklich ausloggen?', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Ausloggen',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut()
        },
      },
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
      <Text style={styles.title}>Mein Profil</Text>

      {/* Status Toggle */}
      <View style={styles.card}>
        <View style={styles.toggleRow}>
          <View>
            <Text style={styles.toggleLabel}>
              {isOpen ? '🟢 Offen für Gespräch' : '⚫ Nicht verfügbar'}
            </Text>
            <Text style={styles.toggleSub}>
              {isOpen
                ? 'Andere sehen dich auf der Karte'
                : 'Du bist für andere unsichtbar'}
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

      {/* Profile Fields */}
      <View style={styles.card}>
        <Text style={styles.label}>Benutzername</Text>
        <TextInput
          style={styles.input}
          value={username}
          onChangeText={setUsername}
          placeholder="Dein Name"
          placeholderTextColor="#666"
          autoCapitalize="none"
        />

        <Text style={styles.label}>Bio</Text>
        <TextInput
          style={[styles.input, styles.bioInput]}
          value={bio}
          onChangeText={setBio}
          placeholder="Kurz über dich..."
          placeholderTextColor="#666"
          multiline
          numberOfLines={3}
        />

        <TouchableOpacity style={styles.saveBtn} onPress={saveProfile} disabled={saving}>
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveBtnText}>Speichern</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>Ausloggen</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f0f',
  },
  content: {
    padding: 20,
    paddingTop: 60,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0f0f0f',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 24,
  },
  card: {
    backgroundColor: '#1e1e1e',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toggleLabel: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 4,
  },
  toggleSub: {
    color: '#888',
    fontSize: 13,
  },
  label: {
    color: '#aaa',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 4,
  },
  input: {
    backgroundColor: '#2a2a2a',
    color: '#fff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  bioInput: {
    height: 90,
    textAlignVertical: 'top',
  },
  saveBtn: {
    backgroundColor: '#4CAF50',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  logoutBtn: {
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#c0392b',
    marginTop: 8,
  },
  logoutText: {
    color: '#c0392b',
    fontSize: 16,
    fontWeight: '600',
  },
})
