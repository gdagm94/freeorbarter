// @ts-ignore
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
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseClient = createClient(supabaseUrl, serviceRoleKey, {
    global: {
      headers: { Authorization: authHeader },
    },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  try {
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const policyId = body?.policyId as string | undefined;
    const platform = (body?.platform as string | undefined) ?? 'web';

    if (!policyId) {
      return new Response(JSON.stringify({ error: 'policyId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: policy, error: policyError } = await supabaseClient
      .from('moderation_policies')
      .select('id')
      .eq('id', policyId)
      .maybeSingle();

    if (policyError || !policy) {
      return new Response(JSON.stringify({ error: 'Invalid policy' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Ensure a related profile exists so foreign keys succeed
    const genderMeta = (user.user_metadata?.gender ?? '').toLowerCase();
    const normalizedGender =
      genderMeta === 'male' || genderMeta === 'female' ? genderMeta : null;

    const zipcodeMeta = (user.user_metadata?.zipcode ?? '').trim();
    const normalizedZipcode = /^\d{5}$/.test(zipcodeMeta) ? zipcodeMeta : null;

    const { error: ensureProfileError } = await adminClient
      .from('users')
      .upsert(
        {
          id: user.id,
          full_name: user.user_metadata?.full_name ?? user.email ?? '',
          username: user.user_metadata?.username ?? null,
          gender: normalizedGender,
          zipcode: normalizedZipcode,
          profile_completed: false,
          created_at: user.created_at ?? new Date().toISOString(),
        },
        { onConflict: 'id' },
      );

    if (ensureProfileError) {
      console.error('policy-accept profile upsert error', ensureProfileError);
      return new Response(JSON.stringify({ error: 'Failed to prepare profile record' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { error: upsertError } = await adminClient
      .from('user_policy_acceptances')
      .upsert(
        {
          user_id: user.id,
          policy_id: policyId,
          platform,
          accepted_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,policy_id' },
      );

    if (upsertError) {
      console.error('policy-accept upsert error', upsertError);
      return new Response(JSON.stringify({ error: upsertError.message ?? 'Failed to record acceptance' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    console.error('policy-accept error', err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

