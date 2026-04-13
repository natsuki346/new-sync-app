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
      profiles: {
        Row: {
          id:           string
          username:     string
          display_name: string
          avatar_url:   string | null
          header_url:   string | null
          bio:          string | null
          hashtags:     string[]
          bluetooth_id: string | null
          last_seen_at: string | null
          created_at:   string
          lat:          number | null
          lng:          number | null
        }
        Insert: {
          id:           string
          username:     string
          display_name: string
          avatar_url?:  string | null
          header_url?:  string | null
          bio?:         string | null
          hashtags?:    string[]
          bluetooth_id?: string | null
          last_seen_at?: string | null
          created_at?:  string
          lat?:         number | null
          lng?:         number | null
        }
        Update: {
          id?:          string
          username?:    string
          display_name?: string
          avatar_url?:  string | null
          header_url?:  string | null
          bio?:         string | null
          hashtags?:    string[]
          bluetooth_id?: string | null
          last_seen_at?: string | null
          created_at?:  string
          lat?:         number | null
          lng?:         number | null
        }
      }

      posts: {
        Row: {
          id:         string
          user_id:    string
          content:    string
          hashtags:   string[]
          color:      string | null
          is_mutual:  boolean
          parent_id:  string | null
          expires_at: string | null
          created_at: string
          lat:        number | null
          lng:        number | null
        }
        Insert: {
          id?:        string
          user_id:    string
          content:    string
          hashtags?:  string[]
          color?:     string | null
          is_mutual?: boolean
          parent_id?: string | null
          expires_at?: string | null
          created_at?: string
          lat?:       number | null
          lng?:       number | null
        }
        Update: {
          id?:        string
          user_id?:   string
          content?:   string
          hashtags?:  string[]
          color?:     string | null
          is_mutual?: boolean
          parent_id?: string | null
          expires_at?: string | null
          created_at?: string
          lat?:       number | null
          lng?:       number | null
        }
      }

      bubbles: {
        Row: {
          id:                 string
          user_id:            string
          content:            string
          hashtags:           string[]
          color:              string | null
          session_id:         string | null
          is_offline_created: boolean
          expires_at:         string | null
          created_at:         string
          lat:                number | null
          lng:                number | null
          radius:             number | null
        }
        Insert: {
          id?:                string
          user_id:            string
          content:            string
          hashtags?:          string[]
          color?:             string | null
          session_id?:        string | null
          is_offline_created?: boolean
          expires_at?:        string | null
          created_at?:        string
          lat?:               number | null
          lng?:               number | null
          radius?:            number | null
        }
        Update: {
          id?:                string
          user_id?:           string
          content?:           string
          hashtags?:          string[]
          color?:             string | null
          session_id?:        string | null
          is_offline_created?: boolean
          lat?:               number | null
          lng?:               number | null
          radius?:            number | null
          expires_at?:        string | null
          created_at?:        string
        }
      }

      hashtag_engagements: {
        Row: {
          id:             string
          user_id:        string
          tag:            string
          post_count:     number
          reaction_count: number
          is_owner:       boolean
          created_at:     string
        }
        Insert: {
          id?:            string
          user_id:        string
          tag:            string
          post_count?:    number
          reaction_count?: number
          is_owner?:      boolean
          created_at?:    string
        }
        Update: {
          id?:            string
          user_id?:       string
          tag?:           string
          post_count?:    number
          reaction_count?: number
          is_owner?:      boolean
          created_at?:    string
        }
      }

      follows: {
        Row: {
          id:           string
          follower_id:  string
          following_id: string
          type:         'user' | 'hashtag'
          status:       'pending' | 'accepted'
          tag:          string | null
          created_at:   string
        }
        Insert: {
          id?:          string
          follower_id:  string
          following_id: string
          type:         'user' | 'hashtag'
          status?:      'pending' | 'accepted'
          tag?:         string | null
          created_at?:  string
        }
        Update: {
          id?:          string
          follower_id?: string
          following_id?: string
          type?:        'user' | 'hashtag'
          status?:      'pending' | 'accepted'
          tag?:         string | null
          created_at?:  string
        }
      }

      reactions: {
        Row: {
          id:          string
          user_id:     string
          target_id:   string
          target_type: 'bubble' | 'post'
          emoji:       string
          synced_at:   string | null
          created_at:  string
        }
        Insert: {
          id?:         string
          user_id:     string
          target_id:   string
          target_type: 'bubble' | 'post'
          emoji:       string
          synced_at?:  string | null
          created_at?: string
        }
        Update: {
          id?:         string
          user_id?:    string
          target_id?:  string
          target_type?: 'bubble' | 'post'
          emoji?:      string
          synced_at?:  string | null
          created_at?: string
        }
      }

      notifications: {
        Row: {
          id:           string
          user_id:      string
          type:         string
          from_user_id: string | null
          target_id:    string | null
          read:         boolean
          created_at:   string
        }
        Insert: {
          id?:          string
          user_id:      string
          type:         string
          from_user_id?: string | null
          target_id?:   string | null
          read?:        boolean
          created_at?:  string
        }
        Update: {
          id?:          string
          user_id?:     string
          type?:        string
          from_user_id?: string | null
          target_id?:   string | null
          read?:        boolean
          created_at?:  string
        }
      }

      sessions: {
        Row: {
          id:                string
          name:              string
          location:          string | null
          started_at:        string
          ended_at:          string | null
          host_user_id:      string
          participant_count: number
          created_at:        string
        }
        Insert: {
          id?:               string
          name:              string
          location?:         string | null
          started_at?:       string
          ended_at?:         string | null
          host_user_id:      string
          participant_count?: number
          created_at?:       string
        }
        Update: {
          id?:               string
          name?:             string
          location?:         string | null
          started_at?:       string
          ended_at?:         string | null
          host_user_id?:     string
          participant_count?: number
          created_at?:       string
        }
      }

      offline_queue: {
        Row: {
          id:          string
          user_id:     string
          action_type: 'reaction' | 'dm' | 'follow' | 'profile_view'
          payload:     Json
          synced_at:   string | null
          created_at:  string
        }
        Insert: {
          id?:         string
          user_id:     string
          action_type: 'reaction' | 'dm' | 'follow' | 'profile_view'
          payload?:    Json
          synced_at?:  string | null
          created_at?: string
        }
        Update: {
          id?:         string
          user_id?:    string
          action_type?: 'reaction' | 'dm' | 'follow' | 'profile_view'
          payload?:    Json
          synced_at?:  string | null
          created_at?: string
        }
      }

      pinned_posts: {
        Row: {
          id:          string
          user_id:     string
          post_id:     string
          order_index: number
          created_at:  string
        }
        Insert: {
          id?:          string
          user_id:      string
          post_id:      string
          order_index?: number
          created_at?:  string
        }
        Update: {
          order_index?: number
        }
      }

      bookmarks: {
        Row: {
          id:         string
          user_id:    string
          post_id:    string
          created_at: string
        }
        Insert: {
          id?:         string
          user_id:     string
          post_id:     string
          created_at?: string
        }
        Update: {
          id?:         string
          user_id?:    string
          post_id?:    string
          created_at?: string
        }
      }

      profile_views: {
        Row: {
          id:         string
          viewer_id:  string
          viewed_id:  string
          session_id: string | null
          synced_at:  string | null
          created_at: string
        }
        Insert: {
          id?:        string
          viewer_id:  string
          viewed_id:  string
          session_id?: string | null
          synced_at?:  string | null
          created_at?: string
        }
        Update: {
          id?:        string
          viewer_id?: string
          viewed_id?: string
          session_id?: string | null
          synced_at?:  string | null
          created_at?: string
        }
      }

      conversations: {
        Row: {
          id:         string
          type:       'dm' | 'group'
          name:       string | null
          avatar:     string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?:        string
          type?:      'dm' | 'group'
          name?:      string | null
          avatar?:    string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?:      string | null
          avatar?:    string | null
          updated_at?: string
        }
      }

      conversation_members: {
        Row: {
          id:              string
          conversation_id: string
          user_id:         string
          joined_at:       string
        }
        Insert: {
          id?:             string
          conversation_id: string
          user_id:         string
          joined_at?:      string
        }
        Update: {
          joined_at?: string
        }
      }

      messages: {
        Row: {
          id:              string
          conversation_id: string
          user_id:         string | null
          content:         string | null
          message_type:    'text' | 'image'
          image_url:       string | null
          read_by:         string[]
          created_at:      string
        }
        Insert: {
          id?:             string
          conversation_id: string
          user_id?:        string | null
          content?:        string | null
          message_type?:   'text' | 'image'
          image_url?:      string | null
          read_by?:        string[]
          created_at?:     string
        }
        Update: {
          content?:     string | null
          read_by?:     string[]
        }
      }
    }

    Views: {
      [_ in never]: never
    }

    Functions: {
      increment_hashtag_post: {
        Args: { p_user_id: string; p_tag: string }
        Returns: void
      }
      increment_hashtag_reaction: {
        Args: { p_user_id: string; p_tag: string }
        Returns: void
      }
    }

    Enums: {
      [_ in never]: never
    }
  }
}

// ── 便利な型エイリアス ──────────────────────────────────────────
type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']

type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']

type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']

export type { Tables, TablesInsert, TablesUpdate }

// Row 型の個別エクスポート
export type Profile             = Tables<'profiles'>
export type Post                = Tables<'posts'>
export type Bubble              = Tables<'bubbles'>
export type Follow              = Tables<'follows'>
export type Reaction            = Tables<'reactions'>
export type Notification        = Tables<'notifications'>
export type Session             = Tables<'sessions'>
export type OfflineQueue        = Tables<'offline_queue'>
export type ProfileView         = Tables<'profile_views'>
export type Conversation        = Tables<'conversations'>
export type ConversationMember  = Tables<'conversation_members'>
export type Message             = Tables<'messages'>
export type PinnedPost          = Tables<'pinned_posts'>
