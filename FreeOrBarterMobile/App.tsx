import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { useEffect, useState } from 'react';
import { supabase } from './src/lib/supabase';

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
import { useAuth } from './src/hooks/useAuth';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

function Placeholder({ title }: { title: string }) {
  return (
    <View style={styles.placeholderContainer}>
      <Text style={styles.placeholderText}>{title}</Text>
    </View>
  );
}

function Tabs() {
  const { user } = useAuth();
  const [messageBadge, setMessageBadge] = useState<number | undefined>(undefined);
  const [notificationBadge, setNotificationBadge] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (!user) {
      setMessageBadge(undefined);
      setNotificationBadge(undefined);
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
      } catch {}
    };
    loadCounts();
    const interval = setInterval(loadCounts, 15000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [user?.id]);

  return (
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
  );
}

export default function App() {
  const { loading } = useAuth();
  const navRef = React.useRef<any>(null);

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
        shouldPlaySound: false, 
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      }),
    });
  }, []);

  useEffect(() => {
    const register = async () => {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') return;
      await Notifications.getExpoPushTokenAsync();
    };
    register();
  }, []);

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