// @ts-ignore Edge runtime Deno
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
// @ts-ignore Supabase client for Deno
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.1?dts';

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  throw new Error('Configuration error.');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const authHeader = req.headers.get('Authorization') ?? '';

  const supabaseClient = createClient(supabaseUrl, serviceRoleKey, {
    global: {
      headers: { Authorization: authHeader },
    },
  });

  try {
    const { data: policy, error: policyError } = await supabaseClient
      .from('moderation_policies')
      .select('*')
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (policyError || !policy) {
      return new Response(JSON.stringify({ error: 'No policy found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let accepted = false;
    let acceptanceRecord: { accepted_at: string | null } | null = null;

    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (user) {
      const { data: acceptance } = await supabaseClient
        .from('user_policy_acceptances')
        .select('accepted_at')
        .eq('user_id', user.id)
        .eq('policy_id', policy.id)
        .maybeSingle();

      if (acceptance) {
        accepted = true;
        acceptanceRecord = acceptance;
      }
    }

    return new Response(
      JSON.stringify({
        policy: {
          id: policy.id,
          version: policy.version,
          title: policy.title,
          content: policy.content,
          publishedAt: policy.published_at,
          requireReacceptAfter: policy.require_reaccept_after,
        },
        accepted,
        acceptance: acceptanceRecord,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    console.error('policy-latest error', err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

