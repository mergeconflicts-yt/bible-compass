import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/useTheme';

/**
 * Primary navigation — demo/design-spec.html tab bar, approved by the owner
 * as the implementation visual (deviates from DESIGN_SPEC.md §2, which
 * specifies three tabs). Home, Bible, Search, Saved are routes; Settings
 * renders full-screen rather than as a sheet-over-tab, which has no
 * faithful native equivalent. Every visible destination is real.
 */
export default function TabLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          height: 64,
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={size ?? 24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="bible"
        options={{
          title: 'Bible',
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons name={focused ? 'book' : 'book-outline'} size={size ?? 24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="saved"
        options={{
          title: 'Saved',
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons
              name={focused ? 'bookmark' : 'bookmark-outline'}
              size={size ?? 24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons
              name={focused ? 'search' : 'search-outline'}
              size={size ?? 24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons
              name={focused ? 'settings' : 'settings-outline'}
              size={size ?? 24}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}
