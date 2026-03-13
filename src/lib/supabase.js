import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'
import 'react-native-url-polyfill/auto'

const supabaseUrl = 'https://zgiwiiqklnarbvggfzul.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpnaXdpaXFrbG5hcmJ2Z2dmenVsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0Mjg4MzcsImV4cCI6MjA4OTAwNDgzN30.PimQdMbvoeKRVRVc8awWb7wdvU_dVIkmiBvcvxrg3AA'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})
