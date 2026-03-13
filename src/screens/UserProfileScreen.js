import React, { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, ScrollView, Image,
  TouchableOpacity, ActivityIndicator,
} from 'react-native'
import { supabase } from '../lib/supabase'
import { colors } from '../theme'

function Tag({ label, green }) {
  return (
    <View style={[styles.tag, green && styles.tagGreen]}>
      <Text style={[styles.tagText, green && styles.tagTextGreen]}>{label}</Text>
    </View>
  )
}

export default function UserProfileScreen({ route, navigation }) {
  const { userId } = route.params
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadProfile() }, [])

  async function loadProfile() {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    setProfile(data)
    setLoading(false)
  }

  if (loading) return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  )

  if (!profile) return (
    <View style={styles.center}>
      <Text style={styles.errorText}>Profil nicht gefunden</Text>
    </View>
  )

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Back button */}
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>‹</Text>
      </TouchableOpacity>

      {/* Avatar */}
      <View style={styles.avatarSection}>
        {profile.avatar_url ? (
          <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={{ fontSize: 56 }}>👤</Text>
          </View>
        )}
        <View style={[styles.statusBadge, profile.is_open ? styles.statusOpen : styles.statusClosed]}>
          <Text style={[styles.statusText, { color: profile.is_open ? colors.primaryDark : colors.textMuted }]}>
            {profile.is_open ? '🟢 Offen für Gespräch' : '⚫ Nicht verfügbar'}
          </Text>
        </View>
      </View>

      {/* Name */}
      <Text style={styles.name}>{profile.username || 'Unbekannt'}</Text>

      {/* Bio */}
      {profile.bio ? (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Über mich</Text>
          <Text style={styles.bio}>{profile.bio}</Text>
        </View>
      ) : null}

      {/* Tags */}
      <View style={styles.card}>
        <Text style={styles.cardLabel}>Angaben</Text>
        <View style={styles.tags}>
          {profile.gender ? <Tag label={profile.gender} /> : null}
          {profile.height ? <Tag label={`${profile.height} cm`} /> : null}
          {profile.orientation ? <Tag label={profile.orientation} /> : null}
          {profile.looking_for ? <Tag label={`Sucht: ${profile.looking_for}`} green /> : null}
          {profile.relationship_status && profile.show_relationship_status ? (
            <Tag label={`💑 ${profile.relationship_status}`} />
          ) : null}
        </View>
        {!profile.gender && !profile.height && !profile.orientation && !profile.looking_for && (
          <Text style={styles.emptyTags}>Keine Angaben gemacht</Text>
        )}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: 48 },
  center: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: colors.textMuted, fontSize: 16 },
  backBtn: {
    position: 'absolute', top: 52, left: 16, zIndex: 10,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 3,
  },
  backText: { color: colors.primary, fontSize: 32, lineHeight: 36 },
  avatarSection: { alignItems: 'center', paddingTop: 80, paddingBottom: 16 },
  avatar: {
    width: 140, height: 140, borderRadius: 70,
    borderWidth: 4, borderColor: colors.primary,
    shadowColor: colors.primary, shadowOpacity: 0.2, shadowRadius: 12, elevation: 6,
  },
  avatarPlaceholder: {
    width: 140, height: 140, borderRadius: 70,
    backgroundColor: colors.primaryLight, borderWidth: 4, borderColor: colors.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  statusBadge: {
    marginTop: 14, paddingHorizontal: 16, paddingVertical: 6,
    borderRadius: 20,
  },
  statusOpen: { backgroundColor: colors.primaryLight },
  statusClosed: { backgroundColor: colors.bg },
  statusText: { fontSize: 14, fontWeight: '600' },
  name: {
    color: colors.text, fontSize: 28, fontWeight: '800',
    textAlign: 'center', marginBottom: 24, paddingHorizontal: 20,
  },
  card: {
    backgroundColor: colors.bgCard, borderRadius: 18, padding: 20,
    marginHorizontal: 20, marginBottom: 12,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  cardLabel: {
    color: colors.textMuted, fontSize: 12, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10,
  },
  bio: { color: colors.text, fontSize: 16, lineHeight: 24 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: {
    backgroundColor: colors.bg, paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1.5, borderColor: colors.border,
  },
  tagGreen: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  tagText: { color: colors.textSecondary, fontSize: 14, fontWeight: '500' },
  tagTextGreen: { color: colors.primaryDark, fontWeight: '600' },
  emptyTags: { color: colors.textMuted, fontSize: 14 },
})
