export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      account_deletion_audit: {
        Row: {
          deleted_at: string
          email: string | null
          id: string
          metadata: Json
          user_id: string
        }
        Insert: {
          deleted_at?: string
          email?: string | null
          id?: string
          metadata?: Json
          user_id: string
        }
        Update: {
          deleted_at?: string
          email?: string | null
          id?: string
          metadata?: Json
          user_id?: string
        }
        Relationships: []
      }
      barter_offers: {
        Row: {
          created_at: string | null
          expiration_date: string | null
          id: string
          message: string
          offered_item_id: string
          parent_offer_id: string | null
          receiver_id: string
          requested_item_id: string
          sender_id: string
          status: string
          template_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          expiration_date?: string | null
          id?: string
          message: string
          offered_item_id: string
          parent_offer_id?: string | null
          receiver_id: string
          requested_item_id: string
          sender_id: string
          status?: string
          template_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          expiration_date?: string | null
          id?: string
          message?: string
          offered_item_id?: string
          parent_offer_id?: string | null
          receiver_id?: string
          requested_item_id?: string
          sender_id?: string
          status?: string
          template_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "barter_offers_offered_item_id_fkey"
            columns: ["offered_item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "barter_offers_parent_offer_id_fkey"
            columns: ["parent_offer_id"]
            isOneToOne: false
            referencedRelation: "barter_offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "barter_offers_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "barter_offers_requested_item_id_fkey"
            columns: ["requested_item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "barter_offers_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      blocked_keywords: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          keyword: string
          pattern_type: Database["public"]["Enums"]["pattern_type"]
          severity: Database["public"]["Enums"]["filter_severity"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          keyword: string
          pattern_type?: Database["public"]["Enums"]["pattern_type"]
          severity?: Database["public"]["Enums"]["filter_severity"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          keyword?: string
          pattern_type?: Database["public"]["Enums"]["pattern_type"]
          severity?: Database["public"]["Enums"]["filter_severity"]
          updated_at?: string
        }
        Relationships: []
      }
      blocked_users: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string | null
          id: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string | null
          id?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocked_users_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocked_users_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      changelog_dismissals: {
        Row: {
          changelog_id: string
          created_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          changelog_id: string
          created_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          changelog_id?: string
          created_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "changelog_dismissals_changelog_id_fkey"
            columns: ["changelog_id"]
            isOneToOne: false
            referencedRelation: "changelogs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "changelog_dismissals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      changelogs: {
        Row: {
          created_at: string | null
          description: string
          id: string
          is_upcoming: boolean | null
          title: string
        }
        Insert: {
          created_at?: string | null
          description: string
          id?: string
          is_upcoming?: boolean | null
          title: string
        }
        Update: {
          created_at?: string | null
          description?: string
          id?: string
          is_upcoming?: boolean | null
          title?: string
        }
        Relationships: []
      }
      content_filter_logs: {
        Row: {
          action_taken: Database["public"]["Enums"]["filter_action"]
          content_id: string | null
          content_preview: string | null
          content_type: Database["public"]["Enums"]["content_type"]
          created_at: string
          id: string
          matched_keyword_id: string | null
          user_id: string | null
        }
        Insert: {
          action_taken: Database["public"]["Enums"]["filter_action"]
          content_id?: string | null
          content_preview?: string | null
          content_type: Database["public"]["Enums"]["content_type"]
          created_at?: string
          id?: string
          matched_keyword_id?: string | null
          user_id?: string | null
        }
        Update: {
          action_taken?: Database["public"]["Enums"]["filter_action"]
          content_id?: string | null
          content_preview?: string | null
          content_type?: Database["public"]["Enums"]["content_type"]
          created_at?: string
          id?: string
          matched_keyword_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_filter_logs_matched_keyword_id_fkey"
            columns: ["matched_keyword_id"]
            isOneToOne: false
            referencedRelation: "blocked_keywords"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_filter_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      counter_offers: {
        Row: {
          counter_offer_id: string
          created_at: string | null
          id: string
          message: string | null
          original_offer_id: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          counter_offer_id: string
          created_at?: string | null
          id?: string
          message?: string | null
          original_offer_id: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          counter_offer_id?: string
          created_at?: string | null
          id?: string
          message?: string | null
          original_offer_id?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "counter_offers_counter_offer_id_fkey"
            columns: ["counter_offer_id"]
            isOneToOne: false
            referencedRelation: "barter_offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "counter_offers_original_offer_id_fkey"
            columns: ["original_offer_id"]
            isOneToOne: false
            referencedRelation: "barter_offers"
            referencedColumns: ["id"]
          },
        ]
      }
      friend_requests: {
        Row: {
          created_at: string | null
          id: string
          receiver_id: string
          sender_id: string
          status: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          receiver_id: string
          sender_id: string
          status?: string
        }
        Update: {
          created_at?: string | null
          id?: string
          receiver_id?: string
          sender_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "friend_requests_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friend_requests_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      friendships: {
        Row: {
          created_at: string | null
          id: string
          user1_id: string
          user2_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          user1_id: string
          user2_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          user1_id?: string
          user2_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "friendships_user1_id_fkey"
            columns: ["user1_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_user2_id_fkey"
            columns: ["user2_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      items: {
        Row: {
          category: string
          condition: Database["public"]["Enums"]["item_condition"]
          created_at: string | null
          description: string | null
          id: string
          images: string[]
          latitude: number | null
          location: string
          longitude: number | null
          status: Database["public"]["Enums"]["item_status"] | null
          title: string
          type: Database["public"]["Enums"]["listing_type"]
          user_id: string
        }
        Insert: {
          category: string
          condition: Database["public"]["Enums"]["item_condition"]
          created_at?: string | null
          description?: string | null
          id?: string
          images: string[]
          latitude?: number | null
          location: string
          longitude?: number | null
          status?: Database["public"]["Enums"]["item_status"] | null
          title: string
          type?: Database["public"]["Enums"]["listing_type"]
          user_id: string
        }
        Update: {
          category?: string
          condition?: Database["public"]["Enums"]["item_condition"]
          created_at?: string | null
          description?: string | null
          id?: string
          images?: string[]
          latitude?: number | null
          location?: string
          longitude?: number | null
          status?: Database["public"]["Enums"]["item_status"] | null
          title?: string
          type?: Database["public"]["Enums"]["listing_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      message_files: {
        Row: {
          created_at: string | null
          file_name: string
          file_size: number | null
          file_type: string
          file_url: string
          id: string
          message_id: string
        }
        Insert: {
          created_at?: string | null
          file_name: string
          file_size?: number | null
          file_type: string
          file_url: string
          id?: string
          message_id: string
        }
        Update: {
          created_at?: string | null
          file_name?: string
          file_size?: number | null
          file_type?: string
          file_url?: string
          id?: string
          message_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_files_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reactions: {
        Row: {
          created_at: string | null
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      message_threads: {
        Row: {
          created_at: string | null
          created_by: string
          id: string
          is_active: boolean | null
          item_id: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          id?: string
          is_active?: boolean | null
          item_id?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          id?: string
          is_active?: boolean | null
          item_id?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "message_threads_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_threads_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          archived: boolean | null
          content: string
          created_at: string | null
          file_url: string | null
          id: string
          image_url: string | null
          is_offer: boolean | null
          item_id: string | null
          offer_item_id: string | null
          read: boolean | null
          read_at: string | null
          receiver_id: string
          sender_id: string
          thread_id: string | null
          topic: string
        }
        Insert: {
          archived?: boolean | null
          content: string
          created_at?: string | null
          file_url?: string | null
          id?: string
          image_url?: string | null
          is_offer?: boolean | null
          item_id?: string | null
          offer_item_id?: string | null
          read?: boolean | null
          read_at?: string | null
          receiver_id: string
          sender_id: string
          thread_id?: string | null
          topic?: string
        }
        Update: {
          archived?: boolean | null
          content?: string
          created_at?: string | null
          file_url?: string | null
          id?: string
          image_url?: string | null
          is_offer?: boolean | null
          item_id?: string | null
          offer_item_id?: string | null
          read?: boolean | null
          read_at?: string | null
          receiver_id?: string
          sender_id?: string
          thread_id?: string | null
          topic?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_messages_thread_id"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "message_threads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_offer_item_id_fkey"
            columns: ["offer_item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_actions: {
        Row: {
          action_type: Database["public"]["Enums"]["moderation_action_type"]
          created_at: string
          id: string
          moderator_id: string
          notes: string | null
          report_id: string | null
          target_id: string
          target_type: Database["public"]["Enums"]["report_target_type"]
        }
        Insert: {
          action_type: Database["public"]["Enums"]["moderation_action_type"]
          created_at?: string
          id?: string
          moderator_id: string
          notes?: string | null
          report_id?: string | null
          target_id: string
          target_type: Database["public"]["Enums"]["report_target_type"]
        }
        Update: {
          action_type?: Database["public"]["Enums"]["moderation_action_type"]
          created_at?: string
          id?: string
          moderator_id?: string
          notes?: string | null
          report_id?: string | null
          target_id?: string
          target_type?: Database["public"]["Enums"]["report_target_type"]
        }
        Relationships: [
          {
            foreignKeyName: "moderation_actions_moderator_id_fkey"
            columns: ["moderator_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_actions_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_policies: {
        Row: {
          content: string
          id: string
          published_at: string
          require_reaccept_after: string | null
          title: string
          version: number
        }
        Insert: {
          content: string
          id?: string
          published_at?: string
          require_reaccept_after?: string | null
          title: string
          version: number
        }
        Update: {
          content?: string
          id?: string
          published_at?: string
          require_reaccept_after?: string | null
          title?: string
          version?: number
        }
        Relationships: []
      }
      newsletter_subscribers: {
        Row: {
          created_at: string | null
          email: string
          id: string
          is_unsubscribed: boolean | null
          unsubscribe_token: string
          unsubscribed_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          is_unsubscribed?: boolean | null
          unsubscribe_token?: string
          unsubscribed_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          is_unsubscribed?: boolean | null
          unsubscribe_token?: string
          unsubscribed_at?: string | null
        }
        Relationships: []
      }
      notification_settings: {
        Row: {
          categories: Json | null
          created_at: string | null
          delivery_methods: Json | null
          enabled: boolean | null
          frequency: string | null
          id: string
          quiet_hours: Json | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          categories?: Json | null
          created_at?: string | null
          delivery_methods?: Json | null
          enabled?: boolean | null
          frequency?: string | null
          id?: string
          quiet_hours?: Json | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          categories?: Json | null
          created_at?: string | null
          delivery_methods?: Json | null
          enabled?: boolean | null
          frequency?: string | null
          id?: string
          quiet_hours?: Json | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          content: string
          created_at: string | null
          id: string
          read: boolean | null
          related_id: string | null
          sender_id: string | null
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          read?: boolean | null
          related_id?: string | null
          sender_id?: string | null
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          read?: boolean | null
          related_id?: string | null
          sender_id?: string | null
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      offer_expirations: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          is_active: boolean | null
          offer_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          id?: string
          is_active?: boolean | null
          offer_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          is_active?: boolean | null
          offer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "offer_expirations_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "barter_offers"
            referencedColumns: ["id"]
          },
        ]
      }
      offer_templates: {
        Row: {
          content: string
          created_at: string | null
          id: string
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "offer_templates_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      push_settings: {
        Row: {
          functions_endpoint: string
          id: string
          service_role_key: string
          updated_at: string | null
        }
        Insert: {
          functions_endpoint: string
          id?: string
          service_role_key: string
          updated_at?: string | null
        }
        Update: {
          functions_endpoint?: string
          id?: string
          service_role_key?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      reported_messages: {
        Row: {
          created_at: string | null
          id: string
          message_id: string
          reason: string
          reporter_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          message_id: string
          reason: string
          reporter_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          message_id?: string
          reason?: string
          reporter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reported_messages_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reported_messages_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          auto_escalated: boolean
          category: string
          created_at: string
          description: string | null
          first_response_at: string | null
          id: string
          metadata: Json | null
          needs_action_by: string | null
          reporter_id: string
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["report_status"]
          target_id: string
          target_type: Database["public"]["Enums"]["report_target_type"]
        }
        Insert: {
          auto_escalated?: boolean
          category: string
          created_at?: string
          description?: string | null
          first_response_at?: string | null
          id?: string
          metadata?: Json | null
          needs_action_by?: string | null
          reporter_id: string
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          target_id: string
          target_type: Database["public"]["Enums"]["report_target_type"]
        }
        Update: {
          auto_escalated?: boolean
          category?: string
          created_at?: string
          description?: string | null
          first_response_at?: string | null
          id?: string
          metadata?: Json | null
          needs_action_by?: string | null
          reporter_id?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          target_id?: string
          target_type?: Database["public"]["Enums"]["report_target_type"]
        }
        Relationships: [
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      thread_members: {
        Row: {
          created_at: string | null
          id: string
          role: string | null
          thread_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role?: string | null
          thread_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: string | null
          thread_id?: string
          user_id?: string
        }
        Relationships: []
      }
      user_history: {
        Row: {
          action_type: Database["public"]["Enums"]["history_action_type"]
          changes: Json | null
          created_at: string | null
          id: string
          item_category: string | null
          item_condition: Database["public"]["Enums"]["item_condition"] | null
          item_description: string | null
          item_id: string | null
          item_images: string[] | null
          item_title: string
          item_type: Database["public"]["Enums"]["listing_type"] | null
          user_id: string
        }
        Insert: {
          action_type: Database["public"]["Enums"]["history_action_type"]
          changes?: Json | null
          created_at?: string | null
          id?: string
          item_category?: string | null
          item_condition?: Database["public"]["Enums"]["item_condition"] | null
          item_description?: string | null
          item_id?: string | null
          item_images?: string[] | null
          item_title: string
          item_type?: Database["public"]["Enums"]["listing_type"] | null
          user_id: string
        }
        Update: {
          action_type?: Database["public"]["Enums"]["history_action_type"]
          changes?: Json | null
          created_at?: string | null
          id?: string
          item_category?: string | null
          item_condition?: Database["public"]["Enums"]["item_condition"] | null
          item_description?: string | null
          item_id?: string | null
          item_images?: string[] | null
          item_title?: string
          item_type?: Database["public"]["Enums"]["listing_type"] | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_history_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_policy_acceptances: {
        Row: {
          accepted_at: string
          id: string
          platform: string | null
          policy_id: string
          user_id: string
        }
        Insert: {
          accepted_at?: string
          id?: string
          platform?: string | null
          policy_id: string
          user_id: string
        }
        Update: {
          accepted_at?: string
          id?: string
          platform?: string | null
          policy_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_policy_acceptances_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "moderation_policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_policy_acceptances_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_push_tokens: {
        Row: {
          app_version: string | null
          created_at: string | null
          disabled: boolean | null
          id: string
          last_seen_at: string | null
          platform: string | null
          push_token: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          app_version?: string | null
          created_at?: string | null
          disabled?: boolean | null
          id?: string
          last_seen_at?: string | null
          platform?: string | null
          push_token: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          app_version?: string | null
          created_at?: string | null
          disabled?: boolean | null
          id?: string
          last_seen_at?: string | null
          platform?: string | null
          push_token?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          avatar_url: string | null
          banned: boolean
          created_at: string | null
          full_name: string | null
          gender: Database["public"]["Enums"]["user_gender"] | null
          id: string
          location: string | null
          profile_completed: boolean | null
          rating: number | null
          username: string | null
          zipcode: string | null
        }
        Insert: {
          avatar_url?: string | null
          banned?: boolean
          created_at?: string | null
          full_name?: string | null
          gender?: Database["public"]["Enums"]["user_gender"] | null
          id: string
          location?: string | null
          profile_completed?: boolean | null
          rating?: number | null
          username?: string | null
          zipcode?: string | null
        }
        Update: {
          avatar_url?: string | null
          banned?: boolean
          created_at?: string | null
          full_name?: string | null
          gender?: Database["public"]["Enums"]["user_gender"] | null
          id?: string
          location?: string | null
          profile_completed?: boolean | null
          rating?: number | null
          username?: string | null
          zipcode?: string | null
        }
        Relationships: []
      }
      watched_items: {
        Row: {
          created_at: string | null
          id: string
          item_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          item_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          item_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "watched_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "watched_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_thread_member: {
        Args: { p_role?: string; p_thread_id: string; p_user_id: string }
        Returns: Json
      }
      ban_user: {
        Args: { ban_reason?: string; user_id_to_ban: string }
        Returns: undefined
      }
      check_username_available: {
        Args: { p_username: string }
        Returns: boolean
      }
      cleanup_friend_request_pair: {
        Args: { p_receiver: string; p_sender: string }
        Returns: string
      }
      decline_friend_request_secure: {
        Args: { p_request_id: string }
        Returns: string
      }
      delete_user_account_data: {
        Args: { metadata?: Json; target_email?: string; target_user_id: string }
        Returns: undefined
      }
      expire_offers: { Args: never; Returns: undefined }
      get_auth_user_threads: { Args: never; Returns: string[] }
      get_item_owner: { Args: { item_uuid: string }; Returns: string }
      get_or_create_thread: {
        Args: { item_id?: string; participant_uuids: string[]; title?: string }
        Returns: string
      }
      get_thread_members: {
        Args: { p_thread_id: string }
        Returns: {
          created_at: string
          id: string
          role: string
          thread_id: string
          user_id: string
        }[]
      }
      is_thread_member: {
        Args: { _thread: string; _user: string }
        Returns: boolean
      }
      remove_thread_member: {
        Args: { p_thread_id: string; p_user_id: string }
        Returns: Json
      }
      unban_user: { Args: { user_id_to_unban: string }; Returns: undefined }
    }
    Enums: {
      content_type: "item_title" | "item_description" | "message"
      filter_action: "blocked" | "warned" | "allowed"
      filter_severity: "warning" | "block"
      history_action_type: "created" | "edited" | "deleted"
      item_condition: "new" | "like-new" | "good" | "fair" | "poor"
      item_status: "available" | "pending" | "traded" | "claimed"
      listing_type: "free" | "barter"
      moderation_action_type:
        | "remove_content"
        | "ban_user"
        | "dismiss_report"
        | "warn_user"
      notification_type:
        | "friend_request"
        | "friend_request_approved"
        | "new_listing"
        | "direct_message"
        | "watchlist_update"
        | "system_alerts"
      pattern_type: "exact" | "contains" | "regex"
      report_status: "pending" | "in_review" | "resolved" | "dismissed"
      report_target_type: "user" | "item" | "message" | "comment" | "other"
      user_gender: "male" | "female"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      content_type: ["item_title", "item_description", "message"],
      filter_action: ["blocked", "warned", "allowed"],
      filter_severity: ["warning", "block"],
      history_action_type: ["created", "edited", "deleted"],
      item_condition: ["new", "like-new", "good", "fair", "poor"],
      item_status: ["available", "pending", "traded", "claimed"],
      listing_type: ["free", "barter"],
      moderation_action_type: [
        "remove_content",
        "ban_user",
        "dismiss_report",
        "warn_user",
      ],
      notification_type: [
        "friend_request",
        "friend_request_approved",
        "new_listing",
        "direct_message",
        "watchlist_update",
        "system_alerts",
      ],
      pattern_type: ["exact", "contains", "regex"],
      report_status: ["pending", "in_review", "resolved", "dismissed"],
      report_target_type: ["user", "item", "message", "comment", "other"],
      user_gender: ["male", "female"],
    },
  },
} as const
