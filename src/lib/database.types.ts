// Gerado a partir do schema do Supabase — não edite à mão.
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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          archived: boolean
          card_finals: string[]
          closing_day: number | null
          import_since: string | null
          color: string | null
          created_at: string
          credit_limit: number | null
          due_day: number | null
          id: string
          initial_balance: number
          name: string
          type: Database["public"]["Enums"]["account_type"]
          user_id: string
        }
        Insert: {
          archived?: boolean
          card_finals?: string[]
          closing_day?: number | null
          import_since?: string | null
          color?: string | null
          created_at?: string
          credit_limit?: number | null
          due_day?: number | null
          id?: string
          initial_balance?: number
          name: string
          type?: Database["public"]["Enums"]["account_type"]
          user_id?: string
        }
        Update: {
          archived?: boolean
          card_finals?: string[]
          closing_day?: number | null
          import_since?: string | null
          color?: string | null
          created_at?: string
          credit_limit?: number | null
          due_day?: number | null
          id?: string
          initial_balance?: number
          name?: string
          type?: Database["public"]["Enums"]["account_type"]
          user_id?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          archived: boolean
          color: string | null
          created_at: string
          icon: string | null
          id: string
          name: string
          parent_id: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
        }
        Insert: {
          archived?: boolean
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          parent_id?: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          user_id?: string
        }
        Update: {
          archived?: boolean
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          type?: Database["public"]["Enums"]["transaction_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_fkey"
            columns: ["parent_id", "user_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      import_items: {
        Row: {
          account_id: string | null
          amount: number
          bank_status: string | null
          card_final: string | null
          category_id: string | null
          date: string
          decided_at: string | null
          description: string
          external_id: string
          id: string
          installment_number: number | null
          installment_total: number | null
          invoice_month: string | null
          note: string | null
          operation: string | null
          purchase_date: string | null
          purchase_ref: string | null
          raw: Json
          received_at: string
          source: string
          status: string
          tags: string[]
          transaction_id: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          bank_status?: string | null
          card_final?: string | null
          category_id?: string | null
          date: string
          decided_at?: string | null
          description: string
          external_id: string
          id?: string
          installment_number?: number | null
          installment_total?: number | null
          invoice_month?: string | null
          note?: string | null
          operation?: string | null
          purchase_date?: string | null
          purchase_ref?: string | null
          raw: Json
          received_at?: string
          source?: string
          status?: string
          tags?: string[]
          transaction_id?: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          user_id?: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          bank_status?: string | null
          card_final?: string | null
          category_id?: string | null
          date?: string
          decided_at?: string | null
          description?: string
          external_id?: string
          id?: string
          installment_number?: number | null
          installment_total?: number | null
          invoice_month?: string | null
          note?: string | null
          operation?: string | null
          purchase_date?: string | null
          purchase_ref?: string | null
          raw?: Json
          received_at?: string
          source?: string
          status?: string
          tags?: string[]
          transaction_id?: string | null
          type?: Database["public"]["Enums"]["transaction_type"]
          user_id?: string
        }
        Relationships: []
      }
      import_tokens: {
        Row: {
          created_at: string
          id: string
          label: string
          last_used_at: string | null
          revoked_at: string | null
          token_hash: string
          token_hint: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string
          last_used_at?: string | null
          revoked_at?: string | null
          token_hash: string
          token_hint: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          last_used_at?: string | null
          revoked_at?: string | null
          token_hash?: string
          token_hint?: string
          user_id?: string
        }
        Relationships: []
      }
      tags: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
          user_id?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      transaction_tags: {
        Row: {
          tag_id: string
          transaction_id: string
          user_id: string
        }
        Insert: {
          tag_id: string
          transaction_id: string
          user_id?: string
        }
        Update: {
          tag_id?: string
          transaction_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_tags_tag_id_user_id_fkey"
            columns: ["tag_id", "user_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "transaction_tags_transaction_id_user_id_fkey"
            columns: ["transaction_id", "user_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      transactions: {
        Row: {
          account_id: string
          amount: number
          category_id: string
          created_at: string
          date: string
          description: string | null
          id: string
          installment_group: string | null
          installment_number: number | null
          installment_total: number | null
          invoice_month: string | null
          notes: string | null
          paid: boolean
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          amount: number
          category_id: string
          created_at?: string
          date?: string
          description?: string | null
          id?: string
          installment_group?: string | null
          installment_number?: number | null
          installment_total?: number | null
          invoice_month?: string | null
          notes?: string | null
          paid?: boolean
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          user_id?: string
        }
        Update: {
          account_id?: string
          amount?: number
          category_id?: string
          created_at?: string
          date?: string
          description?: string | null
          id?: string
          installment_group?: string | null
          installment_number?: number | null
          installment_total?: number | null
          invoice_month?: string | null
          notes?: string | null
          paid?: boolean
          type?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_user_id_fkey"
            columns: ["account_id", "user_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "transactions_category_id_user_id_fkey"
            columns: ["category_id", "user_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      transfers: {
        Row: {
          amount: number
          created_at: string
          date: string
          description: string | null
          from_account_id: string
          id: string
          invoice_month: string | null
          paid: boolean
          to_account_id: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          date?: string
          description?: string | null
          from_account_id: string
          id?: string
          invoice_month?: string | null
          paid?: boolean
          to_account_id: string
          user_id?: string
        }
        Update: {
          amount?: number
          created_at?: string
          date?: string
          description?: string | null
          from_account_id?: string
          id?: string
          invoice_month?: string | null
          paid?: boolean
          to_account_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transfers_from_account_id_user_id_fkey"
            columns: ["from_account_id", "user_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "transfers_to_account_id_user_id_fkey"
            columns: ["to_account_id", "user_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
    }
    Views: {
      account_balances: {
        Row: {
          account_id: string | null
          balance: number | null
          projected_balance: number | null
          user_id: string | null
        }
        Relationships: []
      }
      card_invoices: {
        Row: {
          account_id: string | null
          closing_date: string | null
          due_date: string | null
          invoice_month: string | null
          paid: number | null
          scheduled: number | null
          total: number | null
          transaction_count: number | null
          user_id: string | null
        }
        Relationships: []
      }
      category_usage: {
        Row: {
          category_id: string | null
          transaction_count: number | null
        }
        Relationships: []
      }
      import_items_review: {
        Row: {
          account_id: string | null
          amount: number | null
          bank_status: string | null
          card_final: string | null
          category_id: string | null
          date: string | null
          decided_at: string | null
          description: string | null
          external_id: string | null
          id: string | null
          installment_number: number | null
          installment_total: number | null
          invoice_month: string | null
          note: string | null
          operation: string | null
          possible_duplicate: boolean | null
          purchase_date: string | null
          purchase_ref: string | null
          raw: Json | null
          received_at: string | null
          source: string | null
          status: string | null
          tags: string[] | null
          transaction_id: string | null
          type: Database["public"]["Enums"]["transaction_type"] | null
          user_id: string | null
        }
        Relationships: []
      }
      tag_usage: {
        Row: {
          tag_id: string | null
          uses: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      approve_import_items: { Args: { p_ids: string[] }; Returns: number }
      create_import_token: { Args: { p_label?: string }; Returns: string }
      create_installment_purchase: {
        Args: {
          p_account_id: string
          p_amount: number
          p_category_id: string
          p_date: string
          p_description?: string
          p_first_invoice?: string
          p_installments: number
          p_notes?: string
          p_tags?: string[]
        }
        Returns: string
      }
      ingest_import_items: {
        Args: { p_items: Json; p_token: string }
        Returns: Json
      }
      report_by_category: {
        Args: {
          p_account_id?: string
          p_end: string
          p_paid_only?: boolean
          p_start: string
          p_tag_id?: string
          p_type: Database["public"]["Enums"]["transaction_type"]
        }
        Returns: { category_id: string; total: number; transaction_count: number }[]
      }
      report_by_tag: {
        Args: {
          p_account_id?: string
          p_end: string
          p_paid_only?: boolean
          p_start: string
          p_type: Database["public"]["Enums"]["transaction_type"]
        }
        Returns: { tag_id: string | null; total: number; transaction_count: number }[]
      }
      report_monthly: {
        Args: {
          p_account_id?: string
          p_basis?: string
          p_end: string
          p_paid_only?: boolean
          p_start: string
          p_tag_id?: string
        }
        Returns: { expense: number; income: number; month: string }[]
      }
      set_transaction_tags: {
        Args: { p_names: string[]; p_transaction_ids: string[] }
        Returns: undefined
      }
    }
    Enums: {
      account_type:
        | "checking"
        | "savings"
        | "cash"
        | "credit_card"
        | "investment"
        | "other"
      transaction_type: "income" | "expense"
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
    Enums: {
      account_type: [
        "checking",
        "savings",
        "cash",
        "credit_card",
        "investment",
        "other",
      ],
      transaction_type: ["income", "expense"],
    },
  },
} as const
