import React, { useState, useEffect, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native'
import MapView, { Marker, Circle } from 'react-native-maps'
import * as Location from 'expo-location'
import { supabase } from '../lib/supabase'

const UPDATE_INTERVAL_MS = 30000 // update location every 30 seconds
const NEARBY_RADIUS_M = 1000 // show users within 1km

function getDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export default function MapScreen() {
  const [myLocation, setMyLocation] = useState(null)
  const [nearbyUsers, setNearbyUsers] = useState([])
  const [myProfile, setMyProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const mapRef = useRef(null)
  const locationInterval = useRef(null)

  useEffect(() => {
    init()
    return () => {
      if (locationInterval.current) clearInterval(locationInterval.current)
    }
  }, [])

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Load own profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
    setMyProfile(profile)

    // Request location permission
    const { status } = await Location.requestForegroundPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert(
        'Standort benötigt',
        'Bitte erlaube den Standortzugriff in den Einstellungen.'
      )
      setLoading(false)
      return
    }

    // Get initial location
    await updateLocation(user.id)
    setLoading(false)

    // Update location periodically
    locationInterval.current = setInterval(() => {
      updateLocation(user.id)
    }, UPDATE_INTERVAL_MS)

    // Subscribe to nearby user changes
    subscribeToNearbyUsers(user.id)
  }

  async function updateLocation(userId) {
    try {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      })
      const { latitude, longitude } = loc.coords
      setMyLocation({ latitude, longitude })

      // Upsert location in Supabase
      await supabase.from('locations').upsert({
        user_id: userId,
        lat: latitude,
        lng: longitude,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })

      // Load nearby users
      loadNearbyUsers(userId, latitude, longitude)
    } catch (e) {
      console.log('Location error:', e)
    }
  }

  async function loadNearbyUsers(myUserId, myLat, myLng) {
    const { data: locations } = await supabase
      .from('locations')
      .select('user_id, lat, lng, profiles(id, username, is_open)')
      .neq('user_id', myUserId)

    if (!locations) return

    const nearby = locations.filter((loc) => {
      const dist = getDistanceMeters(myLat, myLng, loc.lat, loc.lng)
      return dist <= NEARBY_RADIUS_M
    })

    setNearbyUsers(nearby)
  }

  function subscribeToNearbyUsers(myUserId) {
    supabase
      .channel('locations')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'locations' },
        () => {
          if (myLocation) {
            loadNearbyUsers(myUserId, myLocation.latitude, myLocation.longitude)
          }
        }
      )
      .subscribe()
  }

  function centerOnMe() {
    if (myLocation && mapRef.current) {
      mapRef.current.animateToRegion({
        ...myLocation,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      })
    }
  }

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
        initialRegion={{
          ...myLocation,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        showsUserLocation={false}
        showsMyLocationButton={false}
      >
        {/* My location */}
        <Marker coordinate={myLocation} title="Du" anchor={{ x: 0.5, y: 0.5 }}>
          <View style={[styles.myMarker, myProfile?.is_open && styles.myMarkerOpen]}>
            <Text style={styles.markerEmoji}>😊</Text>
          </View>
        </Marker>

        {/* Radius circle */}
        <Circle
          center={myLocation}
          radius={NEARBY_RADIUS_M}
          strokeColor="rgba(76,175,80,0.3)"
          fillColor="rgba(76,175,80,0.05)"
        />

        {/* Nearby users */}
        {nearbyUsers.map((loc) => (
          <Marker
            key={loc.user_id}
            coordinate={{ latitude: loc.lat, longitude: loc.lng }}
            title={loc.profiles?.username || 'Unbekannt'}
            description={loc.profiles?.is_open ? '🟢 Offen für Gespräch' : '⚫ Nicht verfügbar'}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={[
              styles.userMarker,
              loc.profiles?.is_open ? styles.userMarkerOpen : styles.userMarkerClosed
            ]}>
              <Text style={styles.markerEmoji}>👤</Text>
            </View>
          </Marker>
        ))}
      </MapView>

      {/* Status badge */}
      <View style={styles.statusBadge}>
        <View style={[styles.statusDot, myProfile?.is_open ? styles.dotOpen : styles.dotClosed]} />
        <Text style={styles.statusText}>
          {myProfile?.is_open ? 'Offen für Gespräch' : 'Nicht verfügbar'}
        </Text>
      </View>

      {/* Nearby counter */}
      <View style={styles.counterBadge}>
        <Text style={styles.counterText}>
          👥 {nearbyUsers.filter(u => u.profiles?.is_open).length} in der Nähe
        </Text>
      </View>

      {/* Center button */}
      <TouchableOpacity style={styles.centerBtn} onPress={centerOnMe}>
        <Text style={styles.centerBtnText}>📍</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0f0f0f',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#aaa',
    marginTop: 12,
    fontSize: 16,
  },
  myMarker: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#333',
    borderWidth: 3,
    borderColor: '#666',
    justifyContent: 'center',
    alignItems: 'center',
  },
  myMarkerOpen: {
    borderColor: '#4CAF50',
    backgroundColor: '#1a3d1a',
  },
  userMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userMarkerOpen: {
    borderColor: '#4CAF50',
    backgroundColor: '#1a3d1a',
  },
  userMarkerClosed: {
    borderColor: '#555',
    backgroundColor: '#222',
  },
  markerEmoji: {
    fontSize: 20,
  },
  statusBadge: {
    position: 'absolute',
    top: 56,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dotOpen: { backgroundColor: '#4CAF50' },
  dotClosed: { backgroundColor: '#666' },
  statusText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  counterBadge: {
    position: 'absolute',
    bottom: 100,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  counterText: {
    color: '#fff',
    fontSize: 14,
  },
  centerBtn: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerBtnText: {
    fontSize: 22,
  },
})
