import { Database } from './types/supabase';

export interface User {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  created_at: string;
}

export interface Item {
  id: string;
  title: string;
  description: string;
  images: string[];
  condition: 'new' | 'like-new' | 'good' | 'fair' | 'poor';
  category: string;
  user_id: string;
  created_at: string;
  location: string;
  status: 'available' | 'pending' | 'traded' | 'claimed';
  type: 'free' | 'barter';
  latitude?: number;
  longitude?: number;
}

export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  item_id: string | null; // Made nullable for direct messages
  thread_id?: string | null;
  offer_item_id?: string;
  read: boolean;
  is_offer: boolean;
  archived: boolean;
  image_url?: string;
}

export interface Conversation {
  id: string;
  type: 'item' | 'direct_message' | 'unified'; // Added unified type
  item_id: string | null; // Made nullable for direct messages and unified conversations
  item_title: string | null; // Made nullable for direct messages and unified conversations
  item_image: string | null; // Made nullable for direct messages and unified conversations
  recent_item_title?: string | null; // For unified conversations - most recent item discussed
  recent_item_image?: string | null; // For unified conversations - most recent item image
  other_user_id: string;
  other_user_name: string;
  other_user_avatar: string | null;
  last_message: string;
  last_message_time: string;
  unread_count: number;
  offer_item_id?: string | null; // Made nullable for direct messages
  offer_item_title?: string | null; // Made nullable for direct messages
  offer_item_image?: string | null; // Made nullable for direct messages
  has_offer: boolean;
  archived?: boolean;
}

// New friend-related interfaces
export interface FriendRequest {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
}

export interface Friendship {
  id: string;
  user1_id: string;
  user2_id: string;
  created_at: string;
}

export interface FriendRequestWithUser extends FriendRequest {
  sender?: {
    id: string;
    username: string;
    avatar_url: string | null;
  };
  receiver?: {
    id: string;
    username: string;
    avatar_url: string | null;
  };
}

export interface FriendshipWithUser extends Friendship {
  friend?: {
    id: string;
    username: string;
    avatar_url: string | null;
    rating: number | null;
  };
}

export type FriendshipStatus = 
  | 'none' 
  | 'pending_sent' 
  | 'pending_received' 
  | 'friends';

// New notification interfaces
export interface Notification {
  id: string;
  user_id: string;
  sender_id?: string;
  type: 'friend_request' | 'friend_request_approved' | 'new_listing' | 'direct_message' | 'watchlist_update' | 'system_alerts';
  content: string;
  related_id?: string;
  read: boolean;
  created_at: string;
  sender?: {
    id: string;
    username: string;
    avatar_url: string | null;
  };
}