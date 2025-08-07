import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Image,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Item } from '../types';

export default function BarterOfferScreen() {
  const [targetItem, setTargetItem] = useState<Item | null>(null);
  const [userItems, setUserItems] = useState<Item[]>([]);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { user } = useAuth();
  const { itemId } = route.params || {};

  useEffect(() => {
    if (itemId) {
      fetchData();
    }
  }, [itemId]);

  const fetchData = async () => {
    try {
      // Fetch target item
      const { data: targetData, error: targetError } = await supabase
        .from('items')
        .select('*')
        .eq('id', itemId)
        .single();

      if (targetError) {
        console.error('Error fetching target item:', targetError);
        return;
      }

      setTargetItem(targetData);

      // Fetch user's items for barter
      if (user) {
        const { data: userData, error: userError } = await supabase
          .from('items')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'available');

        if (userError) {
          console.error('Error fetching user items:', userError);
          return;
        }

        setUserItems(userData || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitOffer = async () => {
    if (!selectedItem || !message.trim() || !user || !targetItem) {
      Alert.alert('Error', 'Please select an item and add a message');
      return;
    }

    try {
      const { error } = await supabase
        .from('barter_offers')
        .insert([{
          sender_id: user.id,
          receiver_id: targetItem.user_id,
          offered_item_id: selectedItem,
          requested_item_id: itemId,
          message: message.trim(),
          status: 'pending',
        }]);

      if (error) {
        console.error('Error creating barter offer:', error);
        Alert.alert('Error', 'Failed to submit barter offer');
        return;
      }

      Alert.alert('Success', 'Barter offer submitted successfully', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      console.error('Error submitting barter offer:', error);
      Alert.alert('Error', 'Failed to submit barter offer');
    }
  };

  const renderUserItem = ({ item }: { item: Item }) => (
    <TouchableOpacity
      style={[
        styles.itemCard,
        selectedItem === item.id && styles.selectedItemCard
      ]}
      onPress={() => setSelectedItem(item.id)}
    >
      {item.images && item.images.length > 0 ? (
        <Image source={{ uri: item.images[0] }} style={styles.itemImage} />
      ) : (
        <View style={styles.placeholderImage}>
          <Text style={styles.placeholderText}>No Image</Text>
        </View>
      )}
      <View style={styles.itemContent}>
        <Text style={styles.itemTitle}>{item.title}</Text>
        <Text style={styles.itemDescription} numberOfLines={2}>
          {item.description}
        </Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Make Barter Offer</Text>
        </View>
        <View style={styles.content}>
          <Text>Loading...</Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Make Barter Offer</Text>
      </View>

      <View style={styles.content}>
        {targetItem && (
          <View style={styles.targetItemSection}>
            <Text style={styles.sectionTitle}>You want to trade for:</Text>
            <View style={styles.targetItemCard}>
              {targetItem.images && targetItem.images.length > 0 ? (
                <Image source={{ uri: targetItem.images[0] }} style={styles.targetItemImage} />
              ) : (
                <View style={styles.placeholderImage}>
                  <Text style={styles.placeholderText}>No Image</Text>
                </View>
              )}
              <View style={styles.targetItemContent}>
                <Text style={styles.targetItemTitle}>{targetItem.title}</Text>
                <Text style={styles.targetItemDescription}>{targetItem.description}</Text>
              </View>
            </View>
          </View>
        )}

        <View style={styles.offerSection}>
          <Text style={styles.sectionTitle}>Select your item to offer:</Text>
          {userItems.length > 0 ? (
            userItems.map(item => (
              <View key={item.id}>
                {renderUserItem({ item })}
              </View>
            ))
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>You don't have any items to offer</Text>
              <TouchableOpacity 
                style={styles.addItemButton}
                onPress={() => navigation.navigate('NewListing')}
              >
                <Text style={styles.addItemButtonText}>Add an Item</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.messageSection}>
          <Text style={styles.sectionTitle}>Message to seller:</Text>
          <TextInput
            style={styles.messageInput}
            value={message}
            onChangeText={setMessage}
            placeholder="Explain why you want to trade..."
            multiline
            numberOfLines={4}
          />
        </View>

        <TouchableOpacity 
          style={[
            styles.submitButton,
            (!selectedItem || !message.trim()) && styles.disabledButton
          ]}
          onPress={handleSubmitOffer}
          disabled={!selectedItem || !message.trim()}
        >
          <Text style={styles.submitButtonText}>Submit Barter Offer</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    fontSize: 16,
    color: '#3B82F6',
    marginRight: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  content: {
    padding: 16,
  },
  targetItemSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  targetItemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  targetItemImage: {
    width: 60,
    height: 60,
    borderRadius: 6,
    marginRight: 12,
  },
  targetItemContent: {
    flex: 1,
  },
  targetItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  targetItemDescription: {
    fontSize: 14,
    color: '#6B7280',
  },
  offerSection: {
    marginBottom: 24,
  },
  itemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  selectedItemCard: {
    borderWidth: 2,
    borderColor: '#3B82F6',
  },
  itemImage: {
    width: 60,
    height: 60,
    borderRadius: 6,
    marginRight: 12,
  },
  placeholderImage: {
    width: 60,
    height: 60,
    borderRadius: 6,
    marginRight: 12,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  itemContent: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  itemDescription: {
    fontSize: 14,
    color: '#6B7280',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 12,
  },
  addItemButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  addItemButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  messageSection: {
    marginBottom: 24,
  },
  messageInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  submitButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#9CA3AF',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
