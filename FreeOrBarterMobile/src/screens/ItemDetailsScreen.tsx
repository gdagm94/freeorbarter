import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Image,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Item } from '../types';

export default function ItemDetailsScreen() {
  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const { itemId } = route.params || {};

  useEffect(() => {
    if (itemId) {
      fetchItem();
    }
  }, [itemId]);

  const fetchItem = async () => {
    try {
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .eq('id', itemId)
        .single();

      if (error) {
        console.error('Error fetching item:', error);
        Alert.alert('Error', 'Failed to load item details');
        return;
      }

      setItem(data);
    } catch (error) {
      console.error('Error fetching item:', error);
      Alert.alert('Error', 'Failed to load item details');
    } finally {
      setLoading(false);
    }
  };

  const handleMessage = () => {
    if (!user) {
      Alert.alert('Error', 'Please sign in to message the seller');
      return;
    }

    if (!item) {
      Alert.alert('Error', 'Item not found');
      return;
    }

    // Navigate to chat with the seller
    navigation.navigate('Chat', { 
      itemId: item.id,
      sellerId: item.user_id,
      conversationId: undefined // Will be created if it doesn't exist
    });
  };

  const handleBarterOffer = () => {
    if (!user) {
      Alert.alert('Error', 'Please sign in to make a barter offer');
      return;
    }

    if (!item) {
      Alert.alert('Error', 'Item not found');
      return;
    }

    // Navigate to barter offer screen
    navigation.navigate('BarterOffer', { itemId: item.id });
  };

  const handleWatchItem = async () => {
    if (!user) {
      Alert.alert('Error', 'Please sign in to watch items');
      return;
    }

    try {
      const { error } = await supabase
        .from('watched_items')
        .insert([{
          user_id: user.id,
          item_id: itemId,
        }]);

      if (error) {
        if (error.code === '23505') { // Unique constraint violation
          Alert.alert('Info', 'Item is already in your watchlist');
        } else {
          console.error('Error watching item:', error);
          Alert.alert('Error', 'Failed to add item to watchlist');
        }
        return;
      }

      Alert.alert('Success', 'Item added to your watchlist');
    } catch (error) {
      console.error('Error watching item:', error);
      Alert.alert('Error', 'Failed to add item to watchlist');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Loading...</Text>
      </View>
    );
  }

  if (!item) {
    return (
      <View style={styles.errorContainer}>
        <Text>Item not found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.imageContainer}>
        {item.images && item.images.length > 0 ? (
          <Image source={{ uri: item.images[0] }} style={styles.image} />
        ) : (
          <View style={styles.placeholderImage}>
            <Text style={styles.placeholderText}>No Image</Text>
          </View>
        )}
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.description}>{item.description}</Text>

        <View style={styles.details}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Type:</Text>
            <Text style={styles.detailValue}>{item.type.toUpperCase()}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Condition:</Text>
            <Text style={styles.detailValue}>{item.condition.replace('-', ' ').toUpperCase()}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Location:</Text>
            <Text style={styles.detailValue}>{item.location}</Text>
          </View>
        </View>

        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.messageButton} onPress={handleMessage}>
            <Text style={styles.messageButtonText}>Message Seller</Text>
          </TouchableOpacity>
          
          {item.type === 'barter' && (
            <TouchableOpacity style={styles.barterButton} onPress={handleBarterOffer}>
              <Text style={styles.barterButtonText}>Make Barter Offer</Text>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity style={styles.watchButton} onPress={handleWatchItem}>
            <Text style={styles.watchButtonText}>Watch Item</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageContainer: {
    width: '100%',
    height: 300,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#9CA3AF',
    fontSize: 16,
  },
  content: {
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    color: '#6B7280',
    lineHeight: 24,
    marginBottom: 24,
  },
  details: {
    marginBottom: 24,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  detailLabel: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 16,
    color: '#1F2937',
    fontWeight: '600',
  },
  actionButtons: {
    gap: 12,
  },
  messageButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  messageButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  barterButton: {
    backgroundColor: '#F59E0B',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  barterButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  watchButton: {
    backgroundColor: '#10B981',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  watchButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
