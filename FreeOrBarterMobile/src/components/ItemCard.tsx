import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Dimensions,
} from 'react-native';
import { Item } from '../types';

interface ItemCardProps {
  item: Item;
  onPress: () => void;
}

const { width } = Dimensions.get('window');
const cardWidth = (width - 48) / 2; // Account for padding and gap

export default function ItemCard({ item, onPress }: ItemCardProps) {
  const getConditionColor = (condition: string) => {
    switch (condition) {
      case 'new':
        return '#10B981';
      case 'like-new':
        return '#3B82F6';
      case 'good':
        return '#F59E0B';
      case 'fair':
        return '#F97316';
      case 'poor':
        return '#EF4444';
      default:
        return '#6B7280';
    }
  };

  const getTypeColor = (type: string) => {
    return type === 'free' ? '#10B981' : '#8B5CF6';
  };

  const getStatusDisplay = () => {
    if (item.status === 'claimed') return { text: 'CLAIMED', color: '#6B7280' };
    if (item.status === 'traded') return { text: 'TRADED', color: '#6B7280' };
    if (item.status === 'pending') return { text: 'PENDING', color: '#F59E0B' };
    return null;
  };

  const statusInfo = getStatusDisplay();

  return (
    <TouchableOpacity 
      style={[styles.card, { width: cardWidth }]} 
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.imageContainer}>
        {item.images && item.images.length > 0 ? (
          <Image 
            source={{ uri: item.images[0] }} 
            style={styles.image}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.placeholderImage}>
            <Text style={styles.placeholderText}>📷</Text>
          </View>
        )}
        
        {/* Status overlay for unavailable items */}
        {statusInfo && (
          <View style={styles.statusOverlay}>
            <View style={[styles.statusBadge, { backgroundColor: statusInfo.color }]}>
              <Text style={styles.statusText}>{statusInfo.text}</Text>
            </View>
          </View>
        )}
        
        {/* Type badge */}
        <View style={styles.badgeContainer}>
          <View style={[styles.typeBadge, { backgroundColor: getTypeColor(item.type) }]}>
            <Text style={styles.badgeText}>
              {item.type === 'free' ? '🎁 FREE' : '🔄 BARTER'}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={2}>
          {item.title}
        </Text>
        
        <View style={styles.metaRow}>
          <View style={[styles.conditionBadge, { backgroundColor: getConditionColor(item.condition) }]}>
            <Text style={styles.conditionText}>
              {item.condition.replace('-', ' ').toUpperCase()}
            </Text>
          </View>
        </View>
        
        <Text style={styles.location} numberOfLines={1}>
          📍 {item.location}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
    overflow: 'hidden',
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    height: cardWidth * 0.75,
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
    fontSize: 32,
  },
  statusOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  badgeContainer: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  content: {
    padding: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
    lineHeight: 20,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  conditionBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  conditionText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: 'bold',
  },
  location: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
});