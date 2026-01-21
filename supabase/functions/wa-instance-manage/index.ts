import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface InstanceResponse {
  success: boolean;
  connected?: boolean;
  qrcode?: string;
  qrcodeText?: string;
  pairingCode?: string;
  message?: string;
  error?: string;
  instanceName?: string;
  diagnosis?: DiagnosisReport;
  progress?: { attempt: number; maxAttempts: number; state?: string };
}

interface DiagnosisReport {
  instanceExists: boolean;
  connectionState: string;
  apiReachable: boolean;
  evolutionVersion?: string;
  lastQrAttempt?: unknown;
  recommendations: string[];
}

// Helper to delay execution
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Safe JSON parser - handles HTML responses gracefully
async function safeJsonParse(response: Response): Promise<{ ok: boolean; data?: any; error?: string; isHtml?: boolean }> {
  const text = await response.text();
  
  // Check if it looks like HTML (common when Evolution API is down or URL is wrong)
  if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html') || text.trim().startsWith('<')) {
    console.error('[wa-instance-manage] Received HTML instead of JSON. URL may be invalid or server is down.');
    return { 
      ok: false, 
      error: 'Evolution API retornou HTML ao invés de JSON. O servidor pode estar fora ou a URL expirou.',
      isHtml: true 
    };
  }
  
  // Try to parse as JSON
  try {
    const data = JSON.parse(text);
    return { ok: true, data };
  } catch (e) {
    console.error('[wa-instance-manage] Failed to parse JSON:', text.substring(0, 200));
    return { ok: false, error: `Resposta inválida: ${text.substring(0, 100)}...` };
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_URL');
    const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY');
    const EVOLUTION_INSTANCE_NAME = Deno.env.get('EVOLUTION_INSTANCE_NAME') || 'posto7';

    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
      console.error('[wa-instance-manage] Missing environment variables');
      return new Response(
        JSON.stringify({ success: false, error: 'Configuração do servidor incompleta' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action } = await req.json();
    console.info(`[wa-instance-manage] Action: ${action}, Instance: ${EVOLUTION_INSTANCE_NAME}`);

    const baseUrl = EVOLUTION_API_URL.replace(/\/$/, '');
    const headers = {
      'Content-Type': 'application/json',
      'apikey': EVOLUTION_API_KEY,
    };

    let result: InstanceResponse;

    switch (action) {
      case 'status': {
        // Check connection state
        try {
          const stateRes = await fetch(`${baseUrl}/instance/connectionState/${EVOLUTION_INSTANCE_NAME}`, {
            method: 'GET',
            headers,
          });
          
          if (stateRes.status === 404) {
            result = { 
              success: true, 
              connected: false, 
              message: 'Instância não existe. Clique em "Criar Instância" para configurar.',
              instanceName: EVOLUTION_INSTANCE_NAME
            };
          } else {
            const parsed = await safeJsonParse(stateRes);
            
            if (!parsed.ok) {
              result = {
                success: false,
                error: parsed.isHtml 
                  ? 'Evolution API inacessível. Verifique se o túnel/servidor está ativo.' 
                  : parsed.error,
                message: `URL: ${baseUrl} - Servidor pode estar offline ou URL expirou.`
              };
              break;
            }
            
            const stateData = parsed.data;
            console.info('[wa-instance-manage] Connection state:', JSON.stringify(stateData));
            
            const state = stateData?.instance?.state || stateData?.state || '';
            const connected = state === 'open' || state === 'connected';
            
            result = {
              success: true,
              connected,
              instanceName: EVOLUTION_INSTANCE_NAME,
              message: connected ? 'Conectado' : `Estado: ${state || 'desconhecido'}`,
            };
          }
        } catch (fetchError) {
          console.error('[wa-instance-manage] Fetch error:', fetchError);
          result = {
            success: false,
            error: 'Não foi possível conectar à Evolution API. Verifique se a URL está acessível.',
            message: `URL configurada: ${baseUrl}`
          };
        }
        break;
      }

      case 'create': {
        // Create instance
        console.info('[wa-instance-manage] Creating instance...');
        
        try {
          const createRes = await fetch(`${baseUrl}/instance/create`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              instanceName: EVOLUTION_INSTANCE_NAME,
              qrcode: true,
              integration: 'WHATSAPP-BAILEYS',
            }),
          });
          
          const parsed = await safeJsonParse(createRes);
          
          if (!parsed.ok) {
            result = {
              success: false,
              error: parsed.isHtml 
                ? 'Evolution API inacessível. O servidor/túnel pode estar offline.' 
                : parsed.error,
            };
            break;
          }
          
          const createData = parsed.data;
          console.info('[wa-instance-manage] Create response:', JSON.stringify(createData));
          
          if (createRes.ok || createData?.instance?.instanceName) {
            result = {
              success: true,
              instanceName: createData?.instance?.instanceName || EVOLUTION_INSTANCE_NAME,
              message: 'Instância criada! Agora gere o QR Code para conectar.',
            };
          } else if (createData?.error?.includes('already') || createData?.message?.includes('already')) {
            result = {
              success: true,
              message: 'Instância já existe. Gere o QR Code para conectar.',
              instanceName: EVOLUTION_INSTANCE_NAME
            };
          } else {
            result = {
              success: false,
              error: createData?.message || createData?.error || 'Erro ao criar instância',
            };
          }
        } catch (fetchError) {
          console.error('[wa-instance-manage] Create error:', fetchError);
          result = {
            success: false,
            error: 'Erro de conexão ao criar instância. Verifique se o servidor está acessível.',
          };
        }
        break;
      }

      case 'restart': {
        // Restart instance (soft reset)
        console.info('[wa-instance-manage] Restarting instance...');
        
        try {
          const restartRes = await fetch(`${baseUrl}/instance/restart/${EVOLUTION_INSTANCE_NAME}`, {
            method: 'POST',
            headers,
          });
          
          // Don't fail on HTML response for restart - just report success
          const parsed = await safeJsonParse(restartRes);
          if (!parsed.ok && parsed.isHtml) {
            result = {
              success: false,
              error: 'Evolution API inacessível. Verifique o servidor/túnel.',
            };
            break;
          }
          
          console.info('[wa-instance-manage] Restart response:', JSON.stringify(parsed.data));
          
          result = {
            success: true,
            message: 'Instância reiniciada com sucesso. Aguarde alguns segundos e tente gerar o QR Code.',
          };
        } catch (fetchError) {
          console.error('[wa-instance-manage] Restart error:', fetchError);
          result = {
            success: false,
            error: 'Erro ao reiniciar instância. Verifique a conexão com a Evolution API.',
          };
        }
        break;
      }

      case 'logout': {
        // Logout session (clears auth, keeps instance)
        console.info('[wa-instance-manage] Logging out session...');
        
        try {
          const logoutRes = await fetch(`${baseUrl}/instance/logout/${EVOLUTION_INSTANCE_NAME}`, {
            method: 'DELETE',
            headers,
          });
          
          const parsed = await safeJsonParse(logoutRes);
          if (!parsed.ok && parsed.isHtml) {
            result = {
              success: false,
              error: 'Evolution API inacessível. Verifique o servidor/túnel.',
            };
            break;
          }
          
          console.info('[wa-instance-manage] Logout response:', JSON.stringify(parsed.data));
          
          result = {
            success: true,
            connected: false,
            message: 'Sessão encerrada. Aguarde e tente conectar novamente.',
          };
        } catch (fetchError) {
          console.error('[wa-instance-manage] Logout error:', fetchError);
          result = {
            success: false,
            error: 'Erro ao encerrar sessão.',
          };
        }
        break;
      }

      case 'delete': {
        // Delete instance completely
        console.info('[wa-instance-manage] Deleting instance...');
        
        try {
          const deleteRes = await fetch(`${baseUrl}/instance/delete/${EVOLUTION_INSTANCE_NAME}`, {
            method: 'DELETE',
            headers,
          });
          
          const parsed = await safeJsonParse(deleteRes);
          if (!parsed.ok && parsed.isHtml) {
            result = {
              success: false,
              error: 'Evolution API inacessível. Verifique o servidor/túnel.',
            };
            break;
          }
          
          console.info('[wa-instance-manage] Delete response:', JSON.stringify(parsed.data));
          
          result = {
            success: true,
            connected: false,
            message: 'Instância deletada. Crie uma nova instância para continuar.',
          };
        } catch (fetchError) {
          console.error('[wa-instance-manage] Delete error:', fetchError);
          result = {
            success: false,
            error: 'Erro ao deletar instância.',
          };
        }
        break;
      }

      case 'diagnose': {
        // Full diagnosis of the instance
        console.info('[wa-instance-manage] Running diagnosis...');
        
        const diagnosis: DiagnosisReport = {
          instanceExists: false,
          connectionState: 'unknown',
          apiReachable: false,
          recommendations: [],
        };

        try {
          // Test API reachability
          const healthRes = await fetch(`${baseUrl}/instance/connectionState/${EVOLUTION_INSTANCE_NAME}`, {
            method: 'GET',
            headers,
          });
          
          const parsed = await safeJsonParse(healthRes);
          
          if (!parsed.ok) {
            diagnosis.apiReachable = false;
            if (parsed.isHtml) {
              diagnosis.recommendations.push('❌ Evolution API está retornando HTML ao invés de JSON.');
              diagnosis.recommendations.push('Possíveis causas:');
              diagnosis.recommendations.push('  • URL do túnel Cloudflare expirou');
              diagnosis.recommendations.push('  • Servidor/container Docker está offline');
              diagnosis.recommendations.push('  • URL incorreta configurada nos secrets');
              diagnosis.recommendations.push(`URL atual: ${baseUrl}`);
            } else {
              diagnosis.recommendations.push('Erro ao conectar na API: ' + parsed.error);
            }
            
            result = {
              success: false,
              error: 'Evolution API inacessível',
              diagnosis,
            };
            break;
          }
          
          diagnosis.apiReachable = true;

          if (healthRes.status === 404) {
            diagnosis.instanceExists = false;
            diagnosis.connectionState = 'not_found';
            diagnosis.recommendations.push('Instância não existe. Clique em "Criar Instância".');
          } else {
            const stateData = parsed.data;
            diagnosis.instanceExists = true;
            diagnosis.connectionState = stateData?.instance?.state || stateData?.state || 'unknown';
            
            // Try to get QR to see response
            try {
              const qrRes = await fetch(`${baseUrl}/instance/connect/${EVOLUTION_INSTANCE_NAME}`, {
                method: 'GET',
                headers,
              });
              const qrParsed = await safeJsonParse(qrRes);
              diagnosis.lastQrAttempt = qrParsed.ok ? qrParsed.data : { error: qrParsed.error };
            } catch {
              diagnosis.lastQrAttempt = { error: 'failed to fetch qr' };
            }

            // Generate recommendations
            if (diagnosis.connectionState === 'connecting') {
              diagnosis.recommendations.push('⚠️ Instância travada em "connecting". Isso indica problema com a sessão.');
              diagnosis.recommendations.push('Tente: 1) Resetar Sessão ou 2) Recriar Instância.');
              diagnosis.recommendations.push('Se persistir, verifique os logs do container Docker.');
            } else if (diagnosis.connectionState === 'close' || diagnosis.connectionState === 'disconnected') {
              diagnosis.recommendations.push('📱 Instância desconectada. Gere um novo QR Code.');
            } else if (diagnosis.connectionState === 'open' || diagnosis.connectionState === 'connected') {
              diagnosis.recommendations.push('✅ Instância conectada! Tudo funcionando.');
            } else {
              diagnosis.recommendations.push(`❓ Estado desconhecido: ${diagnosis.connectionState}. Tente reiniciar.`);
            }
          }

          // Try to get Evolution version
          try {
            const versionRes = await fetch(`${baseUrl}/`, { method: 'GET', headers });
            const versionParsed = await safeJsonParse(versionRes);
            if (versionParsed.ok) {
              diagnosis.evolutionVersion = versionParsed.data?.version || versionParsed.data?.name || 'unknown';
            } else {
              diagnosis.evolutionVersion = 'unknown';
            }
          } catch {
            diagnosis.evolutionVersion = 'unknown';
          }

          result = {
            success: true,
            diagnosis,
            message: 'Diagnóstico completo',
          };
        } catch (fetchError) {
          console.error('[wa-instance-manage] Diagnosis error:', fetchError);
          diagnosis.apiReachable = false;
          diagnosis.recommendations.push('❌ Evolution API inacessível. Verifique a URL e o Cloudflare Tunnel.');
          diagnosis.recommendations.push('A URL configurada pode ter expirado (se era um túnel temporário).');
          diagnosis.recommendations.push(`URL atual: ${baseUrl}`);
          
          result = {
            success: false,
            error: 'Não foi possível conectar à Evolution API.',
            diagnosis,
          };
        }
        break;
      }

      case 'qrcode': {
        // Get QR code with polling (up to 30 attempts, 2s interval, with auto-recovery)
        const MAX_ATTEMPTS = 30;
        const POLL_INTERVAL = 2000;
        const RECOVERY_AT_ATTEMPT = 15;
        
        console.info('[wa-instance-manage] Starting QR code polling (enhanced)...');
        
        let lastError = '';
        let qrcodeResult: InstanceResponse | null = null;
        let didRecovery = false;
        let lastState = '';
        let htmlErrorCount = 0;
        
        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
          console.info(`[wa-instance-manage] QR attempt ${attempt}/${MAX_ATTEMPTS}`);
          
          try {
            // First check if already connected
            const stateRes = await fetch(`${baseUrl}/instance/connectionState/${EVOLUTION_INSTANCE_NAME}`, {
              method: 'GET',
              headers,
            });
            
            if (stateRes.status === 404) {
              qrcodeResult = {
                success: false,
                error: 'Instância não encontrada. Crie a instância primeiro.',
              };
              break;
            }
            
            const stateParsed = await safeJsonParse(stateRes);
            
            if (!stateParsed.ok) {
              htmlErrorCount++;
              if (htmlErrorCount >= 3) {
                qrcodeResult = {
                  success: false,
                  error: stateParsed.isHtml 
                    ? 'Evolution API está offline ou URL expirou. Verifique o servidor.' 
                    : stateParsed.error || 'Erro de conexão',
                  message: `URL: ${baseUrl}`,
                };
                break;
              }
              lastError = stateParsed.error || 'Resposta inválida';
              await delay(POLL_INTERVAL);
              continue;
            }
            
            const stateData = stateParsed.data;
            lastState = stateData?.instance?.state || stateData?.state || 'unknown';
            
            if (lastState === 'open' || lastState === 'connected') {
              console.info('[wa-instance-manage] Already connected, no QR needed');
              qrcodeResult = {
                success: true,
                connected: true,
                message: 'WhatsApp já está conectado!',
              };
              break;
            }
            
            // Try to get QR code
            const qrRes = await fetch(`${baseUrl}/instance/connect/${EVOLUTION_INSTANCE_NAME}`, {
              method: 'GET',
              headers,
            });
            
            const qrParsed = await safeJsonParse(qrRes);
            
            if (!qrParsed.ok) {
              htmlErrorCount++;
              if (htmlErrorCount >= 3) {
                qrcodeResult = {
                  success: false,
                  error: 'Evolution API não está respondendo corretamente.',
                };
                break;
              }
              lastError = qrParsed.error || 'Resposta inválida';
              await delay(POLL_INTERVAL);
              continue;
            }
            
            const qrData = qrParsed.data;
            console.info(`[wa-instance-manage] QR response (attempt ${attempt}):`, JSON.stringify(qrData));
            
            // Check for different response formats from Evolution API v2
            // Format 1: base64 image directly
            if (qrData?.base64 || qrData?.qrcode?.base64) {
              const base64 = qrData?.base64 || qrData?.qrcode?.base64;
              const prefix = base64.startsWith('data:') ? '' : 'data:image/png;base64,';
              qrcodeResult = {
                success: true,
                qrcode: `${prefix}${base64}`,
                message: 'Escaneie o QR Code com o WhatsApp',
                progress: { attempt, maxAttempts: MAX_ATTEMPTS, state: lastState },
              };
              break;
            }
            
            // Format 2: code text (for generating QR in frontend)
            if (qrData?.code && qrData?.count > 0) {
              console.info('[wa-instance-manage] Got QR code text, count:', qrData.count);
              qrcodeResult = {
                success: true,
                qrcodeText: qrData.code,
                pairingCode: qrData.pairingCode || undefined,
                message: 'Escaneie o QR Code com o WhatsApp',
                progress: { attempt, maxAttempts: MAX_ATTEMPTS, state: lastState },
              };
              break;
            }
            
            // Format 3: pairingCode only (rare)
            if (qrData?.pairingCode && !qrData?.code) {
              qrcodeResult = {
                success: true,
                pairingCode: qrData.pairingCode,
                message: 'Use o código de pareamento no WhatsApp',
                progress: { attempt, maxAttempts: MAX_ATTEMPTS, state: lastState },
              };
              break;
            }
            
            // Not ready yet (count: 0) - Try auto-recovery at midpoint
            if ((qrData?.count === 0 || !qrData?.code) && attempt === RECOVERY_AT_ATTEMPT && !didRecovery) {
              console.info('[wa-instance-manage] Attempting auto-recovery (restart)...');
              didRecovery = true;
              
              // Try to restart the instance
              try {
                await fetch(`${baseUrl}/instance/restart/${EVOLUTION_INSTANCE_NAME}`, {
                  method: 'POST',
                  headers,
                });
                console.info('[wa-instance-manage] Restart triggered, waiting 5s...');
                await delay(5000); // Wait for restart to complete
              } catch (restartError) {
                console.error('[wa-instance-manage] Auto-recovery restart failed:', restartError);
              }
            }
            
            // Not ready yet (count: 0)
            if (qrData?.count === 0 || !qrData?.code) {
              lastError = `QR Code ainda não está pronto (estado: ${lastState})`;
              console.info(`[wa-instance-manage] QR not ready yet (count: ${qrData?.count}, state: ${lastState}), waiting ${POLL_INTERVAL}ms...`);
              
              if (attempt < MAX_ATTEMPTS) {
                await delay(POLL_INTERVAL);
                continue;
              }
            }
            
          } catch (fetchError: unknown) {
            const errMsg = fetchError instanceof Error ? fetchError.message : 'Unknown error';
            console.error(`[wa-instance-manage] Fetch error on attempt ${attempt}:`, errMsg);
            lastError = `Erro de conexão: ${errMsg}`;
            
            if (attempt < MAX_ATTEMPTS) {
              await delay(POLL_INTERVAL);
              continue;
            }
          }
        }
        
        if (qrcodeResult) {
          result = qrcodeResult;
        } else {
          result = {
            success: false,
            error: 'QR Code não disponível após várias tentativas',
            message: `${lastError}. ${didRecovery ? 'Auto-recovery foi tentado.' : ''} Tente "Resetar Sessão" ou "Recriar Instância".`,
            progress: { attempt: MAX_ATTEMPTS, maxAttempts: MAX_ATTEMPTS, state: lastState },
          };
        }
        break;
      }

      case 'disconnect': {
        // Logout/disconnect (alias for logout)
        console.info('[wa-instance-manage] Disconnecting...');
        
        try {
          const logoutRes = await fetch(`${baseUrl}/instance/logout/${EVOLUTION_INSTANCE_NAME}`, {
            method: 'DELETE',
            headers,
          });
          
          const parsed = await safeJsonParse(logoutRes);
          if (!parsed.ok && parsed.isHtml) {
            result = {
              success: false,
              error: 'Evolution API inacessível.',
            };
            break;
          }
          
          console.info('[wa-instance-manage] Logout response:', JSON.stringify(parsed.data));
          
          result = {
            success: true,
            connected: false,
            message: 'Desconectado com sucesso',
          };
        } catch (fetchError) {
          console.error('[wa-instance-manage] Disconnect error:', fetchError);
          result = {
            success: false,
            error: 'Erro ao desconectar.',
          };
        }
        break;
      }

      default:
        result = {
          success: false,
          error: `Ação desconhecida: ${action}`,
        };
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('[wa-instance-manage] Unexpected error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Erro interno do servidor',
        message: errorMessage 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
