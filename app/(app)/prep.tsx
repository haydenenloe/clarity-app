import { useState, useEffect } from 'react'
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import { supabase } from '../../lib/supabase'
import { API_BASE_URL } from '../../constants/config'

interface PrepBrief {
  lastSessionRecap?: string
  patterns?: string[]
  suggestedAgenda?: string[]
  questionsToExplore?: string[]
}

export default function PrepScreen() {
  const [brief, setBrief] = useState<PrepBrief | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchBrief = async () => {
    setLoading(true)
    setError(null)
    setBrief(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const response = await fetch(`${API_BASE_URL}/api/prep`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      })

      if (!response.ok) {
        const text = await response.text()
        throw new Error(text || 'Failed to load prep brief')
      }

      const data = await response.json()
      setBrief(data.brief || data)
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBrief()
  }, [])

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Prep Brief</Text>
        <TouchableOpacity onPress={fetchBrief} disabled={loading} style={styles.refreshBtn}>
          <Feather name="refresh-cw" size={16} color={loading ? '#444' : '#6c47ff'} />
        </TouchableOpacity>
      </View>
      <Text style={styles.subtitle}>AI summary before your next session</Text>

      {loading && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#6c47ff" />
          <Text style={styles.loadingText}>Analyzing your sessions...</Text>
        </View>
      )}

      {error && !loading && (
        <View style={styles.errorBox}>
          <Feather name="alert-circle" size={20} color="#f87171" style={{ marginBottom: 8 }} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchBrief}>
            <Text style={styles.retryBtnText}>Try again</Text>
          </TouchableOpacity>
        </View>
      )}

      {brief && !loading && (
        <View style={styles.sections}>
          {brief.lastSessionRecap && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Last Session Recap</Text>
              <View style={styles.card}>
                <Text style={styles.cardText}>{brief.lastSessionRecap}</Text>
              </View>
            </View>
          )}

          {brief.patterns && brief.patterns.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Patterns Across Sessions</Text>
              <View style={styles.card}>
                {brief.patterns.map((p, i) => (
                  <View key={i} style={styles.listRow}>
                    <Text style={styles.bullet}>◆</Text>
                    <Text style={styles.cardText}>{p}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {brief.suggestedAgenda && brief.suggestedAgenda.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Suggested Agenda</Text>
              <View style={[styles.card, styles.agendaCard]}>
                {brief.suggestedAgenda.map((item, i) => (
                  <View key={i} style={styles.listRow}>
                    <Text style={styles.agendaNumber}>
                      {String(i + 1).padStart(2, '0')}.
                    </Text>
                    <Text style={[styles.cardText, styles.agendaText]}>{item}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {brief.questionsToExplore && brief.questionsToExplore.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Questions to Bring In</Text>
              {brief.questionsToExplore.map((q, i) => (
                <View key={i} style={[styles.card, styles.questionCard]}>
                  <Text style={styles.questionMark}>?</Text>
                  <Text style={[styles.cardText, styles.questionText]}>{q}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
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
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
  },
  subtitle: {
    color: '#666',
    fontSize: 14,
    marginBottom: 32,
  },
  refreshBtn: {
    padding: 8,
  },
  center: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 16,
  },
  loadingText: {
    color: '#666',
    fontSize: 14,
  },
  errorBox: {
    backgroundColor: '#1a0808',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3a1515',
    padding: 20,
    alignItems: 'center',
  },
  errorText: {
    color: '#f87171',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 12,
  },
  retryBtn: {
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  retryBtnText: {
    color: '#888',
    fontSize: 13,
  },
  sections: {
    gap: 24,
  },
  section: {
    gap: 8,
  },
  sectionLabel: {
    color: '#555',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  card: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#222',
    padding: 16,
    gap: 8,
  },
  agendaCard: {
    backgroundColor: '#0d0d1a',
    borderColor: '#1a1a3a',
  },
  questionCard: {
    flexDirection: 'row',
    backgroundColor: '#0d1a0d',
    borderColor: '#1a3a1a',
    gap: 10,
    marginBottom: 6,
  },
  cardText: {
    color: '#ccc',
    fontSize: 14,
    lineHeight: 22,
    flex: 1,
  },
  listRow: {
    flexDirection: 'row',
    gap: 10,
  },
  bullet: {
    color: '#555',
    fontSize: 10,
    marginTop: 4,
  },
  agendaNumber: {
    color: '#818cf8',
    fontFamily: 'monospace',
    fontSize: 12,
    marginTop: 3,
  },
  agendaText: {
    color: '#c7d2fe',
  },
  questionMark: {
    color: '#4ade80',
    fontSize: 16,
    fontWeight: '700',
  },
  questionText: {
    color: '#86efac',
  },
})
