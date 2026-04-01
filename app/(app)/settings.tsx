import { useState, useEffect } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Linking,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import { router } from 'expo-router'
import { supabase } from '../../lib/supabase'

const APP_VERSION = '1.0.0'

export default function SettingsScreen() {
  const [email, setEmail] = useState<string | null>(null)
  const [plan, setPlan] = useState<string>('free')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadProfile() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setLoading(false)
        return
      }

      setEmail(session.user.email ?? null)

      const { data: profile } = await supabase
        .from('profiles')
        .select('plan')
        .eq('id', session.user.id)
        .single()

      if (profile?.plan) setPlan(profile.plan)
      setLoading(false)
    }
    loadProfile()
  }, [])

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await supabase.auth.signOut()
            router.replace('/login' as any)
          },
        },
      ]
    )
  }

  const planLabel: Record<string, string> = {
    free: 'Free',
    per_session: 'Pay Per Session',
    monthly: 'Monthly',
  }

  const planColor: Record<string, string> = {
    free: '#888',
    per_session: '#a78bfa',
    monthly: '#6c47ff',
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Settings</Text>

      {/* Account Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Feather name="mail" size={16} color="#666" />
            <Text style={styles.rowLabel}>Email</Text>
            <Text style={styles.rowValue}>{email ?? '—'}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Feather name="star" size={16} color="#666" />
            <Text style={styles.rowLabel}>Plan</Text>
            <View style={[styles.planBadge, { backgroundColor: (planColor[plan] || '#888') + '22', borderColor: (planColor[plan] || '#888') + '44' }]}>
              <Text style={[styles.planBadgeText, { color: planColor[plan] || '#888' }]}>
                {planLabel[plan] || plan}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* About Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Feather name="info" size={16} color="#666" />
            <Text style={styles.rowLabel}>Version</Text>
            <Text style={styles.rowValue}>{APP_VERSION}</Text>
          </View>
          <View style={styles.divider} />
          <TouchableOpacity
            style={styles.row}
            onPress={() => Linking.openURL('https://github.com/haydenenloe/clarity')}
          >
            <Feather name="github" size={16} color="#666" />
            <Text style={styles.rowLabel}>View on GitHub</Text>
            <Feather name="external-link" size={14} color="#555" style={{ marginLeft: 'auto' }} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Danger Zone */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, styles.dangerTitle]}>Danger Zone</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.signOutRow} onPress={handleSignOut}>
            <Feather name="log-out" size={16} color="#f87171" />
            <Text style={styles.signOutText}>Sign out</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  content: {
    padding: 24,
    paddingTop: 64,
    paddingBottom: 40,
    gap: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    color: '#555',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  dangerTitle: {
    color: '#7a2020',
  },
  card: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#222',
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  rowLabel: {
    color: '#aaa',
    fontSize: 14,
    flex: 1,
  },
  rowValue: {
    color: '#666',
    fontSize: 14,
  },
  divider: {
    height: 1,
    backgroundColor: '#222',
    marginHorizontal: 16,
  },
  planBadge: {
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderWidth: 1,
  },
  planBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  signOutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  signOutText: {
    color: '#f87171',
    fontSize: 14,
    fontWeight: '600',
  },
})
