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
      colaboradores: {
        Row: {
          ativo: boolean
          cargo: string | null
          cpf: string
          created_at: string
          email: string
          id: string
          loja_id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cargo?: string | null
          cpf: string
          created_at?: string
          email: string
          id?: string
          loja_id: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cargo?: string | null
          cpf?: string
          created_at?: string
          email?: string
          id?: string
          loja_id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "colaboradores_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      dispositivos: {
        Row: {
          created_at: string
          id: string
          imei1: string | null
          imei2: string | null
          marca: string
          modelo: string
          observacao: string | null
          serial_number: string | null
          status: Database["public"]["Enums"]["status_dispositivo"]
          tipo: Database["public"]["Enums"]["tipo_dispositivo"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          imei1?: string | null
          imei2?: string | null
          marca: string
          modelo: string
          observacao?: string | null
          serial_number?: string | null
          status?: Database["public"]["Enums"]["status_dispositivo"]
          tipo: Database["public"]["Enums"]["tipo_dispositivo"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          imei1?: string | null
          imei2?: string | null
          marca?: string
          modelo?: string
          observacao?: string | null
          serial_number?: string | null
          status?: Database["public"]["Enums"]["status_dispositivo"]
          tipo?: Database["public"]["Enums"]["tipo_dispositivo"]
          updated_at?: string
        }
        Relationships: []
      }
      lojas: {
        Row: {
          ativo: boolean
          cidade: string | null
          created_at: string
          id: string
          nome: string
        }
        Insert: {
          ativo?: boolean
          cidade?: string | null
          created_at?: string
          id?: string
          nome: string
        }
        Update: {
          ativo?: boolean
          cidade?: string | null
          created_at?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      vinculos: {
        Row: {
          colaborador_id: string
          created_at: string
          criado_por: string | null
          data_fim: string | null
          data_inicio: string
          dispositivo_id: string
          encerrado_por: string | null
          id: string
          loja_id: string
          observacao: string | null
          observacao_devolucao: string | null
          termo_path: string | null
        }
        Insert: {
          colaborador_id: string
          created_at?: string
          criado_por?: string | null
          data_fim?: string | null
          data_inicio?: string
          dispositivo_id: string
          encerrado_por?: string | null
          id?: string
          loja_id: string
          observacao?: string | null
          observacao_devolucao?: string | null
          termo_path?: string | null
        }
        Update: {
          colaborador_id?: string
          created_at?: string
          criado_por?: string | null
          data_fim?: string | null
          data_inicio?: string
          dispositivo_id?: string
          encerrado_por?: string | null
          id?: string
          loja_id?: string
          observacao?: string | null
          observacao_devolucao?: string | null
          termo_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vinculos_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vinculos_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "vw_dispositivos"
            referencedColumns: ["colaborador_id"]
          },
          {
            foreignKeyName: "vinculos_dispositivo_id_fkey"
            columns: ["dispositivo_id"]
            isOneToOne: false
            referencedRelation: "dispositivos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vinculos_dispositivo_id_fkey"
            columns: ["dispositivo_id"]
            isOneToOne: false
            referencedRelation: "vw_dispositivos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vinculos_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      vw_dispositivos: {
        Row: {
          colaborador_id: string | null
          colaborador_nome: string | null
          created_at: string | null
          id: string | null
          imei1: string | null
          imei2: string | null
          loja_id: string | null
          loja_nome: string | null
          marca: string | null
          modelo: string | null
          observacao: string | null
          serial_number: string | null
          status: Database["public"]["Enums"]["status_dispositivo"] | null
          termo_atual: string | null
          tipo: Database["public"]["Enums"]["tipo_dispositivo"] | null
          updated_at: string | null
          vinculado_em: string | null
          vinculo_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vinculos_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      anexar_termo: {
        Args: { p_termo_path: string; p_vinculo_id: string }
        Returns: undefined
      }
      devolver_dispositivo: {
        Args: {
          p_dispositivo_id: string
          p_novo_status?: Database["public"]["Enums"]["status_dispositivo"]
          p_observacao?: string
        }
        Returns: undefined
      }
      vincular_dispositivo: {
        Args: {
          p_colaborador_id: string
          p_dispositivo_id: string
          p_observacao?: string
          p_termo_path?: string
        }
        Returns: string
      }
    }
    Enums: {
      status_dispositivo: "disponivel" | "em_uso" | "manutencao" | "baixado"
      tipo_dispositivo: "notebook" | "telefone"
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
      status_dispositivo: ["disponivel", "em_uso", "manutencao", "baixado"],
      tipo_dispositivo: ["notebook", "telefone"],
    },
  },
} as const
