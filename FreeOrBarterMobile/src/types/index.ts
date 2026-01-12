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
  thread_id?: string;
  offer_item_id?: string;
  read: boolean;
  is_offer: boolean;
  archived: boolean;
  image_url?: string;
  topic?: 'item' | 'direct';
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
  archived?: boolean;
  deleted?: boolean;
  silenced?: boolean;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'message' | 'offer' | 'system';
  read: boolean;
  created_at: string;
  item_id?: string;
  sender_id?: string;
}

// Friend-related interfaces
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