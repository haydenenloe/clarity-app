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
  failed: '#ff4444',
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  processing: 'Processing',
  completed: 'Completed',
  failed: 'Failed',
}

export default function SessionsScreen() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchSessions = useCallback(async () => {
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

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sessions</Text>
      <FlatList
        data={sessions}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6c47ff" />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>📋</Text>
            <Text style={styles.emptyText}>No sessions yet</Text>
            <Text style={styles.emptySubtext}>Record your first therapy session to get started</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push(`/(app)/sessions/${item.id}`)}
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
            {item.status === 'completed' && (
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
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 24,
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
    gap: 8,
    paddingBottom: 80,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 8,
  },
  emptyText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  emptySubtext: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
  },
})
