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
import {
  useAudioRecorder,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  RecordingPresets,
} from 'expo-audio'
import * as FileSystem from 'expo-file-system'
import * as DocumentPicker from 'expo-document-picker'
import { Feather } from '@expo/vector-icons'
import { supabase } from '../../lib/supabase'
import { API_BASE_URL } from '../../constants/config'

type RecordingState = 'idle' | 'recording' | 'stopped' | 'uploading' | 'processing' | 'done'

type PickedFile = {
  uri: string
  name: string
  size: number
  mimeType: string
}

export default function RecordScreen() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY)

  const [state, setState] = useState<RecordingState>('idle')
  const [recordingUri, setRecordingUri] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [isBackground, setIsBackground] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [pickedFile, setPickedFile] = useState<PickedFile | null>(null)
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

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const startRecording = async () => {
    try {
      const { granted } = await requestRecordingPermissionsAsync()
      if (!granted) {
        Alert.alert(
          'Microphone Permission Required',
          'Please allow microphone access in Settings to record sessions.'
        )
        return
      }

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
        allowsBackgroundRecording: true,
      })

      await recorder.prepareToRecordAsync()
      recorder.record()

      setState('recording')
      setElapsed(0)
      setRecordingUri(null)
      setPickedFile(null)

      timerRef.current = setInterval(() => {
        setElapsed((e) => e + 1)
      }, 1000)
    } catch (err: any) {
      Alert.alert('Error', `Could not start recording: ${err.message}`)
    }
  }

  const stopRecording = async () => {
    try {
      if (timerRef.current) clearInterval(timerRef.current)
      await recorder.stop()
      const uri = recorder.uri
      setRecordingUri(uri)
      setState('stopped')

      await setAudioModeAsync({
        allowsRecording: false,
        allowsBackgroundRecording: false,
      })
    } catch (err: any) {
      Alert.alert('Error', `Could not stop recording: ${err.message}`)
    }
  }

  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        copyToCacheDirectory: true,
      })
      if (result.canceled) return

      const file = result.assets[0]
      setPickedFile({
        uri: file.uri,
        name: file.name,
        size: file.size ?? 0,
        mimeType: file.mimeType ?? 'audio/mpeg',
      })
      setState('stopped')
      setRecordingUri(null)
    } catch (err: any) {
      Alert.alert('Error', `Could not pick file: ${err.message}`)
    }
  }

  const uploadAndProcess = async () => {
    const uri = pickedFile ? pickedFile.uri : recordingUri
    if (!uri) return

    setState('uploading')
    setStatusMessage('Uploading...')

    try {
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

      const sessionId = `${Date.now()}`
      const ext = pickedFile ? pickedFile.name.split('.').pop() || 'm4a' : 'm4a'
      const fileName = `${session.user.id}/${sessionId}.${ext}`
      const contentType = pickedFile ? pickedFile.mimeType : 'audio/mp4'

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('session-audio')
        .upload(fileName, bytes, {
          contentType,
          upsert: false,
        })

      if (uploadError) throw uploadError

      setStatusMessage('Processing with AI...')
      setState('processing')

      const response = await fetch(`${API_BASE_URL}/api/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          audioPath: uploadData.path,
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
    setPickedFile(null)
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
        {state === 'stopped' && !pickedFile && (
          <Text style={styles.readyText}>Recording saved — ready to upload</Text>
        )}
      </View>

      {/* Idle state: record button + upload option */}
      {state === 'idle' && (
        <>
          <TouchableOpacity style={styles.recordBtn} onPress={startRecording}>
            <Feather name="mic" size={44} color="#fff" style={{ marginBottom: 8 }} />
            <Text style={styles.recordBtnText}>Start Recording</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.uploadFileBtn} onPress={pickFile}>
            <Feather name="upload-cloud" size={20} color="#a78bfa" />
            <Text style={styles.uploadFileBtnText}>Upload a file</Text>
          </TouchableOpacity>
        </>
      )}

      {state === 'recording' && (
        <TouchableOpacity style={[styles.recordBtn, styles.stopBtn]} onPress={stopRecording}>
          <Feather name="square" size={36} color="#fff" style={{ marginBottom: 8 }} />
          <Text style={styles.recordBtnText}>Stop Recording</Text>
        </TouchableOpacity>
      )}

      {state === 'stopped' && (
        <>
          {pickedFile && (
            <View style={styles.fileCard}>
              <Feather name="file" size={20} color="#6c47ff" />
              <View style={{ flex: 1 }}>
                <Text style={styles.fileName} numberOfLines={1}>{pickedFile.name}</Text>
                <Text style={styles.fileSize}>{formatFileSize(pickedFile.size)}</Text>
              </View>
            </View>
          )}
          <View style={styles.actionRow}>
            <TouchableOpacity style={[styles.actionBtn, styles.uploadBtn]} onPress={uploadAndProcess}>
              <Feather name="upload" size={16} color="#fff" />
              <Text style={styles.actionBtnText}>Upload & Process</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.discardBtn]} onPress={reset}>
              <Feather name="trash-2" size={16} color="#fff" />
              <Text style={styles.actionBtnText}>Discard</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {(state === 'uploading' || state === 'processing') && (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#6c47ff" />
          <Text style={styles.loadingText}>{statusMessage}</Text>
        </View>
      )}

      {state === 'done' && (
        <View style={styles.doneBox}>
          <View style={styles.doneIcon}>
            <Feather name="check" size={32} color="#4ade80" />
          </View>
          <Text style={styles.doneText}>{statusMessage}</Text>
          <TouchableOpacity style={styles.recordBtn} onPress={reset}>
            <Text style={styles.recordBtnText}>Record Another</Text>
          </TouchableOpacity>
        </View>
      )}

      {state === 'idle' && (
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>Background recording</Text>
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
    marginTop: 12,
  },
  liveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ff4444',
    marginRight: 8,
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
  },
  stopBtn: {
    backgroundColor: '#ff4444',
    shadowColor: '#ff4444',
  },
  recordBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  uploadFileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 24,
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a4a',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  uploadFileBtnText: {
    color: '#a78bfa',
    fontSize: 14,
    fontWeight: '600',
  },
  fileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 14,
    gap: 12,
    width: '100%',
    marginBottom: 12,
  },
  fileName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  fileSize: {
    color: '#666',
    fontSize: 12,
    marginTop: 2,
  },
  actionRow: {
    flexDirection: 'row',
    marginTop: 8,
    width: '100%',
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 8,
    gap: 8,
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
    marginTop: 24,
  },
  loadingText: {
    color: '#888',
    fontSize: 15,
    marginTop: 16,
  },
  doneBox: {
    alignItems: 'center',
    gap: 16,
  },
  doneIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#0f2318',
    borderWidth: 1,
    borderColor: '#1a3a25',
    alignItems: 'center',
    justifyContent: 'center',
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
  },
  infoTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  infoText: {
    color: '#666',
    fontSize: 13,
    lineHeight: 20,
  },
})
