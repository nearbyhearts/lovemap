import React, { useState, useEffect, useCallback } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, Alert, ActivityIndicator, RefreshControl,
} from 'react-native'
import { supabase } from '../lib/supabase'
import { colors } from '../theme'
import { useFocusEffect } from '@react-navigation/native'

function formatRelativeTime(ts) {
  const diff = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Gerade eben'
  if (mins < 60) return `vor ${mins} Min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `vor ${hours} Std`
  return new Date(ts).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })
}

export default function ContactsScreen({ navigation }) {
  const [contacts, setContacts] = useState([])
  const [myId, setMyId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useFocusEffect(useCallback(() => { loadContacts() }, [myId]))

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setMyId(user.id)
    await loadContacts(user.id)
  }

  async function loadContacts(uid) {
    const userId = uid || myId
    if (!userId) return

    const { data: conns } = await supabase
      .from('connections')
      .select('id, created_at, user1_id, user2_id')
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
      .order('created_at', { ascending: false })

    if (!conns) { setLoading(false); return }

    const enriched = await Promise.all(conns.map(async (conn) => {
      const otherId = conn.user1_id === userId ? conn.user2_id : conn.user1_id
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, is_open')
        .eq('id', otherId)
        .single()
      const { data: lastMsg } = await supabase
        .from('messages')
        .select('content, created_at')
        .eq('connection_id', conn.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      return { ...conn, profile, lastMessage: lastMsg || null }
    }))

    setContacts(enriched)
    setLoading(false)
    setRefreshing(false)
  }

  async function deleteContact(connId, username) {
    Alert.alert(
      'Kontakt löschen',
      `Möchtest du ${username || 'diesen Kontakt'} wirklich löschen? Der Chat wird ebenfalls gelöscht.`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen', style: 'destructive',
          onPress: async () => {
            await supabase.from('connections').delete().eq('id', connId)
            setContacts(prev => prev.filter(c => c.id !== connId))
          }
        }
      ]
    )
  }

  if (loading) return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  )

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Kontakte</Text>
        <TouchableOpacity style={styles.scanBtn} onPress={() => navigation.navigate('QRScanner')}>
          <Text style={styles.scanBtnText}>📱 Scannen</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={contacts}
        keyExtractor={item => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadContacts() }}
            tintColor={colors.primary} />
        }
        contentContainerStyle={contacts.length === 0 ? styles.emptyContainer : { paddingBottom: 20 }}
        ListEmptyComponent={
          <View style={{ alignItems: 'center' }}>
            <Text style={styles.emptyEmoji}>💬</Text>
            <Text style={styles.emptyTitle}>Noch keine Kontakte</Text>
            <Text style={styles.emptySub}>
              Scanne den QR-Code einer Person in deiner Nähe um einen Chat zu starten.
            </Text>
            <TouchableOpacity style={styles.emptyScanBtn} onPress={() => navigation.navigate('QRScanner')}>
              <Text style={styles.emptyScanBtnText}>📱 QR-Code scannen</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.contactItem}
            onPress={() => navigation.navigate('Chat', { connectionId: item.id, otherUserId: item.profile?.id })}
            onLongPress={() => deleteContact(item.id, item.profile?.username)}
            activeOpacity={0.7}
          >
            <View style={styles.avatarWrapper}>
              {item.profile?.avatar_url ? (
                <Image source={{ uri: item.profile.avatar_url }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}><Text style={{ fontSize: 22 }}>👤</Text></View>
              )}
              <View style={[styles.onlineDot, item.profile?.is_open ? styles.dotOpen : styles.dotClosed]} />
            </View>

            <View style={styles.contactInfo}>
              <View style={styles.contactTop}>
                <Text style={styles.contactName}>{item.profile?.username || 'Unbekannt'}</Text>
                {item.lastMessage && (
                  <Text style={styles.contactTime}>{formatRelativeTime(item.lastMessage.created_at)}</Text>
                )}
              </View>
              <Text style={styles.lastMessage} numberOfLines={1}>
                {item.lastMessage ? item.lastMessage.content : 'Verbunden • Schreib die erste Nachricht!'}
              </Text>
            </View>
          </TouchableOpacity>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16,
    backgroundColor: colors.bgCard, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  title: { color: colors.text, fontSize: 28, fontWeight: '800' },
  scanBtn: {
    backgroundColor: colors.primaryLight, paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1, borderColor: colors.primary,
  },
  scanBtnText: { color: colors.primaryDark, fontWeight: '700', fontSize: 14 },
  contactItem: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 20, paddingVertical: 14, backgroundColor: colors.bgCard,
  },
  avatarWrapper: { position: 'relative' },
  avatar: { width: 54, height: 54, borderRadius: 27 },
  avatarPlaceholder: {
    width: 54, height: 54, borderRadius: 27,
    backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center',
  },
  onlineDot: {
    position: 'absolute', bottom: 1, right: 1,
    width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: colors.bgCard,
  },
  dotOpen: { backgroundColor: colors.primary },
  dotClosed: { backgroundColor: colors.textMuted },
  contactInfo: { flex: 1 },
  contactTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 },
  contactName: { color: colors.text, fontSize: 16, fontWeight: '700' },
  contactTime: { color: colors.textMuted, fontSize: 12 },
  lastMessage: { color: colors.textSecondary, fontSize: 14 },
  separator: { height: 1, backgroundColor: colors.border, marginLeft: 88 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40, paddingTop: 80 },
  emptyEmoji: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { color: colors.text, fontSize: 20, fontWeight: '700', marginBottom: 10 },
  emptySub: { color: colors.textMuted, fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 28 },
  emptyScanBtn: {
    backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 14,
    borderRadius: 14, shadowColor: colors.primary, shadowOpacity: 0.25, shadowRadius: 8, elevation: 4,
  },
  emptyScanBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
})
