export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type Table<Row, Insert, Update = Partial<Insert>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      allowed_emails: Table<
        { email: string; is_admin: boolean },
        { email: string; is_admin?: boolean }
      >;
      profiles: Table<
        { id: string; email: string; display_name: string; created_at: string },
        { id: string; email: string; display_name: string; created_at?: string }
      >;
      challenges: Table<
        {
          id: string;
          tier: "novice" | "challenger" | "elite" | "bonus";
          title: string;
          points: number;
          starts_on: string | null;
          ends_on: string | null;
          once_per_week: boolean;
          sort_order: number;
          active: boolean;
        },
        {
          id?: string;
          tier: "novice" | "challenger" | "elite" | "bonus";
          title: string;
          points: number;
          starts_on?: string | null;
          ends_on?: string | null;
          once_per_week?: boolean;
          sort_order?: number;
          active?: boolean;
        }
      >;
      competition_config: Table<
        {
          id: number;
          name: string;
          starts_on: string;
          ends_on: string;
          timezone: string;
        },
        {
          id?: number;
          name?: string;
          starts_on: string;
          ends_on: string;
          timezone?: string;
        }
      >;
      completions: Table<
        {
          id: string;
          user_id: string;
          challenge_id: string;
          competition_day: string;
          competition_week_start: string;
          is_weekly_completion: boolean;
          points_awarded: number;
          completed_at: string;
        },
        {
          id?: string;
          user_id: string;
          challenge_id: string;
          competition_day: string;
          competition_week_start?: string;
          is_weekly_completion?: boolean;
          points_awarded: number;
          completed_at?: string;
        }
      >;
    };
    Views: {
      daily_points: {
        Row: {
          user_id: string;
          competition_day: string;
          points: number;
        };
        Relationships: [];
      };
      leaderboard: {
        Row: { rank: number; user_id: string; display_name: string; total_points: number };
        Relationships: [];
      };
    };
    Functions: {
      sync_my_profile: { Args: Record<string, never>; Returns: boolean };
      admin_backfill_completions: {
        Args: {
          p_user_id: string;
          p_competition_day: string;
          p_challenge_ids: string[];
        };
        Returns: number;
      };
      leaderboard_for_day: {
        Args: { p_competition_day: string };
        Returns: {
          rank: number;
          user_id: string;
          display_name: string;
          today_points: number;
          total_points: number;
        }[];
      };
      is_admin: { Args: Record<string, never>; Returns: boolean };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
