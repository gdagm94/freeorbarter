// @ts-ignore Supabase Deno runtime provides global fetch and env
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
// @ts-ignore Remote module available in Edge runtime
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
  throw new Error('Configuration error');
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

  try {
    const body = await req.json();
    const { targetType, targetId, category, description, metadata } = body ?? {};

    if (!targetType || typeof targetType !== 'string') {
      return new Response(JSON.stringify({ error: 'targetType is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!targetId || typeof targetId !== 'string') {
      return new Response(JSON.stringify({ error: 'targetId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!category || typeof category !== 'string') {
      return new Response(JSON.stringify({ error: 'category is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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

    const insertPayload = {
      reporter_id: user.id,
      target_type: targetType,
      target_id: targetId,
      category: category.trim().toLowerCase(),
      description: typeof description === 'string' ? description.trim() : null,
      metadata: typeof metadata === 'object' && metadata !== null ? metadata : undefined,
    };

    const { data, error } = await supabaseClient
      .from('reports')
      .insert(insertPayload)
      .select('id, status, created_at')
      .single();

    if (error) {
      console.error('Failed to insert report', error);
      return new Response(JSON.stringify({ error: 'Failed to create report' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ report: data }), {
      status: 201,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    console.error('Report creation failed', err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

