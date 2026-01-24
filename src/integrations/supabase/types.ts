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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      communications_monitoring: {
        Row: {
          channel_type: string
          content_summary: string | null
          created_at: string
          flagged: boolean | null
          id: string
          priority: Database["public"]["Enums"]["alert_severity"] | null
          recipient: string | null
          related_alert_id: string | null
          sender: string | null
          timestamp: string
        }
        Insert: {
          channel_type: string
          content_summary?: string | null
          created_at?: string
          flagged?: boolean | null
          id?: string
          priority?: Database["public"]["Enums"]["alert_severity"] | null
          recipient?: string | null
          related_alert_id?: string | null
          sender?: string | null
          timestamp?: string
        }
        Update: {
          channel_type?: string
          content_summary?: string | null
          created_at?: string
          flagged?: boolean | null
          id?: string
          priority?: Database["public"]["Enums"]["alert_severity"] | null
          recipient?: string | null
          related_alert_id?: string | null
          sender?: string | null
          timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "communications_monitoring_related_alert_id_fkey"
            columns: ["related_alert_id"]
            isOneToOne: false
            referencedRelation: "threat_alerts"
            referencedColumns: ["id"]
          },
        ]
      }
      connected_agencies: {
        Row: {
          code: string
          contact_email: string | null
          contact_person: string | null
          contact_phone: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          status: Database["public"]["Enums"]["agency_status"] | null
          updated_at: string
        }
        Insert: {
          code: string
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          status?: Database["public"]["Enums"]["agency_status"] | null
          updated_at?: string
        }
        Update: {
          code?: string
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          status?: Database["public"]["Enums"]["agency_status"] | null
          updated_at?: string
        }
        Relationships: []
      }
      intelligence_reports: {
        Row: {
          author_id: string
          category: string | null
          classification: Database["public"]["Enums"]["clearance_level"] | null
          content: string | null
          created_at: string
          id: string
          source: string | null
          title: string
          updated_at: string
        }
        Insert: {
          author_id: string
          category?: string | null
          classification?: Database["public"]["Enums"]["clearance_level"] | null
          content?: string | null
          created_at?: string
          id?: string
          source?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          category?: string | null
          classification?: Database["public"]["Enums"]["clearance_level"] | null
          content?: string | null
          created_at?: string
          id?: string
          source?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      network_analysis_data: {
        Row: {
          bytes_transferred: number | null
          created_at: string
          destination_ip: string | null
          id: string
          payload_summary: string | null
          port: number | null
          protocol: string | null
          source_ip: string | null
          threat_detected: boolean | null
          threat_type: string | null
          timestamp: string
        }
        Insert: {
          bytes_transferred?: number | null
          created_at?: string
          destination_ip?: string | null
          id?: string
          payload_summary?: string | null
          port?: number | null
          protocol?: string | null
          source_ip?: string | null
          threat_detected?: boolean | null
          threat_type?: string | null
          timestamp?: string
        }
        Update: {
          bytes_transferred?: number | null
          created_at?: string
          destination_ip?: string | null
          id?: string
          payload_summary?: string | null
          port?: number | null
          protocol?: string | null
          source_ip?: string | null
          threat_detected?: boolean | null
          threat_type?: string | null
          timestamp?: string
        }
        Relationships: []
      }
      otp_codes: {
        Row: {
          code: string
          created_at: string
          email: string
          expires_at: string
          id: string
          used: boolean | null
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          email: string
          expires_at: string
          id?: string
          used?: boolean | null
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          used?: boolean | null
          user_id?: string
        }
        Relationships: []
      }
      password_reset_tokens: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          token: string
          used: boolean | null
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          expires_at: string
          id?: string
          token: string
          used?: boolean | null
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          token?: string
          used?: boolean | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          badge_number: string | null
          clearance_level: Database["public"]["Enums"]["clearance_level"] | null
          created_at: string
          department: string | null
          email: string
          full_name: string
          id: string
          phone: string | null
          status: Database["public"]["Enums"]["user_status"] | null
          theme_preference: string | null
          two_factor_enabled: boolean | null
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          badge_number?: string | null
          clearance_level?:
            | Database["public"]["Enums"]["clearance_level"]
            | null
          created_at?: string
          department?: string | null
          email: string
          full_name: string
          id?: string
          phone?: string | null
          status?: Database["public"]["Enums"]["user_status"] | null
          theme_preference?: string | null
          two_factor_enabled?: boolean | null
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          badge_number?: string | null
          clearance_level?:
            | Database["public"]["Enums"]["clearance_level"]
            | null
          created_at?: string
          department?: string | null
          email?: string
          full_name?: string
          id?: string
          phone?: string | null
          status?: Database["public"]["Enums"]["user_status"] | null
          theme_preference?: string | null
          two_factor_enabled?: boolean | null
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      surveillance_logs: {
        Row: {
          created_at: string
          event_description: string | null
          event_type: string
          id: string
          location: string | null
          recorded_by: string | null
          related_alert_id: string | null
          subject: string | null
          timestamp: string
        }
        Insert: {
          created_at?: string
          event_description?: string | null
          event_type: string
          id?: string
          location?: string | null
          recorded_by?: string | null
          related_alert_id?: string | null
          subject?: string | null
          timestamp?: string
        }
        Update: {
          created_at?: string
          event_description?: string | null
          event_type?: string
          id?: string
          location?: string | null
          recorded_by?: string | null
          related_alert_id?: string | null
          subject?: string | null
          timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "surveillance_logs_related_alert_id_fkey"
            columns: ["related_alert_id"]
            isOneToOne: false
            referencedRelation: "threat_alerts"
            referencedColumns: ["id"]
          },
        ]
      }
      threat_alerts: {
        Row: {
          assigned_to: string | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          location: string | null
          severity: Database["public"]["Enums"]["alert_severity"] | null
          source: string | null
          status: Database["public"]["Enums"]["alert_status"] | null
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          location?: string | null
          severity?: Database["public"]["Enums"]["alert_severity"] | null
          source?: string | null
          status?: Database["public"]["Enums"]["alert_status"] | null
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          location?: string | null
          severity?: Database["public"]["Enums"]["alert_severity"] | null
          source?: string | null
          status?: Database["public"]["Enums"]["alert_status"] | null
          title?: string
          updated_at?: string
        }
        Relationships: []
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
      cleanup_expired_otps: { Args: never; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_analyst: { Args: { _user_id: string }; Returns: boolean }
      is_authorized: { Args: { _user_id: string }; Returns: boolean }
      is_viewer: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      agency_status: "active" | "inactive" | "pending"
      alert_severity: "critical" | "high" | "medium" | "low" | "info"
      alert_status: "new" | "investigating" | "resolved" | "dismissed"
      app_role: "admin" | "analyst" | "viewer"
      clearance_level: "top_secret" | "secret" | "confidential" | "unclassified"
      user_status: "active" | "inactive" | "suspended"
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
      agency_status: ["active", "inactive", "pending"],
      alert_severity: ["critical", "high", "medium", "low", "info"],
      alert_status: ["new", "investigating", "resolved", "dismissed"],
      app_role: ["admin", "analyst", "viewer"],
      clearance_level: ["top_secret", "secret", "confidential", "unclassified"],
      user_status: ["active", "inactive", "suspended"],
    },
  },
} as const
