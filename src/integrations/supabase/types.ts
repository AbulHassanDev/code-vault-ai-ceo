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
      ai_activity_logs: {
        Row: {
          action: string
          agent_key: string | null
          approval_id: string | null
          approval_required: boolean
          created_at: string
          error: string | null
          id: string
          input_summary: string | null
          output_summary: string | null
          result: string | null
          risk_level: string | null
          task_id: string | null
          tool_name: string | null
        }
        Insert: {
          action: string
          agent_key?: string | null
          approval_id?: string | null
          approval_required?: boolean
          created_at?: string
          error?: string | null
          id?: string
          input_summary?: string | null
          output_summary?: string | null
          result?: string | null
          risk_level?: string | null
          task_id?: string | null
          tool_name?: string | null
        }
        Update: {
          action?: string
          agent_key?: string | null
          approval_id?: string | null
          approval_required?: boolean
          created_at?: string
          error?: string | null
          id?: string
          input_summary?: string | null
          output_summary?: string | null
          result?: string | null
          risk_level?: string | null
          task_id?: string | null
          tool_name?: string | null
        }
        Relationships: []
      }
      ai_agents: {
        Row: {
          created_at: string
          description: string | null
          enabled: boolean
          id: string
          key: string
          model: string
          name: string
          schedule: string | null
          system_instructions: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          key: string
          model?: string
          name: string
          schedule?: string | null
          system_instructions?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          key?: string
          model?: string
          name?: string
          schedule?: string | null
          system_instructions?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ai_approvals: {
        Row: {
          after_state: Json | null
          agent_key: string | null
          args: Json
          args_hash: string
          before_state: Json | null
          confidence: number | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          evidence: Json | null
          executed_at: string | null
          execution_result: Json | null
          expected_outcome: string | null
          expires_at: string
          id: string
          reason: string | null
          risk_level: string
          status: string
          title: string
          tool_name: string
        }
        Insert: {
          after_state?: Json | null
          agent_key?: string | null
          args?: Json
          args_hash: string
          before_state?: Json | null
          confidence?: number | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          evidence?: Json | null
          executed_at?: string | null
          execution_result?: Json | null
          expected_outcome?: string | null
          expires_at?: string
          id?: string
          reason?: string | null
          risk_level?: string
          status?: string
          title: string
          tool_name: string
        }
        Update: {
          after_state?: Json | null
          agent_key?: string | null
          args?: Json
          args_hash?: string
          before_state?: Json | null
          confidence?: number | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          evidence?: Json | null
          executed_at?: string | null
          execution_result?: Json | null
          expected_outcome?: string | null
          expires_at?: string
          id?: string
          reason?: string | null
          risk_level?: string
          status?: string
          title?: string
          tool_name?: string
        }
        Relationships: []
      }
      ai_automations: {
        Row: {
          action: string
          condition: string | null
          created_at: string
          enabled: boolean
          event: string
          id: string
          max_runs_per_day: number
          name: string
          requires_approval: boolean
          risk_level: string
        }
        Insert: {
          action: string
          condition?: string | null
          created_at?: string
          enabled?: boolean
          event: string
          id?: string
          max_runs_per_day?: number
          name: string
          requires_approval?: boolean
          risk_level?: string
        }
        Update: {
          action?: string
          condition?: string | null
          created_at?: string
          enabled?: boolean
          event?: string
          id?: string
          max_runs_per_day?: number
          name?: string
          requires_approval?: boolean
          risk_level?: string
        }
        Relationships: []
      }
      ai_cost_usage: {
        Row: {
          agent_key: string | null
          created_at: string
          estimated_cost_cents: number
          id: string
          model: string | null
          request_count: number
        }
        Insert: {
          agent_key?: string | null
          created_at?: string
          estimated_cost_cents?: number
          id?: string
          model?: string | null
          request_count?: number
        }
        Update: {
          agent_key?: string | null
          created_at?: string
          estimated_cost_cents?: number
          id?: string
          model?: string | null
          request_count?: number
        }
        Relationships: []
      }
      ai_events: {
        Row: {
          created_at: string
          id: string
          payload: Json
          processed: boolean
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          payload?: Json
          processed?: boolean
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          payload?: Json
          processed?: boolean
          type?: string
        }
        Relationships: []
      }
      ai_goals: {
        Row: {
          active: boolean
          created_at: string
          id: string
          metric: string | null
          priority: number
          target: string | null
          title: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          metric?: string | null
          priority?: number
          target?: string | null
          title: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          metric?: string | null
          priority?: number
          target?: string | null
          title?: string
        }
        Relationships: []
      }
      ai_incidents: {
        Row: {
          affected_system: string | null
          created_at: string
          description: string | null
          id: string
          resolution: string | null
          resolved_at: string | null
          severity: string
          source: string | null
          status: string
          title: string
        }
        Insert: {
          affected_system?: string | null
          created_at?: string
          description?: string | null
          id?: string
          resolution?: string | null
          resolved_at?: string | null
          severity?: string
          source?: string | null
          status?: string
          title: string
        }
        Update: {
          affected_system?: string | null
          created_at?: string
          description?: string | null
          id?: string
          resolution?: string | null
          resolved_at?: string | null
          severity?: string
          source?: string | null
          status?: string
          title?: string
        }
        Relationships: []
      }
      ai_knowledge_documents: {
        Row: {
          body: string
          category: string
          created_at: string
          id: string
          title: string
          updated_at: string
        }
        Insert: {
          body: string
          category?: string
          created_at?: string
          id?: string
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          category?: string
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_memory: {
        Row: {
          confirmed: boolean
          content: string
          created_at: string
          expires_at: string | null
          id: string
          kind: string
          source: string
          title: string
        }
        Insert: {
          confirmed?: boolean
          content: string
          created_at?: string
          expires_at?: string | null
          id?: string
          kind?: string
          source?: string
          title: string
        }
        Update: {
          confirmed?: boolean
          content?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          kind?: string
          source?: string
          title?: string
        }
        Relationships: []
      }
      ai_reports: {
        Row: {
          body: string
          created_at: string
          id: string
          kind: string
          metrics: Json | null
          title: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          kind?: string
          metrics?: Json | null
          title: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          kind?: string
          metrics?: Json | null
          title?: string
        }
        Relationships: []
      }
      ai_settings: {
        Row: {
          ai_enabled: boolean
          auto_apply_low_risk_seo: boolean
          chat_model: string
          daily_budget_cents: number
          emergency_stop: boolean
          fast_model: string
          id: boolean
          pause_reason: string | null
          paused: boolean
          updated_at: string
        }
        Insert: {
          ai_enabled?: boolean
          auto_apply_low_risk_seo?: boolean
          chat_model?: string
          daily_budget_cents?: number
          emergency_stop?: boolean
          fast_model?: string
          id?: boolean
          pause_reason?: string | null
          paused?: boolean
          updated_at?: string
        }
        Update: {
          ai_enabled?: boolean
          auto_apply_low_risk_seo?: boolean
          chat_model?: string
          daily_budget_cents?: number
          emergency_stop?: boolean
          fast_model?: string
          id?: boolean
          pause_reason?: string | null
          paused?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      ai_tasks: {
        Row: {
          agent_key: string | null
          approval_id: string | null
          created_at: string
          dedupe_key: string | null
          description: string | null
          due_at: string | null
          error: string | null
          id: string
          priority: number
          requires_approval: boolean
          result: Json | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          agent_key?: string | null
          approval_id?: string | null
          created_at?: string
          dedupe_key?: string | null
          description?: string | null
          due_at?: string | null
          error?: string | null
          id?: string
          priority?: number
          requires_approval?: boolean
          result?: Json | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          agent_key?: string | null
          approval_id?: string | null
          created_at?: string
          dedupe_key?: string | null
          description?: string | null
          due_at?: string | null
          error?: string | null
          id?: string
          priority?: number
          requires_approval?: boolean
          result?: Json | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_tasks_approval_id_fkey"
            columns: ["approval_id"]
            isOneToOne: false
            referencedRelation: "ai_approvals"
            referencedColumns: ["id"]
          },
        ]
      }
      download_events: {
        Row: {
          created_at: string
          error: string | null
          id: string
          product_id: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          error?: string | null
          id?: string
          product_id?: string | null
          status: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: string
          product_id?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "download_events_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          amount_cents: number
          created_at: string
          currency: string
          failure_reason: string | null
          id: string
          product_id: string
          provider: string
          provider_ref: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          currency?: string
          failure_reason?: string | null
          id?: string
          product_id: string
          provider?: string
          provider_ref?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          currency?: string
          failure_reason?: string | null
          id?: string
          product_id?: string
          provider?: string
          provider_ref?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          asset_path: string | null
          category: string
          cover_url: string | null
          created_at: string
          demo_url: string | null
          description: string | null
          id: string
          price_cents: number
          quality_score: number | null
          seo_description: string | null
          seo_title: string | null
          slug: string
          status: string
          tagline: string | null
          tags: string[]
          tech: string[]
          title: string
          updated_at: string
          views: number
        }
        Insert: {
          asset_path?: string | null
          category?: string
          cover_url?: string | null
          created_at?: string
          demo_url?: string | null
          description?: string | null
          id?: string
          price_cents?: number
          quality_score?: number | null
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          status?: string
          tagline?: string | null
          tags?: string[]
          tech?: string[]
          title: string
          updated_at?: string
          views?: number
        }
        Update: {
          asset_path?: string | null
          category?: string
          cover_url?: string | null
          created_at?: string
          demo_url?: string | null
          description?: string | null
          id?: string
          price_cents?: number
          quality_score?: number | null
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          status?: string
          tagline?: string | null
          tags?: string[]
          tech?: string[]
          title?: string
          updated_at?: string
          views?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
        }
        Relationships: []
      }
      purchases: {
        Row: {
          created_at: string
          download_count: number
          id: string
          last_download_status: string | null
          order_id: string | null
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          download_count?: number
          id?: string
          last_download_status?: string | null
          order_id?: string | null
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          download_count?: number
          id?: string
          last_download_status?: string | null
          order_id?: string | null
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchases_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
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
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
