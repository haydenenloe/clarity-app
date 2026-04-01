import { useState, useEffect } from 'react'
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { supabase } from '../../../lib/supabase'

type SessionNotes = {
  summary?: string
  Summary?: string
  key_themes?: string[]
  keyThemes?: string[]
  working_on?: string[]
  workingOn?: string[]
  action_items?: string[]
  actionItems?: string[]
  breakthroughs?: string[]
  bring_up_next_time?: string[]
  bringUpNextTime?: string[]
}

function Section({ title, emoji, items }: { title: string; emoji: string; items?: string[] }) {
  if (!items || items.length === 0) return null
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>
        {emoji} {title}
      </Text>
      {items.map((item, i) => (
        <View key={i} style={styles.bulletRow}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.bulletText}>{item}</Text>
        </View>
      ))}
    </View>
  )
}

export default function SessionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchSession = async () => {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('id', id)
        .single()

      if (!error && data) {
        setSession(data)
      }
      setLoading(false)
    }
    fetchSession()
  }, [id])

  const parseNotes = (raw: any): SessionNotes | null => {
    if (!raw) return null
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw)
      } catch {
        return null
      }
    }
    return raw
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6c47ff" />
      </View>
    )
  }

  if (!session) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Session not found</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backLink}>← Go back</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const notes = parseNotes(session.notes)

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Text style={styles.backBtnText}>← Sessions</Text>
      </TouchableOpacity>

      <Text style={styles.date}>{formatDate(session.created_at)}</Text>

      {session.status !== 'completed' && (
        <View style={styles.statusBox}>
          <Text style={styles.statusText}>
            {session.status === 'processing'
              ? '⏳ Processing... check back soon'
              : session.status === 'failed'
              ? '❌ Processing failed'
              : '⏳ Pending processing'}
          </Text>
        </View>
      )}

      {notes ? (
        <>
          {/* Summary */}
          {(notes.summary || notes.Summary) && (
            <View style={styles.summaryBox}>
              <Text style={styles.summaryTitle}>📝 Summary</Text>
              <Text style={styles.summaryText}>{notes.summary || notes.Summary}</Text>
            </View>
          )}

          <Section
            title="Key Themes"
            emoji="🔑"
            items={notes.key_themes || notes.keyThemes}
          />
          <Section
            title="Working On"
            emoji="🔨"
            items={notes.working_on || notes.workingOn}
          />
          <Section
            title="Action Items"
            emoji="✅"
            items={notes.action_items || notes.actionItems}
          />
          <Section
            title="Breakthroughs"
            emoji="💡"
            items={notes.breakthroughs}
          />
          <Section
            title="Bring Up Next Time"
            emoji="📌"
            items={notes.bring_up_next_time || notes.bringUpNextTime}
          />
        </>
      ) : (
        session.status === 'completed' && (
          <Text style={styles.noNotes}>No notes available for this session.</Text>
        )
      )}
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
    paddingBottom: 48,
  },
  center: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  backBtn: {
    marginBottom: 24,
  },
  backBtnText: {
    color: '#6c47ff',
    fontSize: 16,
  },
  date: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 24,
  },
  statusBox: {
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    padding: 16,
    marginBottom: 24,
  },
  statusText: {
    color: '#888',
    fontSize: 15,
  },
  summaryBox: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    gap: 8,
  },
  summaryTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  summaryText: {
    color: '#ccc',
    fontSize: 15,
    lineHeight: 24,
  },
  section: {
    marginBottom: 24,
    gap: 8,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  bulletRow: {
    flexDirection: 'row',
    gap: 8,
  },
  bullet: {
    color: '#6c47ff',
    fontSize: 15,
    lineHeight: 22,
  },
  bulletText: {
    color: '#ccc',
    fontSize: 15,
    lineHeight: 22,
    flex: 1,
  },
  noNotes: {
    color: '#666',
    fontSize: 15,
  },
  errorText: {
    color: '#fff',
    fontSize: 18,
  },
  backLink: {
    color: '#6c47ff',
    fontSize: 15,
  },
})
