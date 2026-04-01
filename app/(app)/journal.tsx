import { useState, useRef, useEffect } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import {
  useAudioRecorder,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  RecordingPresets,
} from 'expo-audio'
import * as FileSystem from 'expo-file-system'
import { Feather } from '@expo/vector-icons'
import { router } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { API_BASE_URL } from '../../constants/config'

type Mode = 'voice' | 'text'
type VoiceState = 'idle' | 'recording' | 'stopped' | 'uploading' | 'done'

const MAX_SECONDS = 3 * 60 // 3 minutes

export default function JournalScreen() {
  const [mode, setMode] = useState<Mode>('voice')

  // Voice mode state
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY)
  const [voiceState, setVoiceState] = useState<VoiceState>('idle')
  const [elapsed, setElapsed] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Text mode state
  const [textInput, setTextInput] = useState('')
  const [textSaving, setTextSaving] = useState(false)
  const [textDone, setTextDone] = useState(false)

  // Shared state
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }

  const startVoiceRecording = async () => {
    setErrorMsg(null)
    setSuccessMsg(null)
    try {
      const { granted } = await requestRecordingPermissionsAsync()
      if (!granted) {
        Alert.alert('Microphone Access Required', 'Please allow mic access in Settings.')
        return
      }

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
        allowsBackgroundRecording: false,
      })

      await recorder.prepareToRecordAsync()
      recorder.record()
      setVoiceState('recording')
      setElapsed(0)

      timerRef.current = setInterval(() => {
        setElapsed((e) => {
          if (e + 1 >= MAX_SECONDS) {
            stopVoiceRecording()
            return MAX_SECONDS
          }
          return e + 1
        })
      }, 1000)
    } catch (err: any) {
      setErrorMsg(`Could not start recording: ${err.message}`)
    }
  }

  const stopVoiceRecording = async () => {
    if (timerRef.current) clearInterval(timerRef.current)
    try {
      await recorder.stop()
      await setAudioModeAsync({ allowsRecording: false, allowsBackgroundRecording: false })
      setVoiceState('uploading')
      await uploadVoiceNote()
    } catch (err: any) {
      setErrorMsg(`Could not stop recording: ${err.message}`)
      setVoiceState('idle')
    }
  }

  const uploadVoiceNote = async () => {
    try {
      const uri = recorder.uri
      if (!uri) throw new Error('No recording found')

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      })

      const binaryString = atob(base64)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }

      const timestamp = Date.now()
      const path = `${session.user.id}/journal/${timestamp}.m4a`

      const { error: uploadError } = await supabase.storage
        .from('session-audio')
        .upload(path, bytes, { contentType: 'audio/mp4', upsert: false })

      if (uploadError) throw uploadError

      // Create journal note row
      const { data: note, error: noteError } = await supabase
        .from('journal_notes')
        .insert([{ user_id: session.user.id, audio_path: path }])
        .select()
        .single()

      if (noteError) throw noteError

      // Trigger processing
      const res = await fetch(`${API_BASE_URL}/api/journal/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ noteId: note.id }),
      })

      if (!res.ok) throw new Error('Processing failed')

      setVoiceState('done')
      setSuccessMsg('Voice note saved!')
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save voice note')
      setVoiceState('idle')
    }
  }

  const saveTextNote = async () => {
    const text = textInput.trim()
    if (!text) return

    setTextSaving(true)
    setErrorMsg(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const { data: note, error: noteError } = await supabase
        .from('journal_notes')
        .insert([{ user_id: session.user.id, transcript: text, content: text }])
        .select()
        .single()

      if (noteError) throw noteError

      // Optionally call process endpoint with text
      await fetch(`${API_BASE_URL}/api/journal/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ noteId: note.id, text }),
      })

      setTextDone(true)
      setSuccessMsg('Text note saved!')
      setTextInput('')
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save note')
    } finally {
      setTextSaving(false)
    }
  }

  const resetVoice = () => {
    setVoiceState('idle')
    setElapsed(0)
    setSuccessMsg(null)
    setErrorMsg(null)
  }

  const resetText = () => {
    setTextDone(false)
    setSuccessMsg(null)
    setErrorMsg(null)
  }

  return (
    <KeyboardAvoidingView
      style={styles.outer}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.container} bounces={false}>
        <Text style={styles.title}>Journal</Text>
        <Text style={styles.subtitle}>Quick notes between sessions</Text>

        {/* Mode Toggle */}
        <View style={styles.toggle}>
          <TouchableOpacity
            style={[styles.toggleBtn, mode === 'voice' && styles.toggleBtnActive]}
            onPress={() => { setMode('voice'); setErrorMsg(null); setSuccessMsg(null) }}
          >
            <Feather name="mic" size={14} color={mode === 'voice' ? '#fff' : '#888'} />
            <Text style={[styles.toggleBtnText, mode === 'voice' && styles.toggleBtnTextActive]}>
              Voice
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, mode === 'text' && styles.toggleBtnActive]}
            onPress={() => { setMode('text'); setErrorMsg(null); setSuccessMsg(null) }}
          >
            <Feather name="edit-3" size={14} color={mode === 'text' ? '#fff' : '#888'} />
            <Text style={[styles.toggleBtnText, mode === 'text' && styles.toggleBtnTextActive]}>
              Text
            </Text>
          </TouchableOpacity>
        </View>

        {/* Voice Mode */}
        {mode === 'voice' && (
          <View style={styles.modeBox}>
            {voiceState === 'uploading' && (
              <View style={styles.center}>
                <ActivityIndicator size="large" color="#6c47ff" />
                <Text style={styles.statusText}>Saving voice note...</Text>
              </View>
            )}

            {voiceState === 'done' && (
              <View style={styles.center}>
                <View style={styles.doneIcon}>
                  <Feather name="check" size={28} color="#4ade80" />
                </View>
                <Text style={styles.successText}>{successMsg}</Text>
                <TouchableOpacity style={styles.linkBtn} onPress={() => router.push('/sessions' as any)}>
                  <Text style={styles.linkBtnText}>View in Sessions</Text>
                  <Feather name="arrow-right" size={14} color="#6c47ff" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.secondaryBtn} onPress={resetVoice}>
                  <Text style={styles.secondaryBtnText}>Record another</Text>
                </TouchableOpacity>
              </View>
            )}

            {(voiceState === 'idle' || voiceState === 'recording') && (
              <View style={styles.center}>
                <Text style={styles.hintText}>
                  {voiceState === 'idle' ? 'Tap to record — max 3 minutes' : 'Recording...'}
                </Text>

                {voiceState === 'recording' && (
                  <>
                    <Text style={styles.timerText}>{formatTime(elapsed)}</Text>
                    <View style={styles.progressBar}>
                      <View style={[styles.progressFill, { width: `${(elapsed / MAX_SECONDS) * 100}%` as any }]} />
                    </View>
                  </>
                )}

                <TouchableOpacity
                  style={[styles.recordBtn, voiceState === 'recording' && styles.stopBtn]}
                  onPress={voiceState === 'idle' ? startVoiceRecording : stopVoiceRecording}
                >
                  <Feather
                    name={voiceState === 'idle' ? 'mic' : 'square'}
                    size={32}
                    color="#fff"
                  />
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Text Mode */}
        {mode === 'text' && (
          <View style={styles.modeBox}>
            {textDone ? (
              <View style={styles.center}>
                <View style={styles.doneIcon}>
                  <Feather name="check" size={28} color="#4ade80" />
                </View>
                <Text style={styles.successText}>{successMsg}</Text>
                <TouchableOpacity style={styles.secondaryBtn} onPress={resetText}>
                  <Text style={styles.secondaryBtnText}>Write another</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <TextInput
                  style={styles.textArea}
                  multiline
                  placeholder="Write your thoughts..."
                  placeholderTextColor="#444"
                  value={textInput}
                  onChangeText={setTextInput}
                  maxLength={2000}
                  textAlignVertical="top"
                />
                <View style={styles.textFooter}>
                  <Text style={styles.charCount}>{textInput.length}/2000</Text>
                  <TouchableOpacity
                    style={[styles.saveBtn, (!textInput.trim() || textSaving) && styles.saveBtnDisabled]}
                    onPress={saveTextNote}
                    disabled={!textInput.trim() || textSaving}
                  >
                    {textSaving ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.saveBtnText}>Save Note</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        )}

        {errorMsg && (
          <View style={styles.errorBox}>
            <Feather name="alert-circle" size={14} color="#f87171" />
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  container: {
    flexGrow: 1,
    padding: 24,
    paddingTop: 64,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  subtitle: {
    color: '#666',
    fontSize: 14,
    marginBottom: 28,
  },
  toggle: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
  },
  toggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  toggleBtnActive: {
    backgroundColor: '#6c47ff',
  },
  toggleBtnText: {
    color: '#888',
    fontSize: 14,
    fontWeight: '600',
  },
  toggleBtnTextActive: {
    color: '#fff',
  },
  modeBox: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 24,
    minHeight: 280,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    flex: 1,
    minHeight: 200,
  },
  hintText: {
    color: '#666',
    fontSize: 14,
  },
  timerText: {
    fontSize: 40,
    fontWeight: '200',
    color: '#ff4444',
    fontVariant: ['tabular-nums'],
  },
  progressBar: {
    width: '80%',
    height: 4,
    backgroundColor: '#333',
    borderRadius: 2,
  },
  progressFill: {
    height: 4,
    backgroundColor: '#ff4444',
    borderRadius: 2,
  },
  recordBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#6c47ff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6c47ff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  stopBtn: {
    backgroundColor: '#ff4444',
    shadowColor: '#ff4444',
  },
  statusText: {
    color: '#888',
    fontSize: 14,
    marginTop: 12,
  },
  doneIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#0f2318',
    borderWidth: 1,
    borderColor: '#1a3a25',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successText: {
    color: '#4ade80',
    fontSize: 16,
    fontWeight: '600',
  },
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  linkBtnText: {
    color: '#6c47ff',
    fontSize: 14,
    fontWeight: '600',
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  secondaryBtnText: {
    color: '#888',
    fontSize: 13,
  },
  textArea: {
    color: '#fff',
    fontSize: 15,
    lineHeight: 24,
    minHeight: 140,
    backgroundColor: '#111',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  textFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  charCount: {
    color: '#555',
    fontSize: 12,
  },
  saveBtn: {
    backgroundColor: '#6c47ff',
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  saveBtnDisabled: {
    opacity: 0.4,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1a0808',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#3a1515',
    padding: 12,
    marginTop: 16,
  },
  errorText: {
    color: '#f87171',
    fontSize: 13,
    flex: 1,
  },
})
