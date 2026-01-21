import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Log Retention Cleanup Function
 * 
 * LGPD-compliant log retention policy:
 * - Technical logs (whatsapp_logs, ai_whatsapp_logs): 90 days
 * - Audit logs (wa_audit, audit_logs): 24 months (preserved for compliance)
 * 
 * Features:
 * - Dry-run mode by default (pass dryRun=false to actually delete)
 * - Only deletes old records, never modifies existing data
 * - Fail-safe: errors don't affect application functionality
 */

interface CleanupResult {
  table: string;
  retentionDays: number;
  recordsFound: number;
  recordsDeleted: number;
  oldestRecord?: string;
  newestAffected?: string;
  error?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Parse request body
    let dryRun = true; // Default to dry-run for safety
    try {
      const body = await req.json();
      dryRun = body.dryRun !== false; // Only run actual cleanup if explicitly set to false
    } catch {
      // No body or invalid JSON - use defaults (dry-run)
    }

    console.log(`[Log Cleanup] Starting ${dryRun ? 'DRY RUN' : 'ACTUAL CLEANUP'}...`);

    const results: CleanupResult[] = [];
    const now = new Date();

    // Define retention policies (in days)
    const policies = [
      { table: 'whatsapp_logs', retentionDays: 90, dateColumn: 'created_at' },
      { table: 'ai_whatsapp_logs', retentionDays: 90, dateColumn: 'created_at' },
      { table: 'wa_messages', retentionDays: 90, dateColumn: 'created_at' },
      // Audit tables: longer retention for compliance
      { table: 'wa_audit', retentionDays: 730, dateColumn: 'created_at' }, // 24 months
      // audit_logs: preserved indefinitely (compliance requirement)
    ];

    for (const policy of policies) {
      const cutoffDate = new Date(now.getTime() - (policy.retentionDays * 24 * 60 * 60 * 1000));
      const cutoffIso = cutoffDate.toISOString();

      try {
        // Count records to be deleted
        const { count, error: countError } = await supabase
          .from(policy.table)
          .select('*', { count: 'exact', head: true })
          .lt(policy.dateColumn, cutoffIso);

        if (countError) {
          results.push({
            table: policy.table,
            retentionDays: policy.retentionDays,
            recordsFound: 0,
            recordsDeleted: 0,
            error: countError.message,
          });
          continue;
        }

        const recordCount = count || 0;

        // Get date range of affected records
        let oldestRecord: string | undefined;
        let newestAffected: string | undefined;

        if (recordCount > 0) {
          const { data: oldest } = await supabase
            .from(policy.table)
            .select(policy.dateColumn)
            .lt(policy.dateColumn, cutoffIso)
            .order(policy.dateColumn, { ascending: true })
            .limit(1)
            .single();

          const { data: newest } = await supabase
            .from(policy.table)
            .select(policy.dateColumn)
            .lt(policy.dateColumn, cutoffIso)
            .order(policy.dateColumn, { ascending: false })
            .limit(1)
            .single();

          // Type-safe access to date column
          const oldestData = oldest as Record<string, unknown> | null;
          const newestData = newest as Record<string, unknown> | null;
          oldestRecord = oldestData?.[policy.dateColumn] as string | undefined;
          newestAffected = newestData?.[policy.dateColumn] as string | undefined;
        }

        let deletedCount = 0;

        // Only delete if not dry-run
        if (!dryRun && recordCount > 0) {
          const { error: deleteError } = await supabase
            .from(policy.table)
            .delete()
            .lt(policy.dateColumn, cutoffIso);

          if (deleteError) {
            results.push({
              table: policy.table,
              retentionDays: policy.retentionDays,
              recordsFound: recordCount,
              recordsDeleted: 0,
              oldestRecord,
              newestAffected,
              error: deleteError.message,
            });
            continue;
          }

          deletedCount = recordCount;
          console.log(`[Log Cleanup] Deleted ${deletedCount} records from ${policy.table}`);
        }

        results.push({
          table: policy.table,
          retentionDays: policy.retentionDays,
          recordsFound: recordCount,
          recordsDeleted: deletedCount,
          oldestRecord,
          newestAffected,
        });

      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        results.push({
          table: policy.table,
          retentionDays: policy.retentionDays,
          recordsFound: 0,
          recordsDeleted: 0,
          error: errorMessage,
        });
      }
    }

    const totalFound = results.reduce((sum, r) => sum + r.recordsFound, 0);
    const totalDeleted = results.reduce((sum, r) => sum + r.recordsDeleted, 0);

    console.log(`[Log Cleanup] Complete. Found: ${totalFound}, Deleted: ${totalDeleted}`);

    return new Response(JSON.stringify({
      success: true,
      dryRun,
      timestamp: now.toISOString(),
      summary: {
        totalRecordsFound: totalFound,
        totalRecordsDeleted: totalDeleted,
      },
      policies: results,
      note: dryRun 
        ? 'This was a DRY RUN. No records were deleted. Set dryRun=false to actually delete.'
        : 'Cleanup completed. Records older than retention period have been deleted.',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Log Cleanup] Error:', errorMessage);
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});