import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Slot, useRouter, usePathname } from 'expo-router'
import { Feather } from '@expo/vector-icons'

type Tab = {
  label: string
  icon: keyof typeof Feather.glyphMap
  path: string
}

const TABS: Tab[] = [
  { label: 'Sessions', icon: 'list', path: '/sessions' },
  { label: 'Record', icon: 'mic', path: '/record' },
  { label: 'Journal', icon: 'book-open', path: '/journal' },
  { label: 'Chat', icon: 'message-circle', path: '/chat' },
  { label: 'Settings', icon: 'settings', path: '/settings' },
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
          const isActive = pathname === tab.path || pathname.startsWith(tab.path + '/')
          return (
            <TouchableOpacity
              key={tab.label}
              style={styles.tab}
              onPress={() => router.push(tab.path as any)}
            >
              <Feather
                name={tab.icon}
                size={22}
                color={isActive ? '#6c47ff' : '#555'}
              />
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
    gap: 4,
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
