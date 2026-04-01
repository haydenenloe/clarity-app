import { Tabs } from 'expo-router'
import { View, Text } from 'react-native'

function TabIcon({ emoji, label, focused }: { emoji: string; label: string; focused: boolean }) {
  return (
    <View style={{ alignItems: 'center', gap: 2 }}>
      <Text style={{ fontSize: 22 }}>{emoji}</Text>
      <Text style={{ fontSize: 10, color: focused ? '#6c47ff' : '#666' }}>{label}</Text>
    </View>
  )
}

export default function AppLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0a0a0a',
          borderTopColor: '#1a1a1a',
          height: 80,
          paddingBottom: 12,
        },
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="record"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="🎙️" label="Record" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="sessions/index"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="📋" label="Sessions" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="sessions/[id]"
        options={{
          tabBarButton: () => null, // hide from tab bar
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="💬" label="Chat" focused={focused} />
          ),
        }}
      />
    </Tabs>
  )
}
