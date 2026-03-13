import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from 'react-native'
import { supabase } from '../lib/supabase'

export default function AuthScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [isLogin, setIsLogin] = useState(true)
  const [loading, setLoading] = useState(false)

  async function handleAuth() {
    if (!email || !password) {
      Alert.alert('Fehler', 'Bitte E-Mail und Passwort eingeben.')
      return
    }
    setLoading(true)

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) Alert.alert('Login fehlgeschlagen', error.message)
    } else {
      if (!username) {
        Alert.alert('Fehler', 'Bitte einen Benutzernamen eingeben.')
        setLoading(false)
        return
      }
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) {
        Alert.alert('Registrierung fehlgeschlagen', error.message)
      } else if (data.user) {
        const { error: profileError } = await supabase.from('profiles').insert({
          id: data.user.id,
          username,
          is_open: false,
        })
        if (profileError) Alert.alert('Profil-Fehler', profileError.message)
      }
    }
    setLoading(false)
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.inner}>

        <View style={styles.logoSection}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoEmoji}>💚</Text>
          </View>
          <Text style={styles.logoText}>lovemap</Text>
          <Text style={styles.tagline}>Menschen in der echten Welt verbinden</Text>
        </View>

        <View style={styles.form}>
          {!isLogin && (
            <View style={styles.inputWrapper}>
              <Text style={styles.inputIcon}>👤</Text>
              <TextInput
                style={styles.input}
                placeholder="Benutzername"
                placeholderTextColor="#555"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
              />
            </View>
          )}

          <View style={styles.inputWrapper}>
            <Text style={styles.inputIcon}>✉️</Text>
            <TextInput
              style={styles.input}
              placeholder="E-Mail"
              placeholderTextColor="#555"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputWrapper}>
            <Text style={styles.inputIcon}>🔒</Text>
            <TextInput
              style={styles.input}
              placeholder="Passwort"
              placeholderTextColor="#555"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          <TouchableOpacity style={styles.button} onPress={handleAuth} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>
                {isLogin ? 'Einloggen' : 'Konto erstellen'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => setIsLogin(!isLogin)} style={styles.switchBtn}>
          <Text style={styles.switchText}>
            {isLogin ? 'Noch kein Konto? ' : 'Schon registriert? '}
            <Text style={styles.switchTextBold}>
              {isLogin ? 'Jetzt registrieren' : 'Einloggen'}
            </Text>
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 28 },
  logoSection: { alignItems: 'center', marginBottom: 48 },
  logoCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#0d2b0d', borderWidth: 2, borderColor: '#4CAF50',
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  logoEmoji: { fontSize: 36 },
  logoText: { color: '#fff', fontSize: 32, fontWeight: '800', letterSpacing: 1 },
  tagline: { color: '#555', fontSize: 14, marginTop: 6, textAlign: 'center' },
  form: { gap: 12 },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#161616', borderRadius: 14,
    borderWidth: 1, borderColor: '#222', paddingHorizontal: 16,
  },
  inputIcon: { fontSize: 18, marginRight: 10 },
  input: { flex: 1, color: '#fff', fontSize: 16, paddingVertical: 16 },
  button: {
    backgroundColor: '#4CAF50', borderRadius: 14,
    paddingVertical: 18, alignItems: 'center', marginTop: 8,
    shadowColor: '#4CAF50', shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  switchBtn: { marginTop: 32, alignItems: 'center' },
  switchText: { color: '#555', fontSize: 15 },
  switchTextBold: { color: '#4CAF50', fontWeight: '600' },
})
