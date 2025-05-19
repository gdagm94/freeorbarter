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