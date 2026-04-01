import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Slot, useRouter, usePathname } from 'expo-router'

const TABS = [
  { label: 'Record', emoji: '🎙️', path: '/record' },
  { label: 'Sessions', emoji: '📋', path: '/sessions' },
  { label: 'Chat', emoji: '💬', path: '/chat' },
]

export default function AppLayout() {
  const router = useRouter()
  const pathname = usePathname()

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Slot />
      </View>
      <View style={styles.tabBar}>
        {TABS.map((tab) => {
          const isActive = pathname.includes(tab.path.replace('/', ''))
          return (
            <TouchableOpacity
              key={tab.label}
              style={styles.tab}
              onPress={() => router.push(tab.path as any)}
            >
              <Text style={styles.emoji}>{tab.emoji}</Text>
              <Text style={[styles.label, isActive && styles.labelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  content: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#0a0a0a',
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
    paddingBottom: 28,
    paddingTop: 10,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
  },
  emoji: {
    fontSize: 22,
    marginBottom: 2,
  },
  label: {
    fontSize: 10,
    color: '#555',
    fontWeight: '500',
  },
  labelActive: {
    color: '#6c47ff',
  },
})
