export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      items: {
        Row: {
          id: string
          title: string
          description: string
          images: string[]
          condition: string
          category: string
          user_id: string
          created_at: string
          location: string
          status: string
          type: string
          latitude?: number
          longitude?: number
        }
        Insert: {
          id?: string
          title: string
          description: string
          images: string[]
          condition: string
          category: string
          user_id: string
          created_at?: string
          location: string
          status?: string
          type: string
          latitude?: number
          longitude?: number
        }
        Update: {
          id?: string
          title?: string
          description?: string
          images?: string[]
          condition?: string
          category?: string
          user_id?: string
          created_at?: string
          location?: string
          status?: string
          type?: string
          latitude?: number
          longitude?: number
        }
      }
      messages: {
        Row: {
          id: string
          sender_id: string
          receiver_id: string
          content: string
          created_at: string
          item_id: string
          offer_item_id?: string
          read: boolean
          is_offer: boolean
          archived: boolean
        }
        Insert: {
          id?: string
          sender_id: string
          receiver_id: string
          content: string
          created_at?: string
          item_id: string
          offer_item_id?: string
          read?: boolean
          is_offer?: boolean
          archived?: boolean
        }
        Update: {
          id?: string
          sender_id?: string
          receiver_id?: string
          content?: string
          created_at?: string
          item_id?: string
          offer_item_id?: string
          read?: boolean
          is_offer?: boolean
          archived?: boolean
        }
      }
      users: {
        Row: {
          id: string
          full_name?: string
          avatar_url?: string
          created_at: string
          gender?: string
          username?: string
          zipcode?: string
          profile_completed: boolean
          rating?: number
        }
        Insert: {
          id: string
          full_name?: string
          avatar_url?: string
          created_at?: string
          gender?: string
          username?: string
          zipcode?: string
          profile_completed?: boolean
          rating?: number
        }
        Update: {
          id?: string
          full_name?: string
          avatar_url?: string
          created_at?: string
          gender?: string
          username?: string
          zipcode?: string
          profile_completed?: boolean
          rating?: number
        }
      }
      friend_requests: {
        Row: {
          id: string
          sender_id: string
          receiver_id: string
          status: 'pending' | 'accepted' | 'declined'
          created_at: string
        }
        Insert: {
          id?: string
          sender_id: string
          receiver_id: string
          status?: 'pending' | 'accepted' | 'declined'
          created_at?: string
        }
        Update: {
          id?: string
          sender_id?: string
          receiver_id?: string
          status?: 'pending' | 'accepted' | 'declined'
          created_at?: string
        }
      }
      friendships: {
        Row: {
          id: string
          user1_id: string
          user2_id: string
          created_at: string
        }
        Insert: {
          id?: string
          user1_id: string
          user2_id: string
          created_at?: string
        }
        Update: {
          id?: string
          user1_id?: string
          user2_id?: string
          created_at?: string
        }
      }
      blocked_users: {
        Row: {
          id: string
          blocker_id: string
          blocked_id: string
          created_at: string
        }
        Insert: {
          id?: string
          blocker_id: string
          blocked_id: string
          created_at?: string
        }
        Update: {
          id?: string
          blocker_id?: string
          blocked_id?: string
          created_at?: string
        }
      }
      reported_messages: {
        Row: {
          id: string
          message_id: string
          reporter_id: string
          reason: string
          created_at: string
        }
        Insert: {
          id?: string
          message_id: string
          reporter_id: string
          reason: string
          created_at?: string
        }
        Update: {
          id?: string
          message_id?: string
          reporter_id?: string
          reason?: string
          created_at?: string
        }
      }
      changelogs: {
        Row: {
          id: string
          title: string
          description: string
          created_at: string
          is_upcoming: boolean
        }
        Insert: {
          id?: string
          title: string
          description: string
          created_at?: string
          is_upcoming?: boolean
        }
        Update: {
          id?: string
          title?: string
          description?: string
          created_at?: string
          is_upcoming?: boolean
        }
      }
      changelog_dismissals: {
        Row: {
          id: string
          user_id: string
          changelog_id: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          changelog_id: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          changelog_id?: string
          created_at?: string
        }
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          sender_id: string | null
          type: string
          content: string
          related_id: string | null
          read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          sender_id?: string | null
          type: string
          content: string
          related_id?: string | null
          read?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          sender_id?: string | null
          type?: string
          content?: string
          related_id?: string | null
          read?: boolean
          created_at?: string
        }
      }
      newsletter_subscribers: {
        Row: {
          id: string
          email: string
          created_at: string
          unsubscribe_token: string
          unsubscribed_at: string | null
          is_unsubscribed: boolean | null
        }
        Insert: {
          id?: string
          email: string
          created_at?: string
          unsubscribe_token?: string
          unsubscribed_at?: string | null
          is_unsubscribed?: boolean | null
        }
        Update: {
          id?: string
          email?: string
          created_at?: string
          unsubscribe_token?: string
          unsubscribed_at?: string | null
          is_unsubscribed?: boolean | null
        }
      }
      watched_items: {
        Row: {
          id: string
          user_id: string
          item_id: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          item_id: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          item_id?: string
          created_at?: string
        }
      }
      reports: {
        Row: {
          id: string
          reporter_id: string
          target_type: 'user' | 'item' | 'message' | 'comment' | 'other'
          target_id: string
          category: string
          description: string | null
          status: 'pending' | 'in_review' | 'resolved' | 'dismissed'
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          reporter_id: string
          target_type: 'user' | 'item' | 'message' | 'comment' | 'other'
          target_id: string
          category: string
          description?: string | null
          status?: 'pending' | 'in_review' | 'resolved' | 'dismissed'
          metadata?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          reporter_id?: string
          target_type?: 'user' | 'item' | 'message' | 'comment' | 'other'
          target_id?: string
          category?: string
          description?: string | null
          status?: 'pending' | 'in_review' | 'resolved' | 'dismissed'
          metadata?: Json | null
          created_at?: string
        }
      }
      moderation_policies: {
        Row: {
          id: string
          version: number
          title: string
          content: string
          published_at: string
          require_reaccept_after: string | null
        }
        Insert: {
          id?: string
          version: number
          title: string
          content: string
          published_at?: string
          require_reaccept_after?: string | null
        }
        Update: {
          id?: string
          version?: number
          title?: string
          content?: string
          published_at?: string
          require_reaccept_after?: string | null
        }
      }
      user_policy_acceptances: {
        Row: {
          id: string
          user_id: string
          policy_id: string
          platform: string | null
          accepted_at: string
        }
        Insert: {
          id?: string
          user_id: string
          policy_id: string
          platform?: string | null
          accepted_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          policy_id?: string
          platform?: string | null
          accepted_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}