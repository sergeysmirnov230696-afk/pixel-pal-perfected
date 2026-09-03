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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      game_settings: {
        Row: {
          id: boolean
          min_collect: number
          min_deposit: number
          min_withdraw: number
          referral_bonus: number
          referral_percent: number
          updated_at: string
        }
        Insert: {
          id?: boolean
          min_collect?: number
          min_deposit?: number
          min_withdraw?: number
          referral_bonus?: number
          referral_percent?: number
          updated_at?: string
        }
        Update: {
          id?: boolean
          min_collect?: number
          min_deposit?: number
          min_withdraw?: number
          referral_bonus?: number
          referral_percent?: number
          updated_at?: string
        }
        Relationships: []
      }
      news: {
        Row: {
          active: boolean
          body: string
          created_at: string
          id: string
          title: string
        }
        Insert: {
          active?: boolean
          body?: string
          created_at?: string
          id?: string
          title: string
        }
        Update: {
          active?: boolean
          body?: string
          created_at?: string
          id?: string
          title?: string
        }
        Relationships: []
      }
      player_achievements: {
        Row: {
          claimed_at: string
          id: string
          key: string
          player_id: string
          reward: number
        }
        Insert: {
          claimed_at?: string
          id?: string
          key: string
          player_id: string
          reward?: number
        }
        Update: {
          claimed_at?: string
          id?: string
          key?: string
          player_id?: string
          reward?: number
        }
        Relationships: [
          {
            foreignKeyName: "player_achievements_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      player_dragons: {
        Row: {
          bought_at: string
          dragon_id: number
          id: string
          player_id: string
        }
        Insert: {
          bought_at?: string
          dragon_id: number
          id?: string
          player_id: string
        }
        Update: {
          bought_at?: string
          dragon_id?: number
          id?: string
          player_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_dragons_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          addresses: Json
          balance: number
          banned: boolean
          boost_multiplier: number
          boost_until: string | null
          collected: number
          created_at: string
          daily_streak: number
          first_dragon_at: string | null
          id: string
          language: string
          last_accrual: string
          last_daily_at: string | null
          name: string
          player_key: string
          referral_balance: number
          referred_by: string | null
          total_deposited: number
        }
        Insert: {
          addresses?: Json
          balance?: number
          banned?: boolean
          boost_multiplier?: number
          boost_until?: string | null
          collected?: number
          created_at?: string
          daily_streak?: number
          first_dragon_at?: string | null
          id?: string
          language?: string
          last_accrual?: string
          last_daily_at?: string | null
          name?: string
          player_key: string
          referral_balance?: number
          referred_by?: string | null
          total_deposited?: number
        }
        Update: {
          addresses?: Json
          balance?: number
          banned?: boolean
          boost_multiplier?: number
          boost_until?: string | null
          collected?: number
          created_at?: string
          daily_streak?: number
          first_dragon_at?: string | null
          id?: string
          language?: string
          last_accrual?: string
          last_daily_at?: string | null
          name?: string
          player_key?: string
          referral_balance?: number
          referred_by?: string | null
          total_deposited?: number
        }
        Relationships: []
      }
      promo_codes: {
        Row: {
          active: boolean
          amount: number
          code: string
          created_at: string
          expires_at: string | null
          id: string
          max_uses: number
          used_count: number
        }
        Insert: {
          active?: boolean
          amount?: number
          code: string
          created_at?: string
          expires_at?: string | null
          id?: string
          max_uses?: number
          used_count?: number
        }
        Update: {
          active?: boolean
          amount?: number
          code?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          max_uses?: number
          used_count?: number
        }
        Relationships: []
      }
      promo_redemptions: {
        Row: {
          amount: number
          code: string
          created_at: string
          id: string
          player_id: string
        }
        Insert: {
          amount?: number
          code: string
          created_at?: string
          id?: string
          player_id: string
        }
        Update: {
          amount?: number
          code?: string
          created_at?: string
          id?: string
          player_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "promo_redemptions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          bonus_paid: boolean
          created_at: string
          deposit: number
          id: string
          income: number
          invited_key: string | null
          invited_name: string
          inviter_id: string
        }
        Insert: {
          bonus_paid?: boolean
          created_at?: string
          deposit?: number
          id?: string
          income?: number
          invited_key?: string | null
          invited_name: string
          inviter_id: string
        }
        Update: {
          bonus_paid?: boolean
          created_at?: string
          deposit?: number
          id?: string
          income?: number
          invited_key?: string | null
          invited_name?: string
          inviter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referrals_inviter_id_fkey"
            columns: ["inviter_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          address: string | null
          admin_note: string | null
          amount: number
          created_at: string
          id: string
          invoice_id: string | null
          kind: string
          method: string
          player_id: string
          status: string
          txid: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          admin_note?: string | null
          amount: number
          created_at?: string
          id?: string
          invoice_id?: string | null
          kind: string
          method: string
          player_id: string
          status?: string
          txid?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          admin_note?: string | null
          amount?: number
          created_at?: string
          id?: string
          invoice_id?: string | null
          kind?: string
          method?: string
          player_id?: string
          status?: string
          txid?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
