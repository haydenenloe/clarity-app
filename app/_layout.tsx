import { useEffect, useState } from 'react'
import { Slot, router } from 'expo-router'
import * as Linking from 'expo-linking'
import { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null)
  const [initialized, setInitialized] = useState(false)

  // Handle deep link auth callbacks (magic link → clarity://auth/callback#access_token=...)
  useEffect(() => {
    const handleUrl = async (url: string) => {
      if (!url) return
      // Extract tokens from URL fragment
      const fragment = url.includes('#') ? url.split('#')[1] : url.split('?')[1]
      if (!fragment) return
      const params = new URLSearchParams(fragment)
      const access_token = params.get('access_token')
      const refresh_token = params.get('refresh_token')
      if (access_token && refresh_token) {
        await supabase.auth.setSession({ access_token, refresh_token })
      }
    }

    // Handle link that opened the app
    Linking.getInitialURL().then((url) => {
      if (url) handleUrl(url)
    })

    // Handle links received while app is open
    const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url))
    return () => sub.remove()
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setInitialized(true)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!initialized) return
    if (session) {
      router.replace('/(app)/record')
    } else {
      router.replace('/(auth)/login')
    }
  }, [session, initialized])

  return <Slot />
}
