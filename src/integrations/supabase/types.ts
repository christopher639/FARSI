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
      audit_logs: {
        Row: {
          action: string
          actor: string
          created_at: string
          id: string
          metadata: Json | null
          role: string | null
          target: string | null
        }
        Insert: {
          action: string
          actor: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role?: string | null
          target?: string | null
        }
        Update: {
          action?: string
          actor?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role?: string | null
          target?: string | null
        }
        Relationships: []
      }
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
      crime_events: {
        Row: {
          context: string | null
          created_at: string
          crime_id: string | null
          crime_type: string | null
          falls_within: string | null
          geo: Json | null
          id: string
          last_outcome_category: string | null
          latitude: number | null
          location: string | null
          longitude: number | null
          lsoa_code: string | null
          lsoa_name: string | null
          month: string | null
          record_hash: string | null
          reported_by: string | null
        }
        Insert: {
          context?: string | null
          created_at?: string
          crime_id?: string | null
          crime_type?: string | null
          falls_within?: string | null
          geo?: Json | null
          id?: string
          last_outcome_category?: string | null
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          lsoa_code?: string | null
          lsoa_name?: string | null
          month?: string | null
          record_hash?: string | null
          reported_by?: string | null
        }
        Update: {
          context?: string | null
          created_at?: string
          crime_id?: string | null
          crime_type?: string | null
          falls_within?: string | null
          geo?: Json | null
          id?: string
          last_outcome_category?: string | null
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          lsoa_code?: string | null
          lsoa_name?: string | null
          month?: string | null
          record_hash?: string | null
          reported_by?: string | null
        }
        Relationships: []
      }
      entity_edges: {
        Row: {
          created_at: string
          id: string
          properties: Json | null
          relationship: string | null
          source_id: string | null
          target_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          properties?: Json | null
          relationship?: string | null
          source_id?: string | null
          target_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          properties?: Json | null
          relationship?: string | null
          source_id?: string | null
          target_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "entity_edges_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "entity_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_edges_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "entity_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_nodes: {
        Row: {
          created_at: string
          entity_type: string | null
          id: string
          label: string
          properties: Json | null
        }
        Insert: {
          created_at?: string
          entity_type?: string | null
          id?: string
          label: string
          properties?: Json | null
        }
        Update: {
          created_at?: string
          entity_type?: string | null
          id?: string
          label?: string
          properties?: Json | null
        }
        Relationships: []
      }
      ingestion_events: {
        Row: {
          created_at: string
          description: string | null
          entities: Json | null
          event_type: string
          id: string
          last_inference_at: string | null
          location: Json | null
          media_path: string | null
          modality: string | null
          processed_at: string | null
          provenance: Json | null
          severity: string | null
          tags: string[] | null
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          entities?: Json | null
          event_type: string
          id?: string
          last_inference_at?: string | null
          location?: Json | null
          media_path?: string | null
          modality?: string | null
          processed_at?: string | null
          provenance?: Json | null
          severity?: string | null
          tags?: string[] | null
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          entities?: Json | null
          event_type?: string
          id?: string
          last_inference_at?: string | null
          location?: Json | null
          media_path?: string | null
          modality?: string | null
          processed_at?: string | null
          provenance?: Json | null
          severity?: string | null
          tags?: string[] | null
          title?: string
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
      login_sessions: {
        Row: {
          created_at: string
          device_fingerprint: string | null
          id: string
          ip_address: string | null
          is_new_device: boolean | null
          location: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          device_fingerprint?: string | null
          id?: string
          ip_address?: string | null
          is_new_device?: boolean | null
          location?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          device_fingerprint?: string | null
          id?: string
          ip_address?: string | null
          is_new_device?: boolean | null
          location?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      ml_inference_results: {
        Row: {
          created_at: string
          event_id: string | null
          id: string
          model_id: string | null
          result: Json
        }
        Insert: {
          created_at?: string
          event_id?: string | null
          id?: string
          model_id?: string | null
          result: Json
        }
        Update: {
          created_at?: string
          event_id?: string | null
          id?: string
          model_id?: string | null
          result?: Json
        }
        Relationships: [
          {
            foreignKeyName: "ml_inference_results_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "ingestion_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ml_inference_results_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "ml_models"
            referencedColumns: ["id"]
          },
        ]
      }
      ml_models: {
        Row: {
          created_at: string
          framework: string
          id: string
          metadata: Json | null
          model_type: string
          name: string
          version: string
        }
        Insert: {
          created_at?: string
          framework: string
          id?: string
          metadata?: Json | null
          model_type: string
          name: string
          version: string
        }
        Update: {
          created_at?: string
          framework?: string
          id?: string
          metadata?: Json | null
          model_type?: string
          name?: string
          version?: string
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
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          read: boolean
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          read?: boolean
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          read?: boolean
          title?: string
          user_id?: string
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
          biometric_counter: number | null
          biometric_credential_id: string | null
          biometric_enabled: boolean | null
          biometric_mandatory: boolean | null
          biometric_public_key: string | null
          clearance_level: Database["public"]["Enums"]["clearance_level"] | null
          created_at: string
          department: string | null
          email: string
          full_name: string
          id: string
          phone: string | null
          status: Database["public"]["Enums"]["user_status"] | null
          theme_preference: string | null
          totp_enabled: boolean | null
          totp_secret: string | null
          two_factor_enabled: boolean | null
          two_factor_method: string | null
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          badge_number?: string | null
          biometric_counter?: number | null
          biometric_credential_id?: string | null
          biometric_enabled?: boolean | null
          biometric_mandatory?: boolean | null
          biometric_public_key?: string | null
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
          totp_enabled?: boolean | null
          totp_secret?: string | null
          two_factor_enabled?: boolean | null
          two_factor_method?: string | null
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          badge_number?: string | null
          biometric_counter?: number | null
          biometric_credential_id?: string | null
          biometric_enabled?: boolean | null
          biometric_mandatory?: boolean | null
          biometric_public_key?: string | null
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
          totp_enabled?: boolean | null
          totp_secret?: string | null
          two_factor_enabled?: boolean | null
          two_factor_method?: string | null
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      surveillance_frames: {
        Row: {
          captured_at: string
          created_at: string
          detections: Json | null
          id: string
          storage_path: string | null
          stream_id: string | null
        }
        Insert: {
          captured_at?: string
          created_at?: string
          detections?: Json | null
          id?: string
          storage_path?: string | null
          stream_id?: string | null
        }
        Update: {
          captured_at?: string
          created_at?: string
          detections?: Json | null
          id?: string
          storage_path?: string | null
          stream_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "surveillance_frames_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "surveillance_streams"
            referencedColumns: ["id"]
          },
        ]
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
      surveillance_streams: {
        Row: {
          created_at: string
          id: string
          last_heartbeat: string | null
          name: string
          rtsp_url: string | null
          status: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          last_heartbeat?: string | null
          name: string
          rtsp_url?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          last_heartbeat?: string | null
          name?: string
          rtsp_url?: string | null
          status?: string | null
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          setting_key: string
          setting_value: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          setting_key: string
          setting_value?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          setting_key?: string
          setting_value?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
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
      threat_heatmap_cells: {
        Row: {
          created_at: string
          id: string
          lat: number
          lon: number
          score: number
          window_end: string
          window_start: string
        }
        Insert: {
          created_at?: string
          id?: string
          lat: number
          lon: number
          score: number
          window_end: string
          window_start: string
        }
        Update: {
          created_at?: string
          id?: string
          lat?: number
          lon?: number
          score?: number
          window_end?: string
          window_start?: string
        }
        Relationships: []
      }
      user_invitations: {
        Row: {
          accepted_at: string | null
          clearance_level: Database["public"]["Enums"]["clearance_level"]
          created_at: string
          department: string | null
          email: string
          expires_at: string
          id: string
          invited_by: string
          role: Database["public"]["Enums"]["app_role"]
          token: string
        }
        Insert: {
          accepted_at?: string | null
          clearance_level?: Database["public"]["Enums"]["clearance_level"]
          created_at?: string
          department?: string | null
          email: string
          expires_at: string
          id?: string
          invited_by: string
          role?: Database["public"]["Enums"]["app_role"]
          token: string
        }
        Update: {
          accepted_at?: string | null
          clearance_level?: Database["public"]["Enums"]["clearance_level"]
          created_at?: string
          department?: string | null
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          role?: Database["public"]["Enums"]["app_role"]
          token?: string
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
