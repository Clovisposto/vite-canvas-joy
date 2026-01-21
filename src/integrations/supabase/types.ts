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
      ai_whatsapp_logs: {
        Row: {
          created_at: string
          id: string
          message: string
          phone: string
          sent_by: string | null
          status: string | null
          whatsapp_link: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          phone: string
          sent_by?: string | null
          status?: string | null
          whatsapp_link: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          phone?: string
          sent_by?: string | null
          status?: string | null
          whatsapp_link?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string | null
          id: string
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          table_name: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      bulk_send_jobs: {
        Row: {
          completed_at: string | null
          contacts: Json
          created_at: string
          created_by: string | null
          error_message: string | null
          failed_count: number
          id: string
          message: string
          pending_count: number
          sent_count: number
          settings: Json
          started_at: string | null
          status: string
          title: string
          total_contacts: number
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          contacts?: Json
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          failed_count?: number
          id?: string
          message: string
          pending_count?: number
          sent_count?: number
          settings?: Json
          started_at?: string | null
          status?: string
          title: string
          total_contacts?: number
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          contacts?: Json
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          failed_count?: number
          id?: string
          message?: string
          pending_count?: number
          sent_count?: number
          settings?: Json
          started_at?: string | null
          status?: string
          title?: string
          total_contacts?: number
          updated_at?: string
        }
        Relationships: []
      }
      checkin_public_links: {
        Row: {
          checkin_id: string
          created_at: string
          expires_at: string
          id: string
          token: string
        }
        Insert: {
          checkin_id: string
          created_at?: string
          expires_at?: string
          id?: string
          token: string
        }
        Update: {
          checkin_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkin_public_links_checkin_id_fkey"
            columns: ["checkin_id"]
            isOneToOne: false
            referencedRelation: "checkins"
            referencedColumns: ["id"]
          },
        ]
      }
      checkins: {
        Row: {
          amount: number | null
          attendant_code: string | null
          created_at: string | null
          customer_id: string | null
          id: string
          is_demo: boolean
          liters: number | null
          origin: string | null
          payment_method: string | null
          phone: string
          stone_tef_id: string | null
          tag: string | null
        }
        Insert: {
          amount?: number | null
          attendant_code?: string | null
          created_at?: string | null
          customer_id?: string | null
          id?: string
          is_demo?: boolean
          liters?: number | null
          origin?: string | null
          payment_method?: string | null
          phone: string
          stone_tef_id?: string | null
          tag?: string | null
        }
        Update: {
          amount?: number | null
          attendant_code?: string | null
          created_at?: string | null
          customer_id?: string | null
          id?: string
          is_demo?: boolean
          liters?: number | null
          origin?: string | null
          payment_method?: string | null
          phone?: string
          stone_tef_id?: string | null
          tag?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checkins_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkins_stone_tef_id_fkey"
            columns: ["stone_tef_id"]
            isOneToOne: false
            referencedRelation: "stone_tef_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      complaints: {
        Row: {
          created_at: string | null
          customer_id: string | null
          id: string
          message: string
          phone: string | null
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          customer_id?: string | null
          id?: string
          message: string
          phone?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          customer_id?: string | null
          id?: string
          message?: string
          phone?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "complaints_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          accepts_promo: boolean | null
          accepts_raffle: boolean | null
          consent_source: string | null
          consent_text_version: string | null
          created_at: string | null
          id: string
          lgpd_consent: boolean | null
          lgpd_consent_timestamp: string | null
          lgpd_version: string | null
          marketing_opt_in_at: string | null
          name: string | null
          phone: string
          updated_at: string | null
        }
        Insert: {
          accepts_promo?: boolean | null
          accepts_raffle?: boolean | null
          consent_source?: string | null
          consent_text_version?: string | null
          created_at?: string | null
          id?: string
          lgpd_consent?: boolean | null
          lgpd_consent_timestamp?: string | null
          lgpd_version?: string | null
          marketing_opt_in_at?: string | null
          name?: string | null
          phone: string
          updated_at?: string | null
        }
        Update: {
          accepts_promo?: boolean | null
          accepts_raffle?: boolean | null
          consent_source?: string | null
          consent_text_version?: string | null
          created_at?: string | null
          id?: string
          lgpd_consent?: boolean | null
          lgpd_consent_timestamp?: string | null
          lgpd_version?: string | null
          marketing_opt_in_at?: string | null
          name?: string | null
          phone?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      dispatch_history: {
        Row: {
          created_at: string
          dispatched_by: string | null
          failed_count: number
          id: string
          message: string
          promotion_id: string | null
          promotion_title: string
          sent_count: number
          status: string
          total_contacts: number
        }
        Insert: {
          created_at?: string
          dispatched_by?: string | null
          failed_count?: number
          id?: string
          message: string
          promotion_id?: string | null
          promotion_title: string
          sent_count?: number
          status?: string
          total_contacts?: number
        }
        Update: {
          created_at?: string
          dispatched_by?: string | null
          failed_count?: number
          id?: string
          message?: string
          promotion_id?: string | null
          promotion_title?: string
          sent_count?: number
          status?: string
          total_contacts?: number
        }
        Relationships: [
          {
            foreignKeyName: "dispatch_history_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "promotions"
            referencedColumns: ["id"]
          },
        ]
      }
      frentista_metas: {
        Row: {
          created_at: string
          end_date: string | null
          frentista_id: string
          id: string
          is_active: boolean | null
          period_type: string
          start_date: string
          target_amount: number | null
          target_checkins: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          frentista_id: string
          id?: string
          is_active?: boolean | null
          period_type?: string
          start_date?: string
          target_amount?: number | null
          target_checkins?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_date?: string | null
          frentista_id?: string
          id?: string
          is_active?: boolean | null
          period_type?: string
          start_date?: string
          target_amount?: number | null
          target_checkins?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "frentista_metas_frentista_id_fkey"
            columns: ["frentista_id"]
            isOneToOne: false
            referencedRelation: "frentistas"
            referencedColumns: ["id"]
          },
        ]
      }
      frentistas: {
        Row: {
          codigo: string
          created_at: string | null
          id: string
          is_active: boolean | null
          nome: string
          terminal_id: string | null
          updated_at: string | null
        }
        Insert: {
          codigo: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          nome: string
          terminal_id?: string | null
          updated_at?: string | null
        }
        Update: {
          codigo?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          nome?: string
          terminal_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      frentistas_pins: {
        Row: {
          created_at: string | null
          frentista_id: string
          id: string
          is_active: boolean | null
          pin_hash: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          frentista_id: string
          id?: string
          is_active?: boolean | null
          pin_hash: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          frentista_id?: string
          id?: string
          is_active?: boolean | null
          pin_hash?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "frentistas_pins_frentista_id_fkey"
            columns: ["frentista_id"]
            isOneToOne: true
            referencedRelation: "frentistas"
            referencedColumns: ["id"]
          },
        ]
      }
      imports_logs: {
        Row: {
          created_at: string | null
          errors: Json | null
          filename: string
          id: string
          imported_by: string | null
          records_created: number | null
          records_failed: number | null
          records_matched: number | null
          records_total: number | null
          records_updated: number | null
        }
        Insert: {
          created_at?: string | null
          errors?: Json | null
          filename: string
          id?: string
          imported_by?: string | null
          records_created?: number | null
          records_failed?: number | null
          records_matched?: number | null
          records_total?: number | null
          records_updated?: number | null
        }
        Update: {
          created_at?: string | null
          errors?: Json | null
          filename?: string
          id?: string
          imported_by?: string | null
          records_created?: number | null
          records_failed?: number | null
          records_matched?: number | null
          records_total?: number | null
          records_updated?: number | null
        }
        Relationships: []
      }
      livro_caixa: {
        Row: {
          categoria: string
          created_at: string
          created_by: string | null
          data: string
          descricao: string | null
          forma_pagamento: string | null
          id: string
          observacoes: string | null
          responsavel: string | null
          tipo: string
          updated_at: string
          valor: number
        }
        Insert: {
          categoria: string
          created_at?: string
          created_by?: string | null
          data?: string
          descricao?: string | null
          forma_pagamento?: string | null
          id?: string
          observacoes?: string | null
          responsavel?: string | null
          tipo: string
          updated_at?: string
          valor: number
        }
        Update: {
          categoria?: string
          created_at?: string
          created_by?: string | null
          data?: string
          descricao?: string | null
          forma_pagamento?: string | null
          id?: string
          observacoes?: string | null
          responsavel?: string | null
          tipo?: string
          updated_at?: string
          valor?: number
        }
        Relationships: []
      }
      messages_queue: {
        Row: {
          created_at: string | null
          customer_id: string | null
          id: string
          message: string | null
          phone: string
          promotion_id: string | null
          sent_at: string | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          customer_id?: string | null
          id?: string
          message?: string | null
          phone: string
          promotion_id?: string | null
          sent_at?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          customer_id?: string | null
          id?: string
          message?: string | null
          phone?: string
          promotion_id?: string | null
          sent_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_queue_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_queue_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "promotions"
            referencedColumns: ["id"]
          },
        ]
      }
      premios_qr: {
        Row: {
          codigo: string
          cpf: string | null
          created_by: string | null
          data_criacao: string
          data_expiracao: string
          id: string
          nome_ganhador: string
          observacoes: string | null
          status: string
          telefone: string | null
          updated_at: string
          valor_original: number
          valor_restante: number
        }
        Insert: {
          codigo: string
          cpf?: string | null
          created_by?: string | null
          data_criacao?: string
          data_expiracao: string
          id?: string
          nome_ganhador: string
          observacoes?: string | null
          status?: string
          telefone?: string | null
          updated_at?: string
          valor_original?: number
          valor_restante?: number
        }
        Update: {
          codigo?: string
          cpf?: string | null
          created_by?: string | null
          data_criacao?: string
          data_expiracao?: string
          id?: string
          nome_ganhador?: string
          observacoes?: string | null
          status?: string
          telefone?: string | null
          updated_at?: string
          valor_original?: number
          valor_restante?: number
        }
        Relationships: []
      }
      premios_qr_consumos: {
        Row: {
          consumido_em: string
          consumido_por: string | null
          id: string
          observacao: string | null
          premio_id: string
          valor_abatido: number
          valor_anterior: number
          valor_apos: number
        }
        Insert: {
          consumido_em?: string
          consumido_por?: string | null
          id?: string
          observacao?: string | null
          premio_id: string
          valor_abatido: number
          valor_anterior: number
          valor_apos: number
        }
        Update: {
          consumido_em?: string
          consumido_por?: string | null
          id?: string
          observacao?: string | null
          premio_id?: string
          valor_abatido?: number
          valor_anterior?: number
          valor_apos?: number
        }
        Relationships: [
          {
            foreignKeyName: "premios_qr_consumos_premio_id_fkey"
            columns: ["premio_id"]
            isOneToOne: false
            referencedRelation: "premios_qr"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          role: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          role?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          role?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      promotions: {
        Row: {
          created_at: string | null
          description: string | null
          discount_value: number | null
          eligible_payments: string[] | null
          end_date: string | null
          id: string
          is_active: boolean | null
          start_date: string | null
          title: string
          type: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          discount_value?: number | null
          eligible_payments?: string[] | null
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          start_date?: string | null
          title: string
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          discount_value?: number | null
          eligible_payments?: string[] | null
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          start_date?: string | null
          title?: string
          type?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      qr_capture_points: {
        Row: {
          created_at: string
          description: string | null
          frentista_id: string | null
          id: string
          is_active: boolean | null
          location: string | null
          name: string
          tag: string
          terminal_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          frentista_id?: string | null
          id?: string
          is_active?: boolean | null
          location?: string | null
          name: string
          tag: string
          terminal_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          frentista_id?: string | null
          id?: string
          is_active?: boolean | null
          location?: string | null
          name?: string
          tag?: string
          terminal_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "qr_capture_points_frentista_id_fkey"
            columns: ["frentista_id"]
            isOneToOne: false
            referencedRelation: "frentistas"
            referencedColumns: ["id"]
          },
        ]
      }
      raffle_runs: {
        Row: {
          eligible_count: number | null
          executed_at: string | null
          executed_by: string | null
          id: string
          is_test: boolean | null
          raffle_id: string | null
          seed: string | null
          winners: Json | null
        }
        Insert: {
          eligible_count?: number | null
          executed_at?: string | null
          executed_by?: string | null
          id?: string
          is_test?: boolean | null
          raffle_id?: string | null
          seed?: string | null
          winners?: Json | null
        }
        Update: {
          eligible_count?: number | null
          executed_at?: string | null
          executed_by?: string | null
          id?: string
          is_test?: boolean | null
          raffle_id?: string | null
          seed?: string | null
          winners?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "raffle_runs_raffle_id_fkey"
            columns: ["raffle_id"]
            isOneToOne: false
            referencedRelation: "raffles"
            referencedColumns: ["id"]
          },
        ]
      }
      raffles: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          prize_value: number | null
          rules: string | null
          schedule_days: number[] | null
          schedule_times: string[] | null
          updated_at: string | null
          winners_count: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          prize_value?: number | null
          rules?: string | null
          schedule_days?: number[] | null
          schedule_times?: string[] | null
          updated_at?: string | null
          winners_count?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          prize_value?: number | null
          rules?: string | null
          schedule_days?: number[] | null
          schedule_times?: string[] | null
          updated_at?: string | null
          winners_count?: number | null
        }
        Relationships: []
      }
      settings: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          key: string
          updated_at: string | null
          value: Json
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          key: string
          updated_at?: string | null
          value?: Json
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          key?: string
          updated_at?: string | null
          value?: Json
        }
        Relationships: []
      }
      stone_tef_logs: {
        Row: {
          autorizacao: string | null
          bandeira: string | null
          checkin_id: string | null
          created_at: string
          forma_pagamento: string
          frentista_id: string | null
          frentista_nome: string | null
          horario: string
          id: string
          nsu: string | null
          parcelas: number | null
          raw_data: Json | null
          status: string | null
          terminal_id: string | null
          updated_at: string
          valor: number
        }
        Insert: {
          autorizacao?: string | null
          bandeira?: string | null
          checkin_id?: string | null
          created_at?: string
          forma_pagamento: string
          frentista_id?: string | null
          frentista_nome?: string | null
          horario?: string
          id?: string
          nsu?: string | null
          parcelas?: number | null
          raw_data?: Json | null
          status?: string | null
          terminal_id?: string | null
          updated_at?: string
          valor: number
        }
        Update: {
          autorizacao?: string | null
          bandeira?: string | null
          checkin_id?: string | null
          created_at?: string
          forma_pagamento?: string
          frentista_id?: string | null
          frentista_nome?: string | null
          horario?: string
          id?: string
          nsu?: string | null
          parcelas?: number | null
          raw_data?: Json | null
          status?: string | null
          terminal_id?: string | null
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "stone_tef_logs_checkin_id_fkey"
            columns: ["checkin_id"]
            isOneToOne: false
            referencedRelation: "checkins"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_audit: {
        Row: {
          action: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          error_message: string | null
          id: string
          ip_address: string | null
          provider: string | null
          request_data: Json | null
          response_data: Json | null
          status: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          error_message?: string | null
          id?: string
          ip_address?: string | null
          provider?: string | null
          request_data?: Json | null
          response_data?: Json | null
          status?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          error_message?: string | null
          id?: string
          ip_address?: string | null
          provider?: string | null
          request_data?: Json | null
          response_data?: Json | null
          status?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      wa_contacts: {
        Row: {
          created_at: string
          customer_id: string | null
          flow_state: string | null
          id: string
          name: string | null
          opt_in: boolean | null
          opt_in_timestamp: string | null
          opt_out_reason: string | null
          opt_out_timestamp: string | null
          phone: string
          updated_at: string
          wa_id: string | null
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          flow_state?: string | null
          id?: string
          name?: string | null
          opt_in?: boolean | null
          opt_in_timestamp?: string | null
          opt_out_reason?: string | null
          opt_out_timestamp?: string | null
          phone: string
          updated_at?: string
          wa_id?: string | null
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          flow_state?: string | null
          id?: string
          name?: string | null
          opt_in?: boolean | null
          opt_in_timestamp?: string | null
          opt_out_reason?: string | null
          opt_out_timestamp?: string | null
          phone?: string
          updated_at?: string
          wa_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wa_contacts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_messages: {
        Row: {
          contact_id: string | null
          content: string | null
          created_at: string
          direction: string
          error_message: string | null
          id: string
          message_type: string
          phone: string
          provider: string | null
          status: string | null
          status_timestamp: string | null
          template_name: string | null
          template_params: Json | null
          wa_message_id: string | null
        }
        Insert: {
          contact_id?: string | null
          content?: string | null
          created_at?: string
          direction: string
          error_message?: string | null
          id?: string
          message_type?: string
          phone: string
          provider?: string | null
          status?: string | null
          status_timestamp?: string | null
          template_name?: string | null
          template_params?: Json | null
          wa_message_id?: string | null
        }
        Update: {
          contact_id?: string | null
          content?: string | null
          created_at?: string
          direction?: string
          error_message?: string | null
          id?: string
          message_type?: string
          phone?: string
          provider?: string | null
          status?: string | null
          status_timestamp?: string | null
          template_name?: string | null
          template_params?: Json | null
          wa_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wa_messages_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "wa_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_templates: {
        Row: {
          body: string
          buttons: Json | null
          category: string | null
          created_at: string
          footer: string | null
          header_content: string | null
          header_type: string | null
          id: string
          language: string | null
          meta_template_id: string | null
          name: string
          status: string | null
          updated_at: string
        }
        Insert: {
          body: string
          buttons?: Json | null
          category?: string | null
          created_at?: string
          footer?: string | null
          header_content?: string | null
          header_type?: string | null
          id?: string
          language?: string | null
          meta_template_id?: string | null
          name: string
          status?: string | null
          updated_at?: string
        }
        Update: {
          body?: string
          buttons?: Json | null
          category?: string | null
          created_at?: string
          footer?: string | null
          header_content?: string | null
          header_type?: string | null
          id?: string
          language?: string | null
          meta_template_id?: string | null
          name?: string
          status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      whatsapp_campaign_recipients: {
        Row: {
          campaign_id: string
          created_at: string
          customer_name: string | null
          error: string | null
          id: string
          phone_e164: string
          provider_message_id: string | null
          sent_at: string | null
          status: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          customer_name?: string | null
          error?: string | null
          id?: string
          phone_e164: string
          provider_message_id?: string | null
          sent_at?: string | null
          status?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          customer_name?: string | null
          error?: string | null
          id?: string
          phone_e164?: string
          provider_message_id?: string | null
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_campaign_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_campaigns: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          message: string
          name: string
          scheduled_for: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          message: string
          name: string
          scheduled_for?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          message?: string
          name?: string
          scheduled_for?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      whatsapp_logs: {
        Row: {
          created_at: string
          customer_id: string | null
          error: string | null
          id: string
          message: string
          message_id: string | null
          phone: string
          provider: string
          status: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          error?: string | null
          id?: string
          message: string
          message_id?: string | null
          phone: string
          provider: string
          status?: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          error?: string | null
          id?: string
          message?: string
          message_id?: string | null
          phone?: string
          provider?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_logs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_optout: {
        Row: {
          created_at: string
          phone_e164: string
          reason: string | null
        }
        Insert: {
          created_at?: string
          phone_e164: string
          reason?: string | null
        }
        Update: {
          created_at?: string
          phone_e164?: string
          reason?: string | null
        }
        Relationships: []
      }
      whatsapp_settings: {
        Row: {
          cloud_access_token: string | null
          cloud_graph_version: string | null
          cloud_phone_number_id: string | null
          cloud_waba_id: string | null
          created_at: string
          enabled: boolean
          evolution_api_key: string | null
          evolution_base_url: string | null
          evolution_instance: string | null
          id: string
          provider: string
          updated_at: string
        }
        Insert: {
          cloud_access_token?: string | null
          cloud_graph_version?: string | null
          cloud_phone_number_id?: string | null
          cloud_waba_id?: string | null
          created_at?: string
          enabled?: boolean
          evolution_api_key?: string | null
          evolution_base_url?: string | null
          evolution_instance?: string | null
          id?: string
          provider?: string
          updated_at?: string
        }
        Update: {
          cloud_access_token?: string | null
          cloud_graph_version?: string | null
          cloud_phone_number_id?: string | null
          cloud_waba_id?: string | null
          created_at?: string
          enabled?: boolean
          evolution_api_key?: string | null
          evolution_base_url?: string | null
          evolution_instance?: string | null
          id?: string
          provider?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      abater_com_frentista: {
        Args: {
          p_frentista_nome: string
          p_observacao?: string
          p_premio_id: string
          p_valor: number
        }
        Returns: Json
      }
      get_premio_publico: { Args: { p_codigo: string }; Returns: Json }
      get_public_checkin_status: { Args: { p_token: string }; Returns: Json }
      is_admin: { Args: never; Returns: boolean }
      is_staff: { Args: never; Returns: boolean }
      public_create_checkin_and_token: {
        Args: { p_attendant_code?: string; p_phone: string; p_tag?: string }
        Returns: Json
      }
      validar_pin_e_abater: {
        Args: {
          p_observacao?: string
          p_pin: string
          p_premio_id: string
          p_valor: number
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
