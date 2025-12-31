import React from 'react';
import { View, Text, StyleSheet, Platform, Alert, LogBox } from 'react-native'; // <--- Added LogBox here
import { NavigationContainer } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { useEffect, useState, useRef } from 'react';
import Constants from 'expo-constants';
import { supabase } from './src/lib/supabase';

// ... (Keep all your screen imports exactly as they were) ...
import HomeScreen from './src/screens/HomeScreen';
import ItemDetailsScreen from './src/screens/ItemDetailsScreen';
import MessagesScreen from './src/screens/MessagesScreen';
import ChatScreen from './src/screens/ChatScreen';
import NewListingScreen from './src/screens/NewListingScreen';
import EditListingScreen from './src/screens/EditListingScreen';
import ManageListingScreen from './src/screens/ManageListingScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import BarterOfferScreen from './src/screens/BarterOfferScreen';
import AuthScreen from './src/screens/AuthScreen';
import WatchedItemsScreen from './src/screens/WatchedItemsScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import FriendsScreen from './src/screens/FriendsScreen';
import UserProfileScreen from './src/screens/UserProfileScreen';
import SearchUsersScreen from './src/screens/SearchUsersScreen';
import AboutScreen from './src/screens/AboutScreen';
import TermsScreen from './src/screens/TermsScreen';
import PrivacyScreen from './src/screens/PrivacyScreen';
import ModeratorDashboardScreen from './src/screens/ModeratorDashboardScreen';

import { useAuth } from './src/hooks/useAuth';
import { fetchLatestPolicy, acceptPolicy, PolicyStatus } from './src/lib/policy';
import { PolicyAcceptanceModal } from './src/components/PolicyAcceptanceModal';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

const getExpoProjectId = () =>
  // Expo Go / dev client uses expoConfig; EAS runtime exposes easConfig
  Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

const registerForPushNotifications = async (userId?: string) => {
  try {
    const projectId = getExpoProjectId();
    if (!projectId) {
      console.warn('Push registration: missing projectId (check EAS config)');
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
          allowCriticalAlerts: true,
        },
      });
      finalStatus = status;
    }

    if (finalStatus !== 'granted') return;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        sound: 'default',
        enableVibrate: true,
        showBadge: true,
        vibrationPattern: [0, 250, 250, 250],
      });
    }

    const pushToken = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );

    if (userId && pushToken?.data) {
      await supabase.from('user_push_tokens').upsert({
        user_id: userId,
        push_token: pushToken.data,
        platform: Platform.OS,
        app_version: Constants.expoConfig?.version ?? 'unknown',
        last_seen_at: new Date().toISOString(),
      });
      console.log('Push token stored', { platform: Platform.OS, projectId });
    } else {
      console.warn('Push registration skipped: missing userId or token');
    }
  } catch (error) {
    console.warn('Failed to register for push notifications', error);
  }
};

// ... (Keep Placeholder function and Tabs function exactly as they were) ...
function Placeholder({ title }: { title: string }) {
  return (
    <View style={styles.placeholderContainer}>
      <Text style={styles.placeholderText}>{title}</Text>
    </View>
  );
}

function Tabs() {
    // ... (Keep existing Tabs code exactly the same) ...
    // Note: I am omitting the full Tabs code here to save space, 
    // simply KEEP your existing Tabs function.
    const { user } = useAuth();
    const [messageBadge, setMessageBadge] = useState<number | undefined>(undefined);
    const [notificationBadge, setNotificationBadge] = useState<number | undefined>(undefined);
    const [policyStatus, setPolicyStatus] = useState<PolicyStatus | null>(null);
    const [policyLoading, setPolicyLoading] = useState(false);
  
    useEffect(() => {
      if (!user) {
        setMessageBadge(undefined);
        setNotificationBadge(undefined);
        setPolicyStatus(null);
        if (Platform.OS === 'ios') {
          Notifications.setBadgeCountAsync(0).catch(() => {});
        }
        return;
      }
  
      let isMounted = true;
  
      const loadCounts = async () => {
        try {
          const { count: msgCount } = await supabase
            .from('messages')
            .select('id', { count: 'exact', head: true })
            .eq('receiver_id', user.id)
            .eq('read', false);
  
          const { count: notifCount } = await supabase
            .from('notifications')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('read', false);
  
          if (!isMounted) return;
          setMessageBadge(msgCount && msgCount > 0 ? msgCount : undefined);
          setNotificationBadge(notifCount && notifCount > 0 ? notifCount : undefined);
          const totalBadge = notifCount ?? 0; // App icon badge should reflect notifications only
          if (Platform.OS === 'ios') {
            Notifications.setBadgeCountAsync(totalBadge).catch(() => {});
          }
        } catch (error) {
          console.error('Error fetching badge counts:', error);
        }
      };
  
      // Initial fetch
      loadCounts();
  
      // Supabase realtime channels for badge updates
      const messagesChannel = supabase
        .channel(`messages-badges-${user.id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'messages', filter: `receiver_id=eq.${user.id}` },
          () => loadCounts()
        )
        .subscribe();
  
      const notificationsChannel = supabase
        .channel(`notifications-badges-${user.id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
          () => loadCounts()
        )
        .subscribe();
  
      // Lightweight fallback polling to guard against missed events
      const fallbackInterval = setInterval(loadCounts, 60000);
  
      return () => {
        isMounted = false;
        messagesChannel.unsubscribe();
        notificationsChannel.unsubscribe();
        clearInterval(fallbackInterval);
      };
    }, [user?.id]);
  
    useEffect(() => {
      let isMounted = true;
      const loadPolicyStatus = async () => {
        if (!user) return;
        try {
          setPolicyLoading(true);
          const status = await fetchLatestPolicy();
          if (isMounted) {
            setPolicyStatus(status);
          }
        } catch (error) {
          console.error('Failed to load policy status', error);
        } finally {
          if (isMounted) {
            setPolicyLoading(false);
          }
        }
      };
  
      loadPolicyStatus();
      return () => {
        isMounted = false;
      };
    }, [user?.id]);
  
    const handlePolicyAccepted = async () => {
      if (!policyStatus?.policy) return;
      try {
        setPolicyLoading(true);
        await acceptPolicy(policyStatus.policy.id, Platform.OS === 'ios' ? 'ios' : 'android');
        const refreshed = await fetchLatestPolicy();
        setPolicyStatus(refreshed);
      } catch (error) {
        console.error('Failed to accept policy', error);
        Alert.alert('Error', 'Unable to record your acceptance. Please try again.');
      } finally {
        setPolicyLoading(false);
      }
    };
  
    return (
      <>
      <Tab.Navigator 
        screenOptions={{ 
          headerShown: false,
          tabBarStyle: {
            backgroundColor: '#FFFFFF',
            borderTopWidth: 1,
            borderTopColor: '#E2E8F0',
            paddingBottom: 8,
            paddingTop: 8,
            height: 88,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            elevation: 8,
          },
          tabBarActiveTintColor: '#3B82F6',
          tabBarInactiveTintColor: '#94A3B8',
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '600',
            marginTop: 4,
          },
        }}
      >
        <Tab.Screen 
          name="Home" 
          component={HomeScreen}
          options={{
            tabBarIcon: ({ focused }) => (
              <Text style={{ fontSize: 20 }}>{focused ? '🏠' : '🏡'}</Text>
            ),
          }}
        />
        <Tab.Screen 
          name="Messages" 
          component={user ? MessagesScreen : AuthScreen} 
          options={{ 
            tabBarBadge: messageBadge,
            tabBarIcon: ({ focused }) => (
              <Text style={{ fontSize: 20 }}>{focused ? '💬' : '💭'}</Text>
            ),
          }} 
        />
        <Tab.Screen 
          name="NewListing" 
          options={{ 
            title: 'New',
            tabBarIcon: ({ focused }) => (
              <View style={{
                backgroundColor: focused ? '#3B82F6' : '#E2E8F0',
                borderRadius: 20,
                width: 40,
                height: 40,
                justifyContent: 'center',
                alignItems: 'center',
              }}>
                <Text style={{ 
                  fontSize: 20, 
                  color: focused ? '#FFFFFF' : '#64748B' 
                }}>
                  ➕
                </Text>
              </View>
            ),
          }} 
          component={user ? NewListingScreen : AuthScreen} 
        />
        <Tab.Screen 
          name="Notifications" 
          component={user ? NotificationsScreen : AuthScreen} 
          options={{ 
            tabBarBadge: notificationBadge,
            tabBarIcon: ({ focused }) => (
              <Text style={{ fontSize: 20 }}>{focused ? '🔔' : '🔕'}</Text>
            ),
          }} 
        />
        <Tab.Screen 
          name="Profile" 
          component={user ? ProfileScreen : AuthScreen}
          options={{
            tabBarIcon: ({ focused }) => (
              <Text style={{ fontSize: 20 }}>{focused ? '👤' : '👥'}</Text>
            ),
          }}
        />
      </Tab.Navigator>
      {user && policyStatus?.policy && !policyStatus.accepted && (
        <PolicyAcceptanceModal
          visible
          title={policyStatus.policy.title}
          content={policyStatus.policy.content}
          loading={policyLoading}
          disabled={policyLoading}
          onAccept={handlePolicyAccepted}
          onReject={() => supabase.auth.signOut()}
        />
      )}
      </>
    );
}

export default function App() {
  const { loading, user } = useAuth();
  const navRef = useRef<any>(null);

  // --- NEW: Handle LogBox warnings safely here ---
  useEffect(() => {
    LogBox.ignoreLogs([
      'Expo AV has been deprecated',
      'The app is running using the Legacy Architecture',
    ]);
  }, []);
  // ----------------------------------------------

  // Deep linking config
  const linking = {
    prefixes: [Linking.createURL('/'), 'freeorbarter://'],
    config: {
      screens: {
        Tabs: {
          screens: {
            Home: '',
            Messages: 'messages',
            NewListing: 'new',
            Notifications: 'notifications',
            Profile: 'profile',
          },
        },
        ItemDetails: 'item/:itemId',
        Chat: 'chat/:otherUserId',
        BarterOffer: 'barter/:itemId',
        Friends: 'friends',
        UserProfile: 'user/:userId',
        SearchUsers: 'search-users',
        About: 'about',
        Terms: 'terms',
        Privacy: 'privacy',
      },
    },
  };

  useEffect(() => {
    // Notifications handler behavior
    Notifications.setNotificationHandler({
      handleNotification: async () => ({ 
        shouldShowAlert: true, 
        shouldPlaySound: true, 
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
        priority: Notifications.AndroidNotificationPriority.MAX,
      }),
    });
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    registerForPushNotifications(user.id);
  }, [user?.id]);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      try {
        const data: any = response.notification.request.content.data || {};
        if (data.type === 'direct_message' && data.sender_id) {
          navRef.current?.navigate('Chat', { otherUserId: data.sender_id, itemId: data.item_id || null });
        } else if (data.item_id) {
          navRef.current?.navigate('ItemDetails', { itemId: data.item_id });
        }
      } catch {}
    });
    return () => sub.remove();
  }, []);

  if (loading) {
    return <Placeholder title="Loading..." />;
  }

  return (
    <NavigationContainer linking={linking as any} ref={navRef}>
      <StatusBar style="auto" />
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Tabs" component={Tabs} />
        <Stack.Screen name="ItemDetails" component={ItemDetailsScreen} />
        <Stack.Screen name="EditListing" component={EditListingScreen} />
        <Stack.Screen name="ManageListing" component={ManageListingScreen} />
        <Stack.Screen name="Chat" component={ChatScreen} />
        <Stack.Screen name="BarterOffer" component={BarterOfferScreen} />
        <Stack.Screen name="NewListing" component={NewListingScreen} />
        <Stack.Screen name="Auth" component={AuthScreen} />
        <Stack.Screen name="WatchedItems" component={WatchedItemsScreen} />
        <Stack.Screen name="History" component={HistoryScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="Friends" component={FriendsScreen} />
        <Stack.Screen name="UserProfile" component={UserProfileScreen} />
        <Stack.Screen name="SearchUsers" component={SearchUsersScreen} />
        <Stack.Screen name="About" component={AboutScreen} />
        <Stack.Screen name="Terms" component={TermsScreen} />
        <Stack.Screen name="Privacy" component={PrivacyScreen} />
        <Stack.Screen name="ModeratorDashboard" component={ModeratorDashboardScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  placeholderContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  placeholderText: {
    fontSize: 18,
    color: '#64748B',
    fontWeight: '500',
  },
});