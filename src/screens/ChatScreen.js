import React, { useState, useEffect, useRef } from 'react'
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, KeyboardAvoidingView, Platform,
  Image, ActivityIndicator,
} from 'react-native'
import { supabase } from '../lib/supabase'
import { colors } from '../theme'

function formatTime(ts) {
  const d = new Date(ts)
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
}

function formatDate(ts) {
  const d = new Date(ts)
  const today = new Date()
  if (d.toDateString() === today.toDateString()) return 'Heute'
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return 'Gestern'
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })
}

export default function ChatScreen({ route, navigation }) {
  const { connectionId, otherUserId } = route.params
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [myId, setMyId] = useState(null)
  const [otherProfile, setOtherProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const flatListRef = useRef(null)

  useEffect(() => {
    init()
  }, [])

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setMyId(user.id)

    const { data: profile } = await supabase
      .from('profiles')
      .select('username, avatar_url')
      .eq('id', otherUserId)
      .single()
    setOtherProfile(profile)

    navigation.setOptions({ title: profile?.username || 'Chat' })

    await loadMessages()
    setLoading(false)
    subscribeToMessages()
  }

  async function loadMessages() {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('connection_id', connectionId)
      .order('created_at', { ascending: true })
    if (data) setMessages(data)
  }

  function subscribeToMessages() {
    supabase
      .channel(`messages:${connectionId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `connection_id=eq.${connectionId}`,
      }, (payload) => {
        setMessages(prev => {
          // Keine Duplikate
          if (prev.find(m => m.id === payload.new.id)) return prev
          return [...prev, payload.new]
        })
      })
      .subscribe()
  }

  async function sendMessage() {
    const content = text.trim()
    if (!content || !myId) return
    setText('')
    await supabase.from('messages').insert({
      connection_id: connectionId,
      sender_id: myId,
      content,
    })
  }

  if (loading) return (
    <View style={styles.loading}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  )

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        {otherProfile?.avatar_url ? (
          <Image source={{ uri: otherProfile.avatar_url }} style={styles.headerAvatar} />
        ) : (
          <View style={styles.headerAvatarPlaceholder}><Text style={{ fontSize: 18 }}>👤</Text></View>
        )}
        <Text style={styles.headerName}>{otherProfile?.username || 'Chat'}</Text>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        renderItem={({ item, index }) => {
          const isMe = item.sender_id === myId
          const prevItem = messages[index - 1]
          const showDate = !prevItem || formatDate(item.created_at) !== formatDate(prevItem.created_at)

          return (
            <>
              {showDate && (
                <View style={styles.dateRow}>
                  <Text style={styles.dateText}>{formatDate(item.created_at)}</Text>
                </View>
              )}
              <View style={[styles.bubbleRow, isMe ? styles.bubbleRowMe : styles.bubbleRowThem]}>
                <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
                  <Text style={[styles.bubbleText, isMe ? styles.bubbleTextMe : styles.bubbleTextThem]}>
                    {item.content}
                  </Text>
                  <Text style={[styles.bubbleTime, isMe ? styles.bubbleTimeMe : styles.bubbleTimeThem]}>
                    {formatTime(item.created_at)}
                  </Text>
                </View>
              </View>
            </>
          )
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>💬</Text>
            <Text style={styles.emptyText}>Schreib die erste Nachricht!</Text>
            <Text style={styles.emptySubText}>Ihr habt euch im echten Leben getroffen — jetzt geht es digital weiter.</Text>
          </View>
        }
      />

      {/* Input */}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Nachricht..."
          placeholderTextColor={colors.textMuted}
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[styles.sendBtn, !text.trim() && styles.sendBtnDisabled]}
          onPress={sendMessage}
          disabled={!text.trim()}
        >
          <Text style={styles.sendIcon}>↑</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  loading: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
    paddingTop: 52, paddingBottom: 14,
    backgroundColor: colors.bgCard, borderBottomWidth: 1, borderBottomColor: colors.border,
    gap: 12,
  },
  backBtn: { padding: 4 },
  backText: { color: colors.primary, fontSize: 32, lineHeight: 36 },
  headerAvatar: { width: 40, height: 40, borderRadius: 20 },
  headerAvatarPlaceholder: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center',
  },
  headerName: { color: colors.text, fontSize: 18, fontWeight: '700', flex: 1 },
  messagesList: { padding: 16, paddingBottom: 8 },
  dateRow: { alignItems: 'center', marginVertical: 12 },
  dateText: {
    color: colors.textMuted, fontSize: 12, fontWeight: '600',
    backgroundColor: colors.border, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10,
  },
  bubbleRow: { flexDirection: 'row', marginBottom: 6 },
  bubbleRowMe: { justifyContent: 'flex-end' },
  bubbleRowThem: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '78%', paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 20, gap: 4,
  },
  bubbleMe: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 6,
  },
  bubbleThem: {
    backgroundColor: colors.bgCard,
    borderBottomLeftRadius: 6,
    borderWidth: 1, borderColor: colors.border,
  },
  bubbleText: { fontSize: 16, lineHeight: 22 },
  bubbleTextMe: { color: '#fff' },
  bubbleTextThem: { color: colors.text },
  bubbleTime: { fontSize: 11, alignSelf: 'flex-end' },
  bubbleTimeMe: { color: 'rgba(255,255,255,0.7)' },
  bubbleTimeThem: { color: colors.textMuted },
  emptyContainer: { flex: 1, alignItems: 'center', paddingTop: 80, paddingHorizontal: 40 },
  emptyEmoji: { fontSize: 48, marginBottom: 16 },
  emptyText: { color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptySubText: { color: colors.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: colors.bgCard, borderTopWidth: 1, borderTopColor: colors.border,
  },
  input: {
    flex: 1, backgroundColor: colors.bg, color: colors.text,
    borderRadius: 22, paddingHorizontal: 16, paddingVertical: 12,
    fontSize: 16, borderWidth: 1.5, borderColor: colors.border,
    maxHeight: 120,
  },
  sendBtn: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center',
  },
  sendBtnDisabled: { backgroundColor: colors.border },
  sendIcon: { color: '#fff', fontSize: 22, fontWeight: '700' },
})
