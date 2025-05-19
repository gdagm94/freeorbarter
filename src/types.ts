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
}

export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  item_id: string;
  offer_item_id?: string;
  read: boolean;
  is_offer: boolean;
}

export interface Conversation {
  id: string;
  item_id: string;
  item_title: string;
  item_image: string;
  other_user_id: string;
  other_user_name: string;
  other_user_avatar: string | null;
  last_message: string;
  last_message_time: string;
  unread_count: number;
  offer_item_id?: string;
  offer_item_title?: string;
  offer_item_image?: string;
  has_offer: boolean;
}