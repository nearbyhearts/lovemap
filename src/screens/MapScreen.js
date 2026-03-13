import React, { useState, useEffect, useRef } from 'react'
import {
  View, Text, StyleSheet, Alert, ActivityIndicator,
  TouchableOpacity, Image, Modal, ScrollView,
} from 'react-native'
import MapView, { Marker, Circle } from 'react-native-maps'
import * as Location from 'expo-location'
import { supabase } from '../lib/supabase'

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

function formatDistance(meters) {
  if (meters < 1000) return `${Math.round(meters)}m`
  return `${(meters / 1000).toFixed(1)}km`
}

function ProfileCard({ user, distance, onClose }) {
  const p = user.profiles
  return (
    <Modal visible={!!user} transparent animationType="slide">
      <View style={card.overlay}>
        <View style={card.container}>
          <TouchableOpacity style={card.closeBtn} onPress={onClose}>
            <Text style={card.closeText}>✕</Text>
          </TouchableOpacity>

          <View style={card.avatarRow}>
            {p?.avatar_url ? (
              <Image source={{ uri: p.avatar_url }} style={card.avatar} />
            ) : (
              <View style={card.avatarPlaceholder}>
                <Text style={{ fontSize: 32 }}>👤</Text>
              </View>
            )}
            <View style={card.headerInfo}>
              <Text style={card.name}>{p?.username || 'Unbekannt'}</Text>
              <View style={[card.statusBadge, p?.is_open ? card.statusOpen : card.statusClosed]}>
                <Text style={card.statusText}>
                  {p?.is_open ? '🟢 Offen' : '⚫ Nicht verfügbar'}
                </Text>
              </View>
              <Text style={card.distance}>📍 {formatDistance(distance)} entfernt</Text>
            </View>
          </View>

          {p?.bio ? <Text style={card.bio}>{p.bio}</Text> : null}

          <View style={card.tags}>
            {p?.gender ? <View style={card.tag}><Text style={card.tagText}>{p.gender}</Text></View> : null}
            {p?.height ? <View style={card.tag}><Text style={card.tagText}>{p.height} cm</Text></View> : null}
            {p?.looking_for ? <View style={card.tagGreen}><Text style={card.tagTextGreen}>Sucht: {p.looking_for}</Text></View> : null}
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
    const { data: locations } = await supabase
      .from('locations')
      .select('user_id, lat, lng, profiles(id, username, is_open, avatar_url, bio, gender, height, looking_for)')
      .neq('user_id', myId)

    if (!locations) return
    const nearby = locations
      .map(loc => ({ ...loc, distance: getDistanceMeters(myLat, myLng, loc.lat, loc.lng) }))
      .filter(loc => loc.distance <= NEARBY_RADIUS_M)
      .sort((a, b) => a.distance - b.distance)
    setNearbyUsers(nearby)
  }

  function subscribeToNearbyUsers(myId) {
    supabase.channel('locations_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'locations' }, () => {
        if (myLocation) loadNearbyUsers(myId, myLocation.latitude, myLocation.longitude)
      })
      .subscribe()
  }

  function centerOnMe() {
    if (myLocation && mapRef.current) {
      mapRef.current.animateToRegion({ ...myLocation, latitudeDelta: 0.01, longitudeDelta: 0.01 })
    }
  }

  const openCount = nearbyUsers.filter(u => u.profiles?.is_open).length

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>Standort wird ermittelt...</Text>
      </View>
    )
  }

  if (!myLocation) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Kein Standortzugriff</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={{ ...myLocation, latitudeDelta: 0.01, longitudeDelta: 0.01 }}
        customMapStyle={darkMapStyle}
      >
        {/* My marker */}
        <Marker coordinate={myLocation} anchor={{ x: 0.5, y: 0.5 }}>
          <View style={[styles.myMarker, myProfile?.is_open && styles.myMarkerOpen]}>
            {myProfile?.avatar_url ? (
              <Image source={{ uri: myProfile.avatar_url }} style={styles.markerAvatar} />
            ) : (
              <Text style={styles.markerEmoji}>😊</Text>
            )}
          </View>
        </Marker>

        {/* Radius */}
        <Circle
          center={myLocation}
          radius={NEARBY_RADIUS_M}
          strokeColor="rgba(76,175,80,0.2)"
          fillColor="rgba(76,175,80,0.04)"
          strokeWidth={1}
        />

        {/* Nearby users */}
        {nearbyUsers.map((loc) => (
          <Marker
            key={loc.user_id}
            coordinate={{ latitude: loc.lat, longitude: loc.lng }}
            anchor={{ x: 0.5, y: 0.5 }}
            onPress={() => setSelectedUser(loc)}
          >
            <View style={[styles.userMarker, loc.profiles?.is_open ? styles.userOpen : styles.userClosed]}>
              {loc.profiles?.avatar_url ? (
                <Image source={{ uri: loc.profiles.avatar_url }} style={styles.markerAvatar} />
              ) : (
                <Text style={styles.markerEmoji}>👤</Text>
              )}
            </View>
          </Marker>
        ))}
      </MapView>

      {/* Top status bar */}
      <View style={styles.topBar}>
        <View style={[styles.statusDot, myProfile?.is_open ? styles.dotOpen : styles.dotClosed]} />
        <Text style={styles.statusText}>
          {myProfile?.is_open ? 'Sichtbar' : 'Unsichtbar'}
        </Text>
        <View style={styles.divider} />
        <Text style={styles.statusText}>👥 {openCount} in der Nähe</Text>
      </View>

      {/* Center button */}
      <TouchableOpacity style={styles.centerBtn} onPress={centerOnMe}>
        <Text style={styles.centerBtnText}>📍</Text>
      </TouchableOpacity>

      {/* Selected user card */}
      {selectedUser && (
        <ProfileCard
          user={selectedUser}
          distance={selectedUser.distance}
          onClose={() => setSelectedUser(null)}
        />
      )}
    </View>
  )
}

const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#0f0f0f' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#555' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0a0a0a' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1a1a1a' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#111' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0a1628' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#0f1a0f' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#111' }] },
]

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  map: { flex: 1 },
  loadingContainer: { flex: 1, backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#555', marginTop: 12, fontSize: 16 },
  myMarker: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: '#1a1a1a', borderWidth: 3, borderColor: '#555',
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
  },
  myMarkerOpen: { borderColor: '#4CAF50', backgroundColor: '#0d2b0d' },
  userMarker: {
    width: 42, height: 42, borderRadius: 21,
    borderWidth: 2, justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
  },
  userOpen: { borderColor: '#4CAF50', backgroundColor: '#0d2b0d' },
  userClosed: { borderColor: '#333', backgroundColor: '#1a1a1a' },
  markerAvatar: { width: '100%', height: '100%' },
  markerEmoji: { fontSize: 20 },
  topBar: {
    position: 'absolute', top: 52, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(10,10,10,0.9)', paddingHorizontal: 18,
    paddingVertical: 10, borderRadius: 24, gap: 10,
    borderWidth: 1, borderColor: '#222',
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  dotOpen: { backgroundColor: '#4CAF50' },
  dotClosed: { backgroundColor: '#555' },
  statusText: { color: '#ccc', fontSize: 13, fontWeight: '500' },
  divider: { width: 1, height: 14, backgroundColor: '#333' },
  centerBtn: {
    position: 'absolute', bottom: 110, right: 20,
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: 'rgba(10,10,10,0.9)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: '#222',
  },
  centerBtnText: { fontSize: 22 },
})

const card = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  container: {
    backgroundColor: '#161616', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: 48, borderTopWidth: 1, borderColor: '#222',
  },
  closeBtn: {
    position: 'absolute', top: 16, right: 20,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#222', justifyContent: 'center', alignItems: 'center',
  },
  closeText: { color: '#aaa', fontSize: 14, fontWeight: '700' },
  avatarRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  avatar: { width: 72, height: 72, borderRadius: 36, marginRight: 16 },
  avatarPlaceholder: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: '#1e1e1e',
    justifyContent: 'center', alignItems: 'center', marginRight: 16,
  },
  headerInfo: { flex: 1 },
  name: { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 6 },
  statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginBottom: 6 },
  statusOpen: { backgroundColor: '#0d2b0d' },
  statusClosed: { backgroundColor: '#1a1a1a' },
  statusText: { color: '#ccc', fontSize: 13 },
  distance: { color: '#666', fontSize: 13 },
  bio: { color: '#aaa', fontSize: 15, lineHeight: 22, marginBottom: 16 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  tag: { backgroundColor: '#1e1e1e', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#2a2a2a' },
  tagText: { color: '#aaa', fontSize: 13 },
  tagGreen: { backgroundColor: '#0d2b0d', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#2a7a2a' },
  tagTextGreen: { color: '#4CAF50', fontSize: 13 },
  scanHint: { backgroundColor: '#0d2b0d', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#2a7a2a' },
  scanHintText: { color: '#4CAF50', fontSize: 14, textAlign: 'center' },
})
