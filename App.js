import 'react-native-url-polyfill/auto'
import React, { useState, useEffect } from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { Text, View, ActivityIndicator, StyleSheet } from 'react-native'
import { supabase } from './src/lib/supabase'
import { colors } from './src/theme'
import { useUnreadCount } from './src/hooks/useUnreadCount'
import * as Notifications from 'expo-notifications'
import { registerForPushNotifications } from './src/lib/notifications'

import AuthScreen from './src/screens/AuthScreen'
import MapScreen from './src/screens/MapScreen'
import ProfileScreen from './src/screens/ProfileScreen'
import ContactsScreen from './src/screens/ContactsScreen'
import ChatScreen from './src/screens/ChatScreen'
import QRScannerScreen from './src/screens/QRScannerScreen'
import UserProfileScreen from './src/screens/UserProfileScreen'

const Stack = createNativeStackNavigator()
const Tab = createBottomTabNavigator()

function MainTabs() {
  const { unreadCount, markAllRead } = useUnreadCount()

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopColor: colors.border,
          paddingBottom: 6,
          height: 62,
          shadowColor: '#000',
          shadowOpacity: 0.06,
          shadowRadius: 8,
          elevation: 8,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tab.Screen name="Karte" component={MapScreen}
        options={{ tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>🗺️</Text> }} />
      <Tab.Screen name="Kontakte" component={ContactsScreen}
        options={{
          tabBarIcon: ({ color }) => (
            <View>
              <Text style={{ fontSize: 22, color }}>💬</Text>
              {unreadCount > 0 && (
                <View style={badge.dot}>
                  <Text style={badge.text}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                </View>
              )}
            </View>
          ),
        }}
        listeners={{ tabPress: markAllRead }}
      />
      <Tab.Screen name="Profil" component={ProfileScreen}
        options={{ tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>👤</Text> }} />
    </Tab.Navigator>
  )
}

function MainStack() {
  return (
    <Stack.Navigator screenOptions={{
      headerShown: false,
      animation: 'slide_from_right',
    }}>
      <Stack.Screen name="Tabs" component={MainTabs} />
      <Stack.Screen name="Chat" component={ChatScreen} />
      <Stack.Screen name="QRScanner" component={QRScannerScreen}
        options={{ presentation: 'modal' }} />
      <Stack.Screen name="UserProfile" component={UserProfileScreen} />
    </Stack.Navigator>
  )
}

export default function App() {
  const [session, setSession] = useState(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) registerForPushNotifications()
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  if (session === undefined) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {session ? (
          <Stack.Screen name="Main" component={MainStack} />
        ) : (
          <Stack.Screen name="Auth" component={AuthScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  )
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' },
})

const badge = StyleSheet.create({
  dot: {
    position: 'absolute', top: -4, right: -8,
    backgroundColor: '#e05555', borderRadius: 10,
    minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 4, borderWidth: 2, borderColor: colors.white,
  },
  text: { color: '#fff', fontSize: 10, fontWeight: '800' },
})
