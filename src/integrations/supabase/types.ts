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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      clients: {
        Row: {
          company: string | null
          created_at: string
          email: string | null
          id: string
          lead_type: string
          name: string
          notes: string | null
          owner_id: string
          phone: string | null
          source: string | null
        }
        Insert: {
          company?: string | null
          created_at?: string
          email?: string | null
          id?: string
          lead_type?: string
          name: string
          notes?: string | null
          owner_id: string
          phone?: string | null
          source?: string | null
        }
        Update: {
          company?: string | null
          created_at?: string
          email?: string | null
          id?: string
          lead_type?: string
          name?: string
          notes?: string | null
          owner_id?: string
          phone?: string | null
          source?: string | null
        }
        Relationships: []
      }
      deals: {
        Row: {
          client_id: string | null
          closed_at: string | null
          created_at: string
          id: string
          lead_type: string
          owner_id: string
          stage_id: string | null
          status: string
          title: string
          value: number
        }
        Insert: {
          client_id?: string | null
          closed_at?: string | null
          created_at?: string
          id?: string
          lead_type?: string
          owner_id: string
          stage_id?: string | null
          status?: string
          title: string
          value?: number
        }
        Update: {
          client_id?: string | null
          closed_at?: string | null
          created_at?: string
          id?: string
          lead_type?: string
          owner_id?: string
          stage_id?: string | null
          status?: string
          title?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "deals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "stages"
            referencedColumns: ["id"]
          },
        ]
      }
      form_submissions: {
        Row: {
          company: string | null
          created_at: string
          data: Json
          id: string
          name: string
          owner_id: string
          type: string
        }
        Insert: {
          company?: string | null
          created_at?: string
          data?: Json
          id?: string
          name: string
          owner_id: string
          type: string
        }
        Update: {
          company?: string | null
          created_at?: string
          data?: Json
          id?: string
          name?: string
          owner_id?: string
          type?: string
        }
        Relationships: []
      }
      funnels: {
        Row: {
          created_at: string
          id: string
          name: string
          position: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          position?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          position?: number
        }
        Relationships: []
      }
      lead_types: {
        Row: {
          created_at: string
          id: string
          name: string
          position: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          position?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          position?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          commission_rate: number
          created_at: string
          email: string | null
          force_password_change: boolean
          full_name: string
          id: string
          is_active: boolean
          monthly_goal: number
        }
        Insert: {
          commission_rate?: number
          created_at?: string
          email?: string | null
          force_password_change?: boolean
          full_name?: string
          id: string
          is_active?: boolean
          monthly_goal?: number
        }
        Update: {
          commission_rate?: number
          created_at?: string
          email?: string | null
          force_password_change?: boolean
          full_name?: string
          id?: string
          is_active?: boolean
          monthly_goal?: number
        }
        Relationships: []
      }
      stages: {
        Row: {
          color: string
          created_at: string
          funnel_id: string
          id: string
          name: string
          position: number
        }
        Insert: {
          color?: string
          created_at?: string
          funnel_id: string
          id?: string
          name: string
          position?: number
        }
        Update: {
          color?: string
          created_at?: string
          funnel_id?: string
          id?: string
          name?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "stages_funnel_id_fkey"
            columns: ["funnel_id"]
            isOneToOne: false
            referencedRelation: "funnels"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          client_id: string | null
          completed_at: string | null
          created_at: string
          deal_id: string | null
          description: string | null
          done: boolean
          due_date: string | null
          id: string
          owner_id: string
          priority: string
          title: string
        }
        Insert: {
          client_id?: string | null
          completed_at?: string | null
          created_at?: string
          deal_id?: string | null
          description?: string | null
          done?: boolean
          due_date?: string | null
          id?: string
          owner_id: string
          priority?: string
          title: string
        }
        Update: {
          client_id?: string | null
          completed_at?: string | null
          created_at?: string
          deal_id?: string | null
          description?: string | null
          done?: boolean
          due_date?: string | null
          id?: string
          owner_id?: string
          priority?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      upsert_profile: {
        Args: { p_email: string; p_full_name: string; p_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "vendedor"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["admin", "vendedor"],
    },
  },
} as const
