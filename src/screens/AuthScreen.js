import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from 'react-native'
import { supabase } from '../lib/supabase'
import { colors } from '../theme'

export default function AuthScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [isLogin, setIsLogin] = useState(true)
  const [loading, setLoading] = useState(false)

  async function handleAuth() {
    if (!email || !password) { Alert.alert('Fehler', 'Bitte E-Mail und Passwort eingeben.'); return }
    setLoading(true)
    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) Alert.alert('Login fehlgeschlagen', error.message)
    } else {
      if (!username) { Alert.alert('Fehler', 'Bitte einen Benutzernamen eingeben.'); setLoading(false); return }
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) Alert.alert('Registrierung fehlgeschlagen', error.message)
      else if (data.user) {
        await supabase.from('profiles').insert({ id: data.user.id, username, is_open: false })
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
          <Text style={styles.logoText}>nearbyme</Text>
          <Text style={styles.tagline}>Menschen in der echten Welt verbinden</Text>
        </View>

        <View style={styles.form}>
          {!isLogin && (
            <View style={styles.inputWrapper}>
              <Text style={styles.inputIcon}>👤</Text>
              <TextInput style={styles.input} placeholder="Benutzername" placeholderTextColor={colors.textMuted}
                value={username} onChangeText={setUsername} autoCapitalize="none" />
            </View>
          )}
          <View style={styles.inputWrapper}>
            <Text style={styles.inputIcon}>✉️</Text>
            <TextInput style={styles.input} placeholder="E-Mail" placeholderTextColor={colors.textMuted}
              value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
          </View>
          <View style={styles.inputWrapper}>
            <Text style={styles.inputIcon}>🔒</Text>
            <TextInput style={styles.input} placeholder="Passwort" placeholderTextColor={colors.textMuted}
              value={password} onChangeText={setPassword} secureTextEntry />
          </View>
          <TouchableOpacity style={styles.button} onPress={handleAuth} disabled={loading}>
            {loading ? <ActivityIndicator color={colors.white} /> :
              <Text style={styles.buttonText}>{isLogin ? 'Einloggen' : 'Konto erstellen'}</Text>}
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => setIsLogin(!isLogin)} style={styles.switchBtn}>
          <Text style={styles.switchText}>
            {isLogin ? 'Noch kein Konto? ' : 'Schon registriert? '}
            <Text style={styles.switchBold}>{isLogin ? 'Registrieren' : 'Einloggen'}</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 28 },
  logoSection: { alignItems: 'center', marginBottom: 44 },
  logoCircle: {
    width: 84, height: 84, borderRadius: 42,
    backgroundColor: colors.primaryLight, borderWidth: 3, borderColor: colors.primary,
    justifyContent: 'center', alignItems: 'center', marginBottom: 14,
  },
  logoEmoji: { fontSize: 38 },
  logoText: { color: colors.text, fontSize: 32, fontWeight: '800', letterSpacing: 1 },
  tagline: { color: colors.textMuted, fontSize: 14, marginTop: 6, textAlign: 'center' },
  form: { gap: 12 },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.bgCard, borderRadius: 14,
    borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: 16,
  },
  inputIcon: { fontSize: 18, marginRight: 10 },
  input: { flex: 1, color: colors.text, fontSize: 16, paddingVertical: 16 },
  button: {
    backgroundColor: colors.primary, borderRadius: 14,
    paddingVertical: 18, alignItems: 'center', marginTop: 8,
    shadowColor: colors.primary, shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  buttonText: { color: colors.white, fontSize: 17, fontWeight: '700' },
  switchBtn: { marginTop: 28, alignItems: 'center' },
  switchText: { color: colors.textMuted, fontSize: 15 },
  switchBold: { color: colors.primaryDark, fontWeight: '700' },
})
