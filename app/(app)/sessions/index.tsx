import { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native'
import { router } from 'expo-router'
import { Feather } from '@expo/vector-icons'
import { supabase } from '../../../lib/supabase'

type Session = {
  id: string
  created_at: string
  status: string
  notes: any
  audio_url?: string
}

const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  processing: '#6c47ff',
  completed: '#4ade80',
  complete: '#4ade80',
  failed: '#ff4444',
  error: '#ff4444',
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  processing: 'Processing',
  completed: 'Completed',
  complete: 'Complete',
  failed: 'Failed',
  error: 'Error',
}

export default function SessionsScreen() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)

  const fetchSessions = useCallback(async () => {
    const { data: { session: authSession } } = await supabase.auth.getSession()
    if (!authSession) {
      setIsAuthenticated(false)
      setLoading(false)
      setRefreshing(false)
      return
    }

    setIsAuthenticated(true)

    const { data, error } = await supabase
      .from('sessions')
      .select('id, created_at, status, notes, audio_url')
      .order('created_at', { ascending: false })
      .limit(50)

    if (!error && data) {
      setSessions(data)
    }
    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => {
    fetchSessions()
  }, [fetchSessions])

  const onRefresh = () => {
    setRefreshing(true)
    fetchSessions()
  }

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const getSummary = (session: Session): string => {
    if (!session.notes) return 'No summary yet'
    if (typeof session.notes === 'string') {
      try {
        const parsed = JSON.parse(session.notes)
        return parsed.summary || parsed.Summary || 'No summary'
      } catch {
        return session.notes.substring(0, 100)
      }
    }
    return session.notes.summary || session.notes.Summary || 'No summary'
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6c47ff" />
      </View>
    )
  }

  if (isAuthenticated === false) {
    return (
      <View style={styles.center}>
        <Feather name="lock" size={40} color="#444" style={{ marginBottom: 16 }} />
        <Text style={styles.unauthText}>Sign in to view sessions</Text>
        <TouchableOpacity style={styles.signInBtn} onPress={() => router.push('/login' as any)}>
          <Text style={styles.signInBtnText}>Sign in</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Sessions</Text>
        <TouchableOpacity style={styles.newBtn} onPress={() => router.push('/record')}>
          <Feather name="plus" size={16} color="#fff" />
          <Text style={styles.newBtnText}>New Session</Text>
        </TouchableOpacity>
      </View>

      {/* Prep Brief Button */}
      <TouchableOpacity style={styles.prepBtn} onPress={() => router.push('/prep' as any)}>
        <Feather name="clipboard" size={16} color="#6c47ff" />
        <Text style={styles.prepBtnText}>Get Prep Brief</Text>
        <Feather name="chevron-right" size={14} color="#6c47ff" style={{ marginLeft: 'auto' }} />
      </TouchableOpacity>

      <FlatList
        data={sessions}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6c47ff" />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="mic" size={40} color="#333" style={{ marginBottom: 16 }} />
            <Text style={styles.emptyText}>No sessions yet.</Text>
            <Text style={styles.emptySubtext}>
              Record your first session to get started.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push(`/(app)/sessions/${item.id}` as any)}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.cardDate}>{formatDate(item.created_at)}</Text>
              <View
                style={[
                  styles.badge,
                  { backgroundColor: (STATUS_COLORS[item.status] || '#666') + '22' },
                ]}
              >
                <Text
                  style={[
                    styles.badgeText,
                    { color: STATUS_COLORS[item.status] || '#666' },
                  ]}
                >
                  {STATUS_LABELS[item.status] || item.status}
                </Text>
              </View>
            </View>
            {(item.status === 'completed' || item.status === 'complete') && (
              <Text style={styles.summary} numberOfLines={2}>
                {getSummary(item)}
              </Text>
            )}
          </TouchableOpacity>
        )}
        contentContainerStyle={sessions.length === 0 ? { flex: 1 } : { paddingBottom: 24 }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    paddingTop: 64,
    paddingHorizontal: 16,
  },
  center: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
  },
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6c47ff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 6,
  },
  newBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  prepBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2a2a4a',
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
    gap: 8,
  },
  prepBtnText: {
    color: '#a78bfa',
    fontSize: 14,
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    gap: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardDate: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  badge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  summary: {
    color: '#888',
    fontSize: 14,
    lineHeight: 20,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 80,
  },
  emptyText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 6,
  },
  emptySubtext: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
  },
  unauthText: {
    color: '#aaa',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 20,
  },
  signInBtn: {
    backgroundColor: '#6c47ff',
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  signInBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
})
