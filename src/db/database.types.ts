export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: { Args: { extensions?: Json; operationName?: string; query?: string; variables?: Json }; Returns: Json };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      game_masters: {
        Row: {
          accepted_at: string | null;
          offered_at: string;
          offered_by: string | null;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          accepted_at?: string | null;
          offered_at?: string;
          offered_by?: string | null;
          user_id: string;
        };
        Update: {
          accepted_at?: string | null;
          offered_at?: string;
          offered_by?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      game_message_reads: {
        Row: {
          game_id: string;
          player_index: number;
          reads: NonNullable<Json>;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          game_id: string;
          player_index: number;
          reads?: NonNullable<Json>;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          game_id?: string;
          player_index?: number;
          reads?: NonNullable<Json>;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      game_messages: {
        Row: {
          body: string;
          created_at: string;
          from_index: number;
          from_user_id: string;
          game_id: string;
          id: number;
          scope: string;
          to_indexes: number[];
          turn: number | null;
        };
        ComputedFields: never;
        Insert: {
          body: string;
          created_at?: string;
          from_index: number;
          from_user_id?: string;
          game_id: string;
          id?: number;
          scope?: string;
          to_indexes?: number[];
          turn?: number | null;
        };
        Update: {
          body?: string;
          created_at?: string;
          from_index?: number;
          from_user_id?: string;
          game_id?: string;
          id?: number;
          scope?: string;
          to_indexes?: number[];
          turn?: number | null;
        };
        Relationships: [];
      };
      game_players: {
        Row: {
          created_at: string | null;
          display_name: string;
          game_id: string;
          id: string;
          invite_code: string | null;
          last_submitted_at: string | null;
          orders: Json | null;
          orders_submitted: boolean;
          player_index: number;
          turn_report: Json | null;
          user_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string | null;
          display_name: string;
          game_id: string;
          id?: string;
          invite_code?: string | null;
          last_submitted_at?: string | null;
          orders?: Json | null;
          orders_submitted?: boolean;
          player_index: number;
          turn_report?: Json | null;
          user_id?: string | null;
        };
        Update: {
          created_at?: string | null;
          display_name?: string;
          game_id?: string;
          id?: string;
          invite_code?: string | null;
          last_submitted_at?: string | null;
          orders?: Json | null;
          orders_submitted?: boolean;
          player_index?: number;
          turn_report?: Json | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'game_players_game_id_fkey';
            columns: ['game_id'];
            isOneToOne: false;
            referencedRelation: 'games';
            referencedColumns: ['id'];
          },
        ];
      };
      game_records: {
        Row: {
          build: string | null;
          created_at: string;
          finished_at: string | null;
          game_id: string;
          game_name: string | null;
          gm_user_id: string | null;
          hidden: boolean;
          note: string | null;
          records: Json | null;
          setup: Json | null;
          standings: Json | null;
          started_at: string | null;
          totals: Json | null;
          turns: number | null;
          victory: string | null;
          winner_is_bot: boolean | null;
          winner_player: string | null;
          winner_realm: string | null;
        };
        ComputedFields: never;
        Insert: {
          build?: string | null;
          created_at?: string;
          finished_at?: string | null;
          game_id: string;
          game_name?: string | null;
          gm_user_id?: string | null;
          hidden?: boolean;
          note?: string | null;
          records?: Json | null;
          setup?: Json | null;
          standings?: Json | null;
          started_at?: string | null;
          totals?: Json | null;
          turns?: number | null;
          victory?: string | null;
          winner_is_bot?: boolean | null;
          winner_player?: string | null;
          winner_realm?: string | null;
        };
        Update: {
          build?: string | null;
          created_at?: string;
          finished_at?: string | null;
          game_id?: string;
          game_name?: string | null;
          gm_user_id?: string | null;
          hidden?: boolean;
          note?: string | null;
          records?: Json | null;
          setup?: Json | null;
          standings?: Json | null;
          started_at?: string | null;
          totals?: Json | null;
          turns?: number | null;
          victory?: string | null;
          winner_is_bot?: boolean | null;
          winner_player?: string | null;
          winner_realm?: string | null;
        };
        Relationships: [];
      };
      game_results: {
        Row: {
          alignment: string | null;
          bot_difficulty: string | null;
          build: string | null;
          created_at: string;
          final: Json | null;
          game_id: string;
          game_name: string | null;
          id: number;
          is_bot: boolean;
          out_how: string | null;
          out_turn: number | null;
          player_index: number;
          race: string | null;
          rank: number | null;
          realm: string | null;
          score: number | null;
          setup: Json | null;
          turns: number | null;
          victory: string | null;
          winner: boolean;
        };
        ComputedFields: never;
        Insert: {
          alignment?: string | null;
          bot_difficulty?: string | null;
          build?: string | null;
          created_at?: string;
          final?: Json | null;
          game_id: string;
          game_name?: string | null;
          id?: number;
          is_bot?: boolean;
          out_how?: string | null;
          out_turn?: number | null;
          player_index: number;
          race?: string | null;
          rank?: number | null;
          realm?: string | null;
          score?: number | null;
          setup?: Json | null;
          turns?: number | null;
          victory?: string | null;
          winner?: boolean;
        };
        Update: {
          alignment?: string | null;
          bot_difficulty?: string | null;
          build?: string | null;
          created_at?: string;
          final?: Json | null;
          game_id?: string;
          game_name?: string | null;
          id?: number;
          is_bot?: boolean;
          out_how?: string | null;
          out_turn?: number | null;
          player_index?: number;
          race?: string | null;
          rank?: number | null;
          realm?: string | null;
          score?: number | null;
          setup?: Json | null;
          turns?: number | null;
          victory?: string | null;
          winner?: boolean;
        };
        Relationships: [];
      };
      games: {
        Row: {
          block_eliminated_msgs: boolean;
          created_at: string | null;
          game_state: Json | null;
          gm_user_id: string | null;
          id: string;
          max_players: number;
          max_turns: number;
          meta: Json | null;
          name: string;
          status: string;
          turn: number;
          updated_at: string | null;
        };
        ComputedFields: never;
        Insert: {
          block_eliminated_msgs?: boolean;
          created_at?: string | null;
          game_state?: Json | null;
          gm_user_id?: string | null;
          id?: string;
          max_players?: number;
          max_turns?: number;
          meta?: Json | null;
          name: string;
          status?: string;
          turn?: number;
          updated_at?: string | null;
        };
        Update: {
          block_eliminated_msgs?: boolean;
          created_at?: string | null;
          game_state?: Json | null;
          gm_user_id?: string | null;
          id?: string;
          max_players?: number;
          max_turns?: number;
          meta?: Json | null;
          name?: string;
          status?: string;
          turn?: number;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      message_reports: {
        Row: {
          created_at: string;
          game_id: string;
          id: number;
          message_id: number;
          reason: string | null;
          reporter_index: number;
          reporter_user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          game_id: string;
          id?: never;
          message_id: number;
          reason?: string | null;
          reporter_index: number;
          reporter_user_id?: string;
        };
        Update: {
          created_at?: string;
          game_id?: string;
          id?: never;
          message_id?: number;
          reason?: string | null;
          reporter_index?: number;
          reporter_user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'message_reports_message_id_fkey';
            columns: ['message_id'];
            isOneToOne: false;
            referencedRelation: 'game_messages';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string | null;
          email: string | null;
          id: string;
          name: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string | null;
          email?: string | null;
          id: string;
          name?: string | null;
        };
        Update: {
          created_at?: string | null;
          email?: string | null;
          id?: string;
          name?: string | null;
        };
        Relationships: [];
      };
      site_admins: {
        Row: {
          one: boolean;
          since: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          one?: boolean;
          since?: string;
          user_id: string;
        };
        Update: {
          one?: boolean;
          since?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      turn_events: {
        Row: {
          alignment: string | null;
          bot_difficulty: string | null;
          build: string | null;
          created_at: string;
          game_id: string;
          id: number;
          is_bot: boolean;
          orders: Json | null;
          outcomes: Json | null;
          player_index: number;
          post: Json | null;
          pre: Json | null;
          race: string | null;
          realm: string | null;
          turn: number;
        };
        ComputedFields: never;
        Insert: {
          alignment?: string | null;
          bot_difficulty?: string | null;
          build?: string | null;
          created_at?: string;
          game_id: string;
          id?: number;
          is_bot?: boolean;
          orders?: Json | null;
          outcomes?: Json | null;
          player_index: number;
          post?: Json | null;
          pre?: Json | null;
          race?: string | null;
          realm?: string | null;
          turn: number;
        };
        Update: {
          alignment?: string | null;
          bot_difficulty?: string | null;
          build?: string | null;
          created_at?: string;
          game_id?: string;
          id?: number;
          is_bot?: boolean;
          orders?: Json | null;
          outcomes?: Json | null;
          player_index?: number;
          post?: Json | null;
          pre?: Json | null;
          race?: string | null;
          realm?: string | null;
          turn?: number;
        };
        Relationships: [];
      };
      turn_logs: {
        Row: {
          created_at: string | null;
          entries: NonNullable<Json>;
          game_id: string;
          id: string;
          player_index: number;
          turn: number;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string | null;
          entries?: NonNullable<Json>;
          game_id: string;
          id?: string;
          player_index: number;
          turn: number;
        };
        Update: {
          created_at?: string | null;
          entries?: NonNullable<Json>;
          game_id?: string;
          id?: string;
          player_index?: number;
          turn?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'turn_logs_game_id_fkey';
            columns: ['game_id'];
            isOneToOne: false;
            referencedRelation: 'games';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      account_delete: { Args: { p_user: string }; Returns: undefined };
      account_suspend: { Args: { p_until: string; p_user: string }; Returns: undefined };
      account_unsuspend: { Args: { p_user: string }; Returns: undefined };
      game_exists: { Args: { p_game: string }; Returns: boolean };
      game_gm: { Args: { p_game: string }; Returns: string };
      get_game_slots: {
        Args: { p_games: string[] };
        Returns: {
          alignment: string;
          game_id: string;
          is_bot: boolean;
          orders_submitted: boolean;
          player_index: number;
        }[];
      };
      gm_accept_offer: { Args: Record<PropertyKey, never>; Returns: undefined };
      gm_decline_offer: { Args: Record<PropertyKey, never>; Returns: undefined };
      gm_offer: { Args: { p_user: string }; Returns: undefined };
      gm_reported_messages: {
        Args: { p_game: string };
        Returns: {
          body: string;
          from_index: number;
          game_id: string;
          message_id: number;
          reason: string;
          report_id: number;
          reported_at: string;
          reporter_index: number;
          scope: string;
          sent_at: string;
          to_indexes: number[];
          turn: number;
        }[];
      };
      gm_revoke: { Args: { p_user: string }; Returns: undefined };
      gm_withdraw_offer: { Args: { p_user: string }; Returns: undefined };
      is_game_gm: { Args: { p_game: string }; Returns: boolean };
      is_game_master: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_game_member: { Args: { p_game: string }; Returns: boolean };
      is_reported_to_caller: { Args: { p_message: number }; Returns: boolean };
      is_site_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      kc_db_version: { Args: Record<PropertyKey, never>; Returns: string };
      kc_set_overlord: { Args: { p_email: string; p_replace?: boolean }; Returns: string };
      overlord_accounts: {
        Args: Record<PropertyKey, never>;
        Returns: {
          email: string;
          games_played: number;
          games_run: number;
          gm_status: string;
          joined: string;
          last_sign_in: string;
          name: string;
          suspended_until: string;
          user_id: string;
        }[];
      };
      reassign_game: { Args: { p_game: string; p_new_gm: string }; Returns: undefined };
      rename_player: { Args: { p_name: string; p_user: string }; Returns: undefined };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    keyof (DefaultSchema['Tables'] & DefaultSchema['Views']) | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const;
