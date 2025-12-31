// @ts-ignore Supabase Edge runtime globals
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
// @ts-ignore Supabase Edge runtime globals
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
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

type PushRequest = {
  user_id: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  badge?: number;
  sound?: 'default' | null;
};

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

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
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    global: {
      headers: authHeader ? { Authorization: authHeader } : undefined,
    },
  });

  try {
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload = (await req.json()) as PushRequest;
    const { user_id, title, body, data, badge, sound } = payload ?? {};

    if (!user_id || !title || !body) {
      return new Response(JSON.stringify({ error: 'user_id, title, and body are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: tokens, error: tokenError } = await supabase
      .from('user_push_tokens')
      .select('push_token, platform')
      .eq('user_id', user_id)
      .eq('disabled', false);

    if (tokenError) {
      console.error('Failed to load tokens', tokenError);
      return new Response(JSON.stringify({ error: 'Failed to load tokens' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!tokens || tokens.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: 'No tokens' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { count: unreadMessages, error: unreadMsgError } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('receiver_id', user_id)
      .eq('read', false);

    const { count: unreadNotifications, error: unreadNotifError } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user_id)
      .eq('read', false);

    if (unreadMsgError) console.warn('Badge query failed (messages)', unreadMsgError);
    if (unreadNotifError) console.warn('Badge query failed (notifications)', unreadNotifError);

    const computedBadge =
      typeof badge === 'number'
        ? badge
        : (unreadMessages ?? 0) + (unreadNotifications ?? 0);

    const expoMessages = tokens.map((token) => ({
      to: token.push_token,
      title,
      body,
      sound: sound ?? 'default',
      badge: computedBadge,
      data: data ?? {},
      priority: 'high',
    }));

    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(expoMessages),
    });

    const result = await response.json();
    const invalidTokens: string[] = [];
    let sentCount = 0;

    if (Array.isArray(result?.data)) {
      result.data.forEach((item: any, idx: number) => {
        const isOk = item?.status === 'ok';
        if (isOk) {
          sentCount += 1;
        } else if (item?.details?.error === 'DeviceNotRegistered') {
          invalidTokens.push(tokens[idx].push_token);
        }
      });
    }

    if (invalidTokens.length > 0) {
      await supabase
        .from('user_push_tokens')
        .delete()
        .in('push_token', invalidTokens);
    }

    return new Response(
      JSON.stringify({ sent: sentCount, badge: computedBadge, invalidTokens }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Unhandled error in send-push', error);
    return new Response(JSON.stringify({ error: 'Unexpected error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

