import React, { useState, useEffect, useRef } from 'react'
import {
  View, Text, StyleSheet, Alert, ActivityIndicator,
  TouchableOpacity, Image, Modal,
} from 'react-native'
import MapView, { Marker, Circle } from 'react-native-maps'
import * as Location from 'expo-location'
import { supabase } from '../lib/supabase'
import { colors } from '../theme'

const UPDATE_INTERVAL_MS = 30000
const NEARBY_RADIUS_M = 1000

function getDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lon2 - lon1) * Math.PI) / 180
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function formatDistance(m) {
  return m < 1000 ? `${Math.round(m)}m` : `${(m / 1000).toFixed(1)}km`
}

function ProfileCard({ user, distance, onClose }) {
  const p = user.profiles
  return (
    <Modal visible transparent animationType="slide">
      <View style={card.overlay}>
        <View style={card.container}>
          <TouchableOpacity style={card.closeBtn} onPress={onClose}>
            <Text style={card.closeText}>✕</Text>
          </TouchableOpacity>
          <View style={card.avatarRow}>
            {p?.avatar_url ? (
              <Image source={{ uri: p.avatar_url }} style={card.avatar} />
            ) : (
              <View style={card.avatarPlaceholder}><Text style={{ fontSize: 30 }}>👤</Text></View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={card.name}>{p?.username || 'Unbekannt'}</Text>
              <View style={[card.badge, p?.is_open ? card.badgeOpen : card.badgeClosed]}>
                <Text style={[card.badgeText, { color: p?.is_open ? colors.primaryDark : colors.textMuted }]}>
                  {p?.is_open ? '🟢 Offen für Gespräch' : '⚫ Nicht verfügbar'}
                </Text>
              </View>
              <Text style={card.distance}>📍 {formatDistance(distance)} entfernt</Text>
            </View>
          </View>
          {p?.bio ? <Text style={card.bio}>{p.bio}</Text> : null}
          <View style={card.tags}>
            {p?.gender ? <View style={card.tag}><Text style={card.tagText}>{p.gender}</Text></View> : null}
            {p?.height ? <View style={card.tag}><Text style={card.tagText}>{p.height} cm</Text></View> : null}
            {p?.looking_for ? (
              <View style={[card.tag, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}>
                <Text style={[card.tagText, { color: colors.primaryDark }]}>Sucht: {p.looking_for}</Text>
              </View>
            ) : null}
          </View>
          {p?.is_open && (
            <View style={card.scanHint}>
              <Text style={card.scanHintText}>📱 Scanne den QR-Code dieser Person um zu chatten</Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  )
}

function MyMarker({ profile }) {
  return (
    <View style={[styles.myMarker, profile?.is_open && styles.myMarkerOpen]}>
      {profile?.avatar_url ? (
        <Image source={{ uri: profile.avatar_url }} style={styles.markerAvatar} />
      ) : (
        <View style={styles.myMarkerInner}>
          <Text style={styles.myMarkerEmoji}>😊</Text>
        </View>
      )}
      <View style={[styles.statusDot, profile?.is_open ? styles.dotOpen : styles.dotClosed]} />
    </View>
  )
}

function UserMarker({ user }) {
  const p = user.profiles
  return (
    <View style={[styles.userMarker, p?.is_open ? styles.userOpen : styles.userClosed]}>
      {p?.avatar_url ? (
        <Image source={{ uri: p.avatar_url }} style={styles.markerAvatar} />
      ) : (
        <Text style={styles.markerEmoji}>👤</Text>
      )}
      <View style={[styles.statusDot, p?.is_open ? styles.dotOpen : styles.dotClosed]} />
    </View>
  )
}

export default function MapScreen() {
  const [myLocation, setMyLocation] = useState(null)
  const [nearbyUsers, setNearbyUsers] = useState([])
  const [myProfile, setMyProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState(null)
  const mapRef = useRef(null)
  const locationInterval = useRef(null)
  const myUserId = useRef(null)

  useEffect(() => {
    init()
    return () => { if (locationInterval.current) clearInterval(locationInterval.current) }
  }, [])

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    myUserId.current = user.id
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    setMyProfile(profile)
    const { status } = await Location.requestForegroundPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Standort benötigt', 'Bitte erlaube den Standortzugriff.')
      setLoading(false)
      return
    }
    await updateLocation(user.id)
    setLoading(false)
    locationInterval.current = setInterval(() => updateLocation(user.id), UPDATE_INTERVAL_MS)
    subscribeToNearbyUsers(user.id)
  }

  async function updateLocation(userId) {
    try {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
      const { latitude, longitude } = loc.coords
      setMyLocation({ latitude, longitude })
      await supabase.from('locations').upsert(
        { user_id: userId, lat: latitude, lng: longitude, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      )
      loadNearbyUsers(userId, latitude, longitude)
    } catch (e) { console.log('Location error:', e) }
  }

  async function loadNearbyUsers(myId, myLat, myLng) {
    const { data } = await supabase
      .from('locations')
      .select('user_id, lat, lng, profiles(id, username, is_open, avatar_url, bio, gender, height, looking_for)')
      .neq('user_id', myId)
    if (!data) return
    setNearbyUsers(
      data.map(loc => ({ ...loc, distance: getDistanceMeters(myLat, myLng, loc.lat, loc.lng) }))
        .filter(loc => loc.distance <= NEARBY_RADIUS_M)
        .sort((a, b) => a.distance - b.distance)
    )
  }

  function subscribeToNearbyUsers(myId) {
    supabase.channel('locations_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'locations' }, () => {
        if (myLocation) loadNearbyUsers(myId, myLocation.latitude, myLocation.longitude)
      }).subscribe()
  }

  function centerOnMe() {
    if (myLocation && mapRef.current)
      mapRef.current.animateToRegion({ ...myLocation, latitudeDelta: 0.01, longitudeDelta: 0.01 })
  }

  if (loading) return (
    <View style={styles.loading}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.loadingText}>Standort wird ermittelt...</Text>
    </View>
  )

  if (!myLocation) return (
    <View style={styles.loading}>
      <Text style={styles.loadingText}>Kein Standortzugriff</Text>
    </View>
  )

  const openCount = nearbyUsers.filter(u => u.profiles?.is_open).length

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={{ ...myLocation, latitudeDelta: 0.01, longitudeDelta: 0.01 }}
        customMapStyle={pastelMapStyle}
      >
        <Marker coordinate={myLocation} anchor={{ x: 0.5, y: 0.5 }}>
          <MyMarker profile={myProfile} />
        </Marker>

        <Circle
          center={myLocation}
          radius={NEARBY_RADIUS_M}
          strokeColor="rgba(107,191,142,0.4)"
          fillColor="rgba(107,191,142,0.07)"
          strokeWidth={1.5}
        />

        {nearbyUsers.map((loc) => (
          <Marker key={loc.user_id} coordinate={{ latitude: loc.lat, longitude: loc.lng }}
            anchor={{ x: 0.5, y: 0.5 }} onPress={() => setSelectedUser(loc)}>
            <UserMarker user={loc} />
          </Marker>
        ))}
      </MapView>

      {/* Top bar */}
      <View style={styles.topBar}>
        <View style={[styles.dot, myProfile?.is_open ? styles.dotOpen : styles.dotClosed]} />
        <Text style={styles.topText}>{myProfile?.is_open ? 'Sichtbar' : 'Unsichtbar'}</Text>
        <View style={styles.sep} />
        <Text style={styles.topText}>👥 {openCount} in der Nähe</Text>
      </View>

      {/* Center button */}
      <TouchableOpacity style={styles.centerBtn} onPress={centerOnMe}>
        <Text style={{ fontSize: 22 }}>📍</Text>
      </TouchableOpacity>

      {selectedUser && (
        <ProfileCard user={selectedUser} distance={selectedUser.distance} onClose={() => setSelectedUser(null)} />
      )}
    </View>
  )
}

const pastelMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#eaf4ea' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#6b7c6b' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#f0f4f0' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#f5f5f0' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#c8e6f5' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#89c4e1' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#c8e6c9' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#e8f5e9' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#fde68a' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#eaf4ea' }] },
]

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  loading: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: colors.textMuted, marginTop: 12, fontSize: 16 },
  myMarker: {
    width: 52, height: 52, borderRadius: 26,
    borderWidth: 3, borderColor: colors.textMuted,
    backgroundColor: colors.bgCard,
    justifyContent: 'center', alignItems: 'center', overflow: 'visible',
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6, elevation: 5,
  },
  myMarkerOpen: { borderColor: colors.primary },
  myMarkerInner: { width: '100%', height: '100%', borderRadius: 26, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  myMarkerEmoji: { fontSize: 24 },
  userMarker: {
    width: 44, height: 44, borderRadius: 22,
    borderWidth: 2.5, justifyContent: 'center', alignItems: 'center', overflow: 'visible',
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 3,
  },
  userOpen: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  userClosed: { borderColor: colors.textMuted, backgroundColor: '#f0f0f0' },
  markerAvatar: { width: '100%', height: '100%', borderRadius: 22 },
  markerEmoji: { fontSize: 20 },
  statusDot: {
    position: 'absolute', bottom: 1, right: 1,
    width: 12, height: 12, borderRadius: 6,
    borderWidth: 2, borderColor: colors.white,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotOpen: { backgroundColor: colors.primary },
  dotClosed: { backgroundColor: colors.textMuted },
  topBar: {
    position: 'absolute', top: 52, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(255,255,255,0.92)', paddingHorizontal: 18, paddingVertical: 10,
    borderRadius: 24, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, elevation: 4,
  },
  topText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  sep: { width: 1, height: 14, backgroundColor: colors.border },
  centerBtn: {
    position: 'absolute', bottom: 110, right: 20,
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: colors.white, justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 6, elevation: 4,
  },
})

const card = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  container: {
    backgroundColor: colors.bgCard, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: 48, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 20, elevation: 10,
  },
  closeBtn: {
    position: 'absolute', top: 16, right: 20,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center',
  },
  closeText: { color: colors.textSecondary, fontSize: 14, fontWeight: '700' },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 14 },
  avatar: { width: 72, height: 72, borderRadius: 36 },
  avatarPlaceholder: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center',
  },
  name: { color: colors.text, fontSize: 22, fontWeight: '700', marginBottom: 6 },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginBottom: 6 },
  badgeOpen: { backgroundColor: colors.primaryLight },
  badgeClosed: { backgroundColor: colors.bg },
  badgeText: { fontSize: 13, fontWeight: '500' },
  distance: { color: colors.textMuted, fontSize: 13 },
  bio: { color: colors.textSecondary, fontSize: 15, lineHeight: 22, marginBottom: 14 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  tag: {
    backgroundColor: colors.bg, paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1, borderColor: colors.border,
  },
  tagText: { color: colors.textSecondary, fontSize: 13 },
  scanHint: {
    backgroundColor: colors.primaryLight, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: colors.primary,
  },
  scanHintText: { color: colors.primaryDark, fontSize: 14, textAlign: 'center', fontWeight: '500' },
})
