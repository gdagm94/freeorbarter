// @ts-ignore Supabase Edge runtime
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.1?dts';

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const cronSecret = Deno.env.get('CRON_SECRET');

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const adminClient = createClient(supabaseUrl, serviceRoleKey);

async function callModerateAction(payload: Record<string, unknown>) {
  const response = await fetch(`${supabaseUrl}/functions/v1/moderate-action`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Moderate action failed: ${response.status} ${errText}`);
  }

  return response.json();
}

async function notifyModerators(payload: Record<string, unknown>) {
  try {
    await fetch(`${supabaseUrl}/functions/v1/pusher-trigger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel: 'private-moderators',
        event: 'report-escalation',
        data: payload,
      }),
    });
  } catch (err) {
    console.error('Failed to notify moderators', err);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (cronSecret) {
    const providedSecret =
      req.headers.get('x-cron-secret') || req.headers.get('authorization')?.replace('Bearer ', '');
    if (providedSecret !== cronSecret) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  try {
    const nowIso = new Date().toISOString();
    const { data: reports, error } = await adminClient
      .from('reports')
      .select('*')
      .in('status', ['pending', 'in_review'])
      .lt('needs_action_by', nowIso)
      .eq('auto_escalated', false)
      .limit(50);

    if (error) {
      throw error;
    }

    if (!reports || reports.length === 0) {
      return new Response(JSON.stringify({ escalated: 0, message: 'No overdue reports' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let escalated = 0;
    const autoActions: Array<{ id: string; action: string | null }> = [];

    for (const report of reports) {
      let autoAction: string | null = null;

      try {
        if (report.target_type === 'item' || report.target_type === 'message') {
          await callModerateAction({
            action: 'remove_content',
            reportId: report.id,
            targetType: report.target_type,
            targetId: report.target_id,
            notes: 'Auto-escalated removal after 24h SLA breach',
          });
          autoAction = 'remove_content';
        }

        await adminClient
          .from('reports')
          .update({
            auto_escalated: true,
            needs_action_by: report.needs_action_by ?? nowIso,
          })
          .eq('id', report.id);

        escalated += 1;
        autoActions.push({ id: report.id, action: autoAction });
      } catch (err) {
        console.error('Failed to escalate report', report.id, err);
      }
    }

    await notifyModerators({
      type: 'auto_escalation',
      escalated,
      autoActions,
      timestamp: nowIso,
    });

    return new Response(JSON.stringify({ escalated, autoActions }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Escalation function failed', err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unexpected error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});


