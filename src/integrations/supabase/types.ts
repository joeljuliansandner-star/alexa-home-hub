export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15";
  };
  public: {
    Tables: {
      activity_log: {
        Row: {
          created_at: string;
          id: string;
          message: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          message: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          message?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      alexa_connections: {
        Row: {
          access_token: string;
          account_email: string | null;
          account_name: string | null;
          amazon_user_id: string | null;
          created_at: string;
          expires_at: string;
          id: string;
          last_error: string | null;
          last_sync_at: string | null;
          refresh_token: string | null;
          scope: string | null;
          token_type: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          access_token: string;
          account_email?: string | null;
          account_name?: string | null;
          amazon_user_id?: string | null;
          created_at?: string;
          expires_at: string;
          id?: string;
          last_error?: string | null;
          last_sync_at?: string | null;
          refresh_token?: string | null;
          scope?: string | null;
          token_type?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          access_token?: string;
          account_email?: string | null;
          account_name?: string | null;
          amazon_user_id?: string | null;
          created_at?: string;
          expires_at?: string;
          id?: string;
          last_error?: string | null;
          last_sync_at?: string | null;
          refresh_token?: string | null;
          scope?: string | null;
          token_type?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      alexa_devices: {
        Row: {
          capabilities: Json;
          created_at: string;
          device_family: string | null;
          device_id: string;
          device_type: string | null;
          firmware_version: string | null;
          id: string;
          is_online: boolean;
          last_synced_at: string;
          name: string;
          raw_source: string | null;
          room: string | null;
          serial_number: string | null;
          software_version: string | null;
          unsupported_properties: Json;
          updated_at: string;
          user_id: string;
          wifi_status: string | null;
        };
        Insert: {
          capabilities?: Json;
          created_at?: string;
          device_family?: string | null;
          device_id: string;
          device_type?: string | null;
          firmware_version?: string | null;
          id?: string;
          is_online?: boolean;
          last_synced_at?: string;
          name: string;
          raw_source?: string | null;
          room?: string | null;
          serial_number?: string | null;
          software_version?: string | null;
          unsupported_properties?: Json;
          updated_at?: string;
          user_id: string;
          wifi_status?: string | null;
        };
        Update: {
          capabilities?: Json;
          created_at?: string;
          device_family?: string | null;
          device_id?: string;
          device_type?: string | null;
          firmware_version?: string | null;
          id?: string;
          is_online?: boolean;
          last_synced_at?: string;
          name?: string;
          raw_source?: string | null;
          room?: string | null;
          serial_number?: string | null;
          software_version?: string | null;
          unsupported_properties?: Json;
          updated_at?: string;
          user_id?: string;
          wifi_status?: string | null;
        };
        Relationships: [];
      };
      alexa_settings: {
        Row: {
          auto_sync: boolean;
          created_at: string;
          debug_mode: boolean;
          sync_interval_minutes: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          auto_sync?: boolean;
          created_at?: string;
          debug_mode?: boolean;
          sync_interval_minutes?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          auto_sync?: boolean;
          created_at?: string;
          debug_mode?: boolean;
          sync_interval_minutes?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      alexa_sync_log: {
        Row: {
          created_at: string;
          details: Json;
          duration_ms: number | null;
          endpoint: string;
          id: string;
          message: string | null;
          method: string;
          ok: boolean;
          status_code: number | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          details?: Json;
          duration_ms?: number | null;
          endpoint: string;
          id?: string;
          message?: string | null;
          method?: string;
          ok?: boolean;
          status_code?: number | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          details?: Json;
          duration_ms?: number | null;
          endpoint?: string;
          id?: string;
          message?: string | null;
          method?: string;
          ok?: boolean;
          status_code?: number | null;
          user_id?: string;
        };
        Relationships: [];
      };
      automations: {
        Row: {
          created_at: string;
          id: string;
          is_active: boolean;
          name: string;
          scene_id: string | null;
          trigger_type: string;
          trigger_value: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name: string;
          scene_id?: string | null;
          trigger_type?: string;
          trigger_value?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name?: string;
          scene_id?: string | null;
          trigger_type?: string;
          trigger_value?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "automations_scene_id_fkey";
            columns: ["scene_id"];
            isOneToOne: false;
            referencedRelation: "scenes";
            referencedColumns: ["id"];
          },
        ];
      };
      devices: {
        Row: {
          alexa_name: string | null;
          brightness: number;
          color: string | null;
          created_at: string;
          external_id: string | null;
          external_source: string | null;
          id: string;
          is_favorite: boolean;
          is_on: boolean;
          is_online: boolean;
          kind: Database["public"]["Enums"]["device_kind"];
          manufacturer: string | null;
          model: string | null;
          name: string;
          room_id: string | null;
          sensor_unit: string | null;
          sensor_value: number | null;
          sort_order: number;
          target_value: number | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          alexa_name?: string | null;
          brightness?: number;
          color?: string | null;
          created_at?: string;
          external_id?: string | null;
          external_source?: string | null;
          id?: string;
          is_favorite?: boolean;
          is_on?: boolean;
          is_online?: boolean;
          kind?: Database["public"]["Enums"]["device_kind"];
          manufacturer?: string | null;
          model?: string | null;
          name: string;
          room_id?: string | null;
          sensor_unit?: string | null;
          sensor_value?: number | null;
          sort_order?: number;
          target_value?: number | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          alexa_name?: string | null;
          brightness?: number;
          color?: string | null;
          created_at?: string;
          external_id?: string | null;
          external_source?: string | null;
          id?: string;
          is_favorite?: boolean;
          is_on?: boolean;
          is_online?: boolean;
          kind?: Database["public"]["Enums"]["device_kind"];
          manufacturer?: string | null;
          model?: string | null;
          name?: string;
          room_id?: string | null;
          sensor_unit?: string | null;
          sensor_value?: number | null;
          sort_order?: number;
          target_value?: number | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "devices_room_id_fkey";
            columns: ["room_id"];
            isOneToOne: false;
            referencedRelation: "rooms";
            referencedColumns: ["id"];
          },
        ];
      };
      ha_connections: {
        Row: {
          access_token: string;
          base_url: string;
          created_at: string;
          entity_count: number;
          ha_version: string | null;
          last_error: string | null;
          last_sync_at: string | null;
          location_name: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          access_token: string;
          base_url: string;
          created_at?: string;
          entity_count?: number;
          ha_version?: string | null;
          last_error?: string | null;
          last_sync_at?: string | null;
          location_name?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          access_token?: string;
          base_url?: string;
          created_at?: string;
          entity_count?: number;
          ha_version?: string | null;
          last_error?: string | null;
          last_sync_at?: string | null;
          location_name?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      rooms: {
        Row: {
          created_at: string;
          icon: string;
          id: string;
          name: string;
          sort_order: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          icon?: string;
          id?: string;
          name: string;
          sort_order?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          icon?: string;
          id?: string;
          name?: string;
          sort_order?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      scene_actions: {
        Row: {
          created_at: string;
          device_id: string;
          id: string;
          scene_id: string;
          set_brightness: number | null;
          set_on: boolean;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          device_id: string;
          id?: string;
          scene_id: string;
          set_brightness?: number | null;
          set_on?: boolean;
          user_id: string;
        };
        Update: {
          created_at?: string;
          device_id?: string;
          id?: string;
          scene_id?: string;
          set_brightness?: number | null;
          set_on?: boolean;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "scene_actions_device_id_fkey";
            columns: ["device_id"];
            isOneToOne: false;
            referencedRelation: "devices";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "scene_actions_scene_id_fkey";
            columns: ["scene_id"];
            isOneToOne: false;
            referencedRelation: "scenes";
            referencedColumns: ["id"];
          },
        ];
      };
      scenes: {
        Row: {
          created_at: string;
          description: string | null;
          icon: string;
          id: string;
          name: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          icon?: string;
          id?: string;
          name: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          icon?: string;
          id?: string;
          name?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      device_kind: "light" | "plug" | "thermostat" | "sensor" | "blind" | "speaker" | "vacuum";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      device_kind: ["light", "plug", "thermostat", "sensor", "blind", "speaker", "vacuum"],
    },
  },
} as const;
