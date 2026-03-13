import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

export function useUnreadCount() {
  const [unreadCount, setUnreadCount] = useState(0)
  const myIdRef = useRef(null)
  const lastSeenRef = useRef({}) // connectionId → last seen timestamp

  useEffect(() => {
    init()
  }, [])

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    myIdRef.current = user.id
    await checkUnread(user.id)
    subscribeToMessages(user.id)
  }

  async function checkUnread(userId) {
    // Get all connections
    const { data: conns } = await supabase
      .from('connections')
      .select('id')
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)

    if (!conns) return

    let total = 0
    for (const conn of conns) {
      const lastSeen = lastSeenRef.current[conn.id] || new Date(0).toISOString()
      const { count } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('connection_id', conn.id)
        .neq('sender_id', userId)
        .gt('created_at', lastSeen)
      total += count || 0
    }
    setUnreadCount(total)
  }

  function subscribeToMessages(userId) {
    supabase
      .channel('unread_messages')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
      }, (payload) => {
        if (payload.new.sender_id !== userId) {
          setUnreadCount(prev => prev + 1)
        }
      })
      .subscribe()
  }

  function markAllRead() {
    setUnreadCount(0)
  }

  return { unreadCount, markAllRead }
}
