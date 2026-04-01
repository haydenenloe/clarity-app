import { useState, useEffect, useRef } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  AppState,
} from 'react-native'
import { Audio } from 'expo-av'
import * as FileSystem from 'expo-file-system'
import { supabase } from '../../lib/supabase'
import { API_BASE_URL } from '../../constants/config'

type RecordingState = 'idle' | 'recording' | 'stopped' | 'uploading' | 'processing' | 'done'

export default function RecordScreen() {
  const [state, setState] = useState<RecordingState>('idle')
  const [recording, setRecording] = useState<Audio.Recording | null>(null)
  const [recordingUri, setRecordingUri] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [isBackground, setIsBackground] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const appStateRef = useRef(AppState.currentState)

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (appStateRef.current === 'active' && nextState.match(/inactive|background/)) {
        setIsBackground(true)
      } else if (nextState === 'active') {
        setIsBackground(false)
      }
      appStateRef.current = nextState
    })
    return () => sub.remove()
  }, [])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  const startRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert(
          'Microphone Permission Required',
          'Please allow microphone access in Settings to record sessions.'
        )
        return
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
      })

      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      )

      setRecording(newRecording)
      setState('recording')
      setElapsed(0)
      setRecordingUri(null)

      timerRef.current = setInterval(() => {
        setElapsed((e) => e + 1)
      }, 1000)
    } catch (err: any) {
      Alert.alert('Error', `Could not start recording: ${err.message}`)
    }
  }

  const stopRecording = async () => {
    if (!recording) return
    try {
      if (timerRef.current) clearInterval(timerRef.current)
      await recording.stopAndUnloadAsync()
      const uri = recording.getURI()
      setRecordingUri(uri)
      setRecording(null)
      setState('stopped')

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        staysActiveInBackground: false,
      })
    } catch (err: any) {
      Alert.alert('Error', `Could not stop recording: ${err.message}`)
    }
  }

  const uploadAndProcess = async () => {
    if (!recordingUri) return

    setState('uploading')
    setStatusMessage('Uploading recording...')

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      // Read file as base64
      const base64 = await FileSystem.readAsStringAsync(recordingUri, {
        encoding: FileSystem.EncodingType.Base64,
      })

      const fileName = `recordings/${session.user.id}/${Date.now()}.m4a`
      const fileData = Buffer.from(base64, 'base64')

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('audio')
        .upload(fileName, fileData, {
          contentType: 'audio/m4a',
          upsert: false,
        })

      if (uploadError) throw uploadError

      setStatusMessage('Processing session with AI...')
      setState('processing')

      // Trigger processing via API
      const response = await fetch(`${API_BASE_URL}/api/process-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          storagePath: uploadData.path,
          userId: session.user.id,
        }),
      })

      if (!response.ok) {
        const err = await response.text()
        throw new Error(`Processing failed: ${err}`)
      }

      setState('done')
      setStatusMessage('Session processed! View it in Sessions.')
    } catch (err: any) {
      setState('stopped')
      Alert.alert('Upload Error', err.message || 'Something went wrong. Please try again.')
    }
  }

  const reset = () => {
    setState('idle')
    setRecordingUri(null)
    setElapsed(0)
    setStatusMessage('')
  }

  return (
    <ScrollView contentContainerStyle={styles.container} bounces={false}>
      <Text style={styles.title}>Record Session</Text>

      {/* Timer display */}
      <View style={styles.timerBox}>
        <Text style={styles.timer}>{formatTime(elapsed)}</Text>
        {state === 'recording' && (
          <View style={styles.liveRow}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>
              {isBackground ? 'Recording in background' : 'Recording...'}
            </Text>
          </View>
        )}
        {state === 'stopped' && (
          <Text style={styles.readyText}>Recording saved — ready to upload</Text>
        )}
      </View>

      {/* Main action button */}
      {state === 'idle' && (
        <TouchableOpacity style={styles.recordBtn} onPress={startRecording}>
          <Text style={styles.recordBtnIcon}>🎙️</Text>
          <Text style={styles.recordBtnText}>Start Recording</Text>
        </TouchableOpacity>
      )}

      {state === 'recording' && (
        <TouchableOpacity style={[styles.recordBtn, styles.stopBtn]} onPress={stopRecording}>
          <Text style={styles.recordBtnIcon}>⏹️</Text>
          <Text style={styles.recordBtnText}>Stop Recording</Text>
        </TouchableOpacity>
      )}

      {state === 'stopped' && (
        <View style={styles.actionRow}>
          <TouchableOpacity style={[styles.actionBtn, styles.uploadBtn]} onPress={uploadAndProcess}>
            <Text style={styles.actionBtnText}>⬆️ Upload & Process</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, styles.discardBtn]} onPress={reset}>
            <Text style={styles.actionBtnText}>🗑️ Discard</Text>
          </TouchableOpacity>
        </View>
      )}

      {(state === 'uploading' || state === 'processing') && (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#6c47ff" />
          <Text style={styles.loadingText}>{statusMessage}</Text>
        </View>
      )}

      {state === 'done' && (
        <View style={styles.doneBox}>
          <Text style={styles.doneEmoji}>✅</Text>
          <Text style={styles.doneText}>{statusMessage}</Text>
          <TouchableOpacity style={styles.recordBtn} onPress={reset}>
            <Text style={styles.recordBtnText}>Record Another</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Background recording info */}
      {state === 'idle' && (
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>About background recording</Text>
          <Text style={styles.infoText}>
            Clarity keeps recording even when you lock your screen or switch apps. Your full session is captured automatically.
          </Text>
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#0a0a0a',
    alignItems: 'center',
    padding: 24,
    paddingTop: 64,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 48,
  },
  timerBox: {
    alignItems: 'center',
    marginBottom: 48,
  },
  timer: {
    fontSize: 64,
    fontWeight: '200',
    color: '#fff',
    fontVariant: ['tabular-nums'],
    letterSpacing: 2,
  },
  liveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  liveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ff4444',
  },
  liveText: {
    color: '#ff4444',
    fontSize: 14,
    fontWeight: '600',
  },
  readyText: {
    color: '#4ade80',
    fontSize: 14,
    marginTop: 12,
  },
  recordBtn: {
    backgroundColor: '#6c47ff',
    borderRadius: 80,
    width: 160,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6c47ff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    gap: 8,
  },
  stopBtn: {
    backgroundColor: '#ff4444',
    shadowColor: '#ff4444',
  },
  recordBtnIcon: {
    fontSize: 40,
  },
  recordBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
  },
  actionBtn: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  uploadBtn: {
    backgroundColor: '#6c47ff',
  },
  discardBtn: {
    backgroundColor: '#2a2a2a',
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  loadingBox: {
    alignItems: 'center',
    gap: 16,
    marginTop: 24,
  },
  loadingText: {
    color: '#888',
    fontSize: 15,
  },
  doneBox: {
    alignItems: 'center',
    gap: 16,
  },
  doneEmoji: {
    fontSize: 64,
  },
  doneText: {
    color: '#4ade80',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  infoBox: {
    marginTop: 48,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    gap: 8,
  },
  infoTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  infoText: {
    color: '#666',
    fontSize: 13,
    lineHeight: 20,
  },
})
