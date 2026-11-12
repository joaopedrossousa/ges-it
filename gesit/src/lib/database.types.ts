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
      auditoria: {
        Row: {
          acao: string
          alterado_em: string
          alterado_por: string | null
          antes: Json | null
          campos_alterados: string[]
          depois: Json | null
          id: number
          registro_id: string
          tabela: string
        }
        Insert: {
          acao: string
          alterado_em?: string
          alterado_por?: string | null
          antes?: Json | null
          campos_alterados?: string[]
          depois?: Json | null
          id?: number
          registro_id: string
          tabela: string
        }
        Update: {
          acao?: string
          alterado_em?: string
          alterado_por?: string | null
          antes?: Json | null
          campos_alterados?: string[]
          depois?: Json | null
          id?: number
          registro_id?: string
          tabela?: string
        }
        Relationships: []
      }
      colaboradores: {
        Row: {
          ativo: boolean
          cargo: string | null
          cpf: string | null
          created_at: string
          email: string | null
          id: string
          loja_id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cargo?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          id?: string
          loja_id: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cargo?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
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
          data_compra: string | null
          fim_vida_util: string | null
          id: string
          imei1: string | null
          imei2: string | null
          loja_estoque_id: string | null
          marca: string
          modelo: string
          nota_fiscal_path: string | null
          numero_linha: string | null
          numero_patrimonio: string | null
          observacao: string | null
          operadora: string | null
          serial_number: string | null
          status: Database["public"]["Enums"]["status_dispositivo"]
          tipo: Database["public"]["Enums"]["tipo_dispositivo"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_compra?: string | null
          fim_vida_util?: string | null
          id?: string
          imei1?: string | null
          imei2?: string | null
          loja_estoque_id?: string | null
          marca: string
          modelo: string
          nota_fiscal_path?: string | null
          numero_linha?: string | null
          numero_patrimonio?: string | null
          observacao?: string | null
          operadora?: string | null
          serial_number?: string | null
          status?: Database["public"]["Enums"]["status_dispositivo"]
          tipo: Database["public"]["Enums"]["tipo_dispositivo"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_compra?: string | null
          fim_vida_util?: string | null
          id?: string
          imei1?: string | null
          imei2?: string | null
          loja_estoque_id?: string | null
          marca?: string
          modelo?: string
          nota_fiscal_path?: string | null
          numero_linha?: string | null
          numero_patrimonio?: string | null
          observacao?: string | null
          operadora?: string | null
          serial_number?: string | null
          status?: Database["public"]["Enums"]["status_dispositivo"]
          tipo?: Database["public"]["Enums"]["tipo_dispositivo"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispositivos_loja_estoque_id_fkey"
            columns: ["loja_estoque_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
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
      servicos: {
        Row: {
          anexo_path: string | null
          created_at: string
          criado_por: string | null
          custo: number | null
          data_servico: string
          descricao: string | null
          dispositivo_id: string
          fornecedor: string | null
          id: string
          na_garantia: boolean
          tipo: Database["public"]["Enums"]["tipo_servico"]
          updated_at: string
        }
        Insert: {
          anexo_path?: string | null
          created_at?: string
          criado_por?: string | null
          custo?: number | null
          data_servico: string
          descricao?: string | null
          dispositivo_id: string
          fornecedor?: string | null
          id?: string
          na_garantia?: boolean
          tipo: Database["public"]["Enums"]["tipo_servico"]
          updated_at?: string
        }
        Update: {
          anexo_path?: string | null
          created_at?: string
          criado_por?: string | null
          custo?: number | null
          data_servico?: string
          descricao?: string | null
          dispositivo_id?: string
          fornecedor?: string | null
          id?: string
          na_garantia?: boolean
          tipo?: Database["public"]["Enums"]["tipo_servico"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "servicos_dispositivo_id_fkey"
            columns: ["dispositivo_id"]
            isOneToOne: false
            referencedRelation: "dispositivos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servicos_dispositivo_id_fkey"
            columns: ["dispositivo_id"]
            isOneToOne: false
            referencedRelation: "vw_dispositivos"
            referencedColumns: ["id"]
          },
        ]
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
          formatado_devolucao: boolean | null
          formatado_entrega: boolean | null
          id: string
          loja_id: string
          observacao: string | null
          observacao_devolucao: string | null
          perifericos_devolucao: string[] | null
          perifericos_entrega: string[]
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
          formatado_devolucao?: boolean | null
          formatado_entrega?: boolean | null
          id?: string
          loja_id: string
          observacao?: string | null
          observacao_devolucao?: string | null
          perifericos_devolucao?: string[] | null
          perifericos_entrega?: string[]
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
          formatado_devolucao?: boolean | null
          formatado_entrega?: boolean | null
          id?: string
          loja_id?: string
          observacao?: string | null
          observacao_devolucao?: string | null
          perifericos_devolucao?: string[] | null
          perifericos_entrega?: string[]
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
      vw_ativos_por_filial: {
        Row: {
          em_estoque: number | null
          em_uso: number | null
          loja_ativa: boolean | null
          loja_id: string | null
          loja_nome: string | null
          tipo: Database["public"]["Enums"]["tipo_dispositivo"] | null
        }
        Relationships: []
      }
      vw_dispositivos: {
        Row: {
          colaborador_id: string | null
          colaborador_nome: string | null
          created_at: string | null
          data_compra: string | null
          fim_vida_util: string | null
          id: string | null
          idade_meses: number | null
          imei1: string | null
          imei2: string | null
          loja_atual_id: string | null
          loja_atual_nome: string | null
          loja_estoque_id: string | null
          loja_estoque_nome: string | null
          loja_id: string | null
          loja_nome: string | null
          marca: string | null
          modelo: string | null
          nota_fiscal_path: string | null
          numero_linha: string | null
          numero_patrimonio: string | null
          observacao: string | null
          operadora: string | null
          serial_number: string | null
          situacao_vida_util: string | null
          status: Database["public"]["Enums"]["status_dispositivo"] | null
          termo_atual: string | null
          tipo: Database["public"]["Enums"]["tipo_dispositivo"] | null
          updated_at: string | null
          vinculado_em: string | null
          vinculo_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dispositivos_loja_estoque_id_fkey"
            columns: ["loja_estoque_id"]
            isOneToOne: false
            referencedRelation: "lojas"
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
      vw_servicos: {
        Row: {
          anexo_path: string | null
          colaborador_id: string | null
          colaborador_nome: string | null
          created_at: string | null
          criado_por: string | null
          custo: number | null
          data_servico: string | null
          descricao: string | null
          dispositivo_id: string | null
          dispositivo_tipo:
            | Database["public"]["Enums"]["tipo_dispositivo"]
            | null
          fornecedor: string | null
          id: string | null
          imei1: string | null
          loja_id: string | null
          loja_nome: string | null
          marca: string | null
          modelo: string | null
          na_garantia: boolean | null
          numero_patrimonio: string | null
          serial_number: string | null
          tipo: Database["public"]["Enums"]["tipo_servico"] | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "servicos_dispositivo_id_fkey"
            columns: ["dispositivo_id"]
            isOneToOne: false
            referencedRelation: "dispositivos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servicos_dispositivo_id_fkey"
            columns: ["dispositivo_id"]
            isOneToOne: false
            referencedRelation: "vw_dispositivos"
            referencedColumns: ["id"]
          },
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
          p_formatado?: boolean
          p_loja_estoque_id?: string
          p_novo_status?: Database["public"]["Enums"]["status_dispositivo"]
          p_observacao?: string
          p_perifericos_devolvidos?: string[]
        }
        Returns: undefined
      }
      emails_operadores: {
        Args: { p_ids: string[] }
        Returns: {
          email: string
          id: string
        }[]
      }
      mascarar_cpf_auditoria: { Args: { p_cpf: string }; Returns: Json }
      normalizar_perifericos: {
        Args: {
          p_formatado: boolean
          p_perifericos: string[]
          p_tipo: Database["public"]["Enums"]["tipo_dispositivo"]
        }
        Returns: string[]
      }
      ping: { Args: never; Returns: number }
      usuarios_auditoria: {
        Args: never
        Returns: {
          email: string
          id: string
        }[]
      }
      vincular_dispositivo: {
        Args: {
          p_colaborador_id: string
          p_dispositivo_id: string
          p_formatado?: boolean
          p_observacao?: string
          p_perifericos?: string[]
          p_termo_path?: string
        }
        Returns: string
      }
    }
    Enums: {
      status_dispositivo: "disponivel" | "em_uso" | "manutencao" | "baixado"
      tipo_dispositivo: "notebook" | "telefone" | "monitor"
      tipo_servico:
        | "formatacao"
        | "troca_tela"
        | "troca_bateria"
        | "troca_teclado"
        | "limpeza"
        | "reparo_placa"
        | "atualizacao_sistema"
        | "outro"
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
      tipo_dispositivo: ["notebook", "telefone", "monitor"],
      tipo_servico: [
        "formatacao",
        "troca_tela",
        "troca_bateria",
        "troca_teclado",
        "limpeza",
        "reparo_placa",
        "atualizacao_sistema",
        "outro",
      ],
    },
  },
} as const
