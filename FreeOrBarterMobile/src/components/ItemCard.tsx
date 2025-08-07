import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
} from 'react-native';
import { Item } from '../types';

interface ItemCardProps {
  item: Item;
  onPress: () => void;
}

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
    return type === 'free' ? '#10B981' : '#F59E0B';
  };

  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <View style={styles.imageContainer}>
        {item.images && item.images.length > 0 ? (
          <Image 
            source={{ uri: item.images[0] }} 
            style={styles.image}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.placeholderImage}>
            <Text style={styles.placeholderText}>No Image</Text>
          </View>
        )}
        <View style={styles.badgeContainer}>
          <View
            style={[
              styles.badge,
              { backgroundColor: getTypeColor(item.type) },
            ]}
          >
            <Text style={styles.badgeText}>{item.type.toUpperCase()}</Text>
          </View>
        </View>
      </View>

      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={styles.description} numberOfLines={2}>
          {item.description}
        </Text>

        <View style={styles.footer}>
          <View
            style={[
              styles.conditionBadge,
              { backgroundColor: getConditionColor(item.condition) },
            ]}
          >
            <Text style={styles.conditionText}>
              {item.condition.replace('-', ' ').toUpperCase()}
            </Text>
          </View>
          <Text style={styles.location}>{item.location}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  imageContainer: {
    position: 'relative',
  },
  image: {
    width: '100%',
    height: 200,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  placeholderImage: {
    width: '100%',
    height: 200,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  placeholderText: {
    color: '#9CA3AF',
    fontSize: 16,
  },
  badgeContainer: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  content: {
    padding: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
    lineHeight: 20,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  conditionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  conditionText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  location: {
    fontSize: 12,
    color: '#9CA3AF',
  },
});
