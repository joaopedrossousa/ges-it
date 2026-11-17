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
      dispositivo_baixa_anexos: {
        Row: {
          baixa_id: string
          created_at: string
          id: string
          nome_arquivo: string
          path: string
        }
        Insert: {
          baixa_id: string
          created_at?: string
          id?: string
          nome_arquivo: string
          path: string
        }
        Update: {
          baixa_id?: string
          created_at?: string
          id?: string
          nome_arquivo?: string
          path?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispositivo_baixa_anexos_baixa_id_fkey"
            columns: ["baixa_id"]
            isOneToOne: false
            referencedRelation: "dispositivo_baixas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispositivo_baixa_anexos_baixa_id_fkey"
            columns: ["baixa_id"]
            isOneToOne: false
            referencedRelation: "vw_dispositivo_baixas"
            referencedColumns: ["id"]
          },
        ]
      }
      dispositivo_baixas: {
        Row: {
          created_at: string
          criado_por: string | null
          data_baixa: string
          dispositivo_id: string
          id: string
          informacoes: string
          motivo: Database["public"]["Enums"]["motivo_baixa"]
        }
        Insert: {
          created_at?: string
          criado_por?: string | null
          data_baixa: string
          dispositivo_id: string
          id?: string
          informacoes: string
          motivo: Database["public"]["Enums"]["motivo_baixa"]
        }
        Update: {
          created_at?: string
          criado_por?: string | null
          data_baixa?: string
          dispositivo_id?: string
          id?: string
          informacoes?: string
          motivo?: Database["public"]["Enums"]["motivo_baixa"]
        }
        Relationships: [
          {
            foreignKeyName: "dispositivo_baixas_dispositivo_id_fkey"
            columns: ["dispositivo_id"]
            isOneToOne: true
            referencedRelation: "dispositivos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispositivo_baixas_dispositivo_id_fkey"
            columns: ["dispositivo_id"]
            isOneToOne: true
            referencedRelation: "vw_dispositivos"
            referencedColumns: ["id"]
          },
        ]
      }
      dispositivos: {
        Row: {
          created_at: string
          data_compra: string | null
          equipamento: string | null
          fim_vida_util: string | null
          id: string
          imei1: string | null
          imei2: string | null
          loja_estoque_id: string | null
          marca: string | null
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
          equipamento?: string | null
          fim_vida_util?: string | null
          id?: string
          imei1?: string | null
          imei2?: string | null
          loja_estoque_id?: string | null
          marca?: string | null
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
          equipamento?: string | null
          fim_vida_util?: string | null
          id?: string
          imei1?: string | null
          imei2?: string | null
          loja_estoque_id?: string | null
          marca?: string | null
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
      kanban_atividade_categorias: {
        Row: {
          atividade_id: string
          categoria_id: string
        }
        Insert: {
          atividade_id: string
          categoria_id: string
        }
        Update: {
          atividade_id?: string
          categoria_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kanban_atividade_categorias_atividade_id_fkey"
            columns: ["atividade_id"]
            isOneToOne: false
            referencedRelation: "kanban_atividades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kanban_atividade_categorias_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "kanban_categorias"
            referencedColumns: ["id"]
          },
        ]
      }
      kanban_atividades: {
        Row: {
          arquivada: boolean
          coluna_id: string
          created_at: string
          criado_por: string | null
          descricao: string | null
          id: string
          posicao: number
          prazo: string | null
          prioridade: Database["public"]["Enums"]["prioridade_atividade"]
          responsavel_id: string | null
          titulo: string
          updated_at: string
        }
        Insert: {
          arquivada?: boolean
          coluna_id: string
          created_at?: string
          criado_por?: string | null
          descricao?: string | null
          id?: string
          posicao?: number
          prazo?: string | null
          prioridade?: Database["public"]["Enums"]["prioridade_atividade"]
          responsavel_id?: string | null
          titulo: string
          updated_at?: string
        }
        Update: {
          arquivada?: boolean
          coluna_id?: string
          created_at?: string
          criado_por?: string | null
          descricao?: string | null
          id?: string
          posicao?: number
          prazo?: string | null
          prioridade?: Database["public"]["Enums"]["prioridade_atividade"]
          responsavel_id?: string | null
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kanban_atividades_coluna_id_fkey"
            columns: ["coluna_id"]
            isOneToOne: false
            referencedRelation: "kanban_colunas"
            referencedColumns: ["id"]
          },
        ]
      }
      kanban_categorias: {
        Row: {
          ativa: boolean
          cor: Database["public"]["Enums"]["cor_kanban"]
          created_at: string
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativa?: boolean
          cor?: Database["public"]["Enums"]["cor_kanban"]
          created_at?: string
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativa?: boolean
          cor?: Database["public"]["Enums"]["cor_kanban"]
          created_at?: string
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      kanban_colunas: {
        Row: {
          arquivada: boolean
          cor: Database["public"]["Enums"]["cor_kanban"]
          created_at: string
          id: string
          nome: string
          posicao: number
          updated_at: string
        }
        Insert: {
          arquivada?: boolean
          cor?: Database["public"]["Enums"]["cor_kanban"]
          created_at?: string
          id?: string
          nome: string
          posicao?: number
          updated_at?: string
        }
        Update: {
          arquivada?: boolean
          cor?: Database["public"]["Enums"]["cor_kanban"]
          created_at?: string
          id?: string
          nome?: string
          posicao?: number
          updated_at?: string
        }
        Relationships: []
      }
      lancamentos: {
        Row: {
          anexo_path: string | null
          aprovacao_ok: boolean | null
          competencia: string
          created_at: string
          criado_por: string | null
          data_pagamento: string | null
          descricao: string | null
          fornecedor: string
          id: string
          id_aprovacao: string | null
          loja_id: string | null
          observacao: string | null
          servico_id: string | null
          situacao: Database["public"]["Enums"]["situacao_pagamento"]
          tipo: Database["public"]["Enums"]["tipo_despesa"]
          updated_at: string
          valor: number
          vencimento: string
        }
        Insert: {
          anexo_path?: string | null
          aprovacao_ok?: boolean | null
          competencia: string
          created_at?: string
          criado_por?: string | null
          data_pagamento?: string | null
          descricao?: string | null
          fornecedor: string
          id?: string
          id_aprovacao?: string | null
          loja_id?: string | null
          observacao?: string | null
          servico_id?: string | null
          situacao?: Database["public"]["Enums"]["situacao_pagamento"]
          tipo: Database["public"]["Enums"]["tipo_despesa"]
          updated_at?: string
          valor: number
          vencimento: string
        }
        Update: {
          anexo_path?: string | null
          aprovacao_ok?: boolean | null
          competencia?: string
          created_at?: string
          criado_por?: string | null
          data_pagamento?: string | null
          descricao?: string | null
          fornecedor?: string
          id?: string
          id_aprovacao?: string | null
          loja_id?: string | null
          observacao?: string | null
          servico_id?: string | null
          situacao?: Database["public"]["Enums"]["situacao_pagamento"]
          tipo?: Database["public"]["Enums"]["tipo_despesa"]
          updated_at?: string
          valor?: number
          vencimento?: string
        }
        Relationships: [
          {
            foreignKeyName: "lancamentos_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_servico_id_fkey"
            columns: ["servico_id"]
            isOneToOne: false
            referencedRelation: "servicos_financeiros"
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
      servicos_financeiros: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          dia_vencimento: number | null
          fornecedor: string
          id: string
          identificador: string | null
          loja_id: string | null
          observacao: string | null
          tipo: Database["public"]["Enums"]["tipo_despesa"]
          updated_at: string
          valor_referencia: number | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          dia_vencimento?: number | null
          fornecedor: string
          id?: string
          identificador?: string | null
          loja_id?: string | null
          observacao?: string | null
          tipo: Database["public"]["Enums"]["tipo_despesa"]
          updated_at?: string
          valor_referencia?: number | null
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          dia_vencimento?: number | null
          fornecedor?: string
          id?: string
          identificador?: string | null
          loja_id?: string | null
          observacao?: string | null
          tipo?: Database["public"]["Enums"]["tipo_despesa"]
          updated_at?: string
          valor_referencia?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "servicos_financeiros_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
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
      vw_dispositivo_baixas: {
        Row: {
          created_at: string | null
          criado_por: string | null
          data_baixa: string | null
          dispositivo_id: string | null
          equipamento: string | null
          id: string | null
          imei1: string | null
          informacoes: string | null
          loja_id: string | null
          loja_nome: string | null
          marca: string | null
          modelo: string | null
          motivo: Database["public"]["Enums"]["motivo_baixa"] | null
          numero_patrimonio: string | null
          qtd_anexos: number | null
          serial_number: string | null
          tipo: Database["public"]["Enums"]["tipo_dispositivo"] | null
        }
        Relationships: [
          {
            foreignKeyName: "dispositivo_baixas_dispositivo_id_fkey"
            columns: ["dispositivo_id"]
            isOneToOne: true
            referencedRelation: "dispositivos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispositivo_baixas_dispositivo_id_fkey"
            columns: ["dispositivo_id"]
            isOneToOne: true
            referencedRelation: "vw_dispositivos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispositivos_loja_estoque_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_dispositivos: {
        Row: {
          colaborador_id: string | null
          colaborador_nome: string | null
          created_at: string | null
          data_compra: string | null
          equipamento: string | null
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
      vw_lancamentos: {
        Row: {
          anexo_path: string | null
          aprovacao_ok: boolean | null
          competencia: string | null
          created_at: string | null
          criado_por: string | null
          data_pagamento: string | null
          descricao: string | null
          dias_para_vencer: number | null
          fornecedor: string | null
          id: string | null
          id_aprovacao: string | null
          loja_cidade: string | null
          loja_id: string | null
          loja_nome: string | null
          observacao: string | null
          servico_descricao: string | null
          servico_fornecedor: string | null
          servico_id: string | null
          servico_identificador: string | null
          situacao: Database["public"]["Enums"]["situacao_pagamento"] | null
          situacao_vencimento: string | null
          tipo: Database["public"]["Enums"]["tipo_despesa"] | null
          updated_at: string | null
          valor: number | null
          vencimento: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lancamentos_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_servico_id_fkey"
            columns: ["servico_id"]
            isOneToOne: false
            referencedRelation: "servicos_financeiros"
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
          equipamento: string | null
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
      arquivar_atividade: { Args: { p_atividade: string }; Returns: undefined }
      arquivar_coluna: { Args: { p_coluna: string }; Returns: undefined }
      atualizar_atividade: {
        Args: {
          p_atividade: string
          p_categorias?: string[]
          p_coluna: string
          p_descricao?: string
          p_prazo?: string
          p_prioridade: Database["public"]["Enums"]["prioridade_atividade"]
          p_responsavel?: string
          p_titulo: string
        }
        Returns: undefined
      }
      atualizar_coluna: {
        Args: {
          p_coluna: string
          p_cor: Database["public"]["Enums"]["cor_kanban"]
          p_nome: string
        }
        Returns: undefined
      }
      baixar_dispositivo: {
        Args: {
          p_anexos?: Json
          p_data_baixa: string
          p_dispositivo_id: string
          p_informacoes: string
          p_motivo: Database["public"]["Enums"]["motivo_baixa"]
        }
        Returns: string
      }
      criar_atividade: {
        Args: {
          p_categorias?: string[]
          p_coluna: string
          p_descricao?: string
          p_prazo?: string
          p_prioridade?: Database["public"]["Enums"]["prioridade_atividade"]
          p_responsavel?: string
          p_titulo: string
        }
        Returns: string
      }
      criar_coluna: {
        Args: {
          p_cor?: Database["public"]["Enums"]["cor_kanban"]
          p_nome: string
        }
        Returns: string
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
      kanban_definir_categorias: {
        Args: { p_atividade: string; p_categorias: string[] }
        Returns: undefined
      }
      kanban_reindexar_atividades: {
        Args: { p_coluna: string }
        Returns: undefined
      }
      kanban_reindexar_colunas: { Args: never; Returns: undefined }
      mascarar_cpf_auditoria: { Args: { p_cpf: string }; Returns: Json }
      mover_atividade: {
        Args: {
          p_atividade: string
          p_coluna_destino: string
          p_posicao?: number
        }
        Returns: undefined
      }
      mover_coluna: {
        Args: { p_coluna: string; p_posicao: number }
        Returns: undefined
      }
      normalizar_perifericos: {
        Args: {
          p_formatado: boolean
          p_perifericos: string[]
          p_tipo: Database["public"]["Enums"]["tipo_dispositivo"]
        }
        Returns: string[]
      }
      ping: { Args: never; Returns: number }
      restaurar_atividade: {
        Args: { p_atividade: string; p_coluna?: string }
        Returns: undefined
      }
      restaurar_coluna: { Args: { p_coluna: string }; Returns: undefined }
      usuarios_auditoria: {
        Args: never
        Returns: {
          email: string
          id: string
        }[]
      }
      usuarios_sistema: {
        Args: never
        Returns: {
          email: string
          id: string
          nome: string
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
      cor_kanban:
        | "cinza"
        | "marrom"
        | "laranja"
        | "amarelo"
        | "verde"
        | "ciano"
        | "azul"
        | "roxo"
        | "rosa"
        | "vermelho"
      motivo_baixa:
        | "roubo"
        | "furto"
        | "perda_extravio"
        | "defeito_irreparavel"
        | "obsolescencia"
        | "doacao"
        | "venda"
        | "outro"
      prioridade_atividade: "alta" | "media" | "baixa"
      situacao_pagamento:
        | "solicitado_compras"
        | "enviado_financeiro"
        | "pago"
        | "nao_pago"
        | "cancelado"
      status_dispositivo: "disponivel" | "em_uso" | "manutencao" | "baixado"
      tipo_despesa:
        | "provedor_internet"
        | "servico"
        | "telefonia"
        | "compras"
        | "outro"
      tipo_dispositivo: "notebook" | "telefone" | "monitor" | "infraestrutura"
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
      cor_kanban: [
        "cinza",
        "marrom",
        "laranja",
        "amarelo",
        "verde",
        "ciano",
        "azul",
        "roxo",
        "rosa",
        "vermelho",
      ],
      motivo_baixa: [
        "roubo",
        "furto",
        "perda_extravio",
        "defeito_irreparavel",
        "obsolescencia",
        "doacao",
        "venda",
        "outro",
      ],
      prioridade_atividade: ["alta", "media", "baixa"],
      situacao_pagamento: [
        "solicitado_compras",
        "enviado_financeiro",
        "pago",
        "nao_pago",
        "cancelado",
      ],
      status_dispositivo: ["disponivel", "em_uso", "manutencao", "baixado"],
      tipo_despesa: [
        "provedor_internet",
        "servico",
        "telefonia",
        "compras",
        "outro",
      ],
      tipo_dispositivo: ["notebook", "telefone", "monitor", "infraestrutura"],
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
