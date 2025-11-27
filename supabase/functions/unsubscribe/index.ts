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
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing Supabase configuration for unsubscribe function');
  throw new Error('Configuration error');
}

const adminClient = createClient(supabaseUrl, serviceRoleKey);

const htmlTemplate = (title: string, body: string) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 32px; color: #111; background: #f8fafc; }
    main { max-width: 520px; margin: 0 auto; background: #fff; padding: 32px; border-radius: 12px; box-shadow: 0 15px 35px rgba(15,23,42,0.1); }
    h1 { font-size: 24px; margin-bottom: 16px; }
    p { font-size: 16px; line-height: 1.5; }
    .muted { color: #475569; margin-top: 24px; font-size: 14px; }
  </style>
</head>
<body>
  <main>
    <h1>${title}</h1>
<p>${body}</p>
    <p class="muted">If this was a mistake you can resubscribe anytime inside the FreeOrBarter app.</p>
  </main>
</body>
</html>`;

const htmlResponse = (title: string, body: string, status = 200) =>
  new Response(htmlTemplate(title, body), {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });

type SubscriberRecord = {
  id: string;
  email: string;
  unsubscribed_at: string | null;
};

const logUnsubscribe = (subscriber: SubscriberRecord, meta: { method: string; ip?: string | null; userAgent?: string | null }) => {
  console.info('[unsubscribe]', {
    subscriber: subscriber.email,
    alreadyUnsubscribed: Boolean(subscriber.unsubscribed_at),
    method: meta.method,
    ip: meta.ip ?? null,
    userAgent: meta.userAgent ?? null,
  });
};

const fetchSubscriberByToken = async (token: string) => {
  return adminClient
    .from('newsletter_subscribers')
    .select('id, email, unsubscribed_at')
    .eq('unsubscribe_token', token)
    .maybeSingle();
};

const fetchSubscriberByEmail = async (email: string) => {
  return adminClient
    .from('newsletter_subscribers')
    .select('id, email, unsubscribed_at')
    .ilike('email', email)
    .maybeSingle();
};

const markUnsubscribed = async (subscriberId: string) => {
  return adminClient
    .from('newsletter_subscribers')
    .update({ unsubscribed_at: new Date().toISOString() })
    .eq('id', subscriberId);
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const url = new URL(req.url);

  try {
    if (req.method === 'GET') {
      const token = url.searchParams.get('token')?.trim();
      if (!token) {
        return htmlResponse('Missing token', 'This unsubscribe link is missing a token.', 400);
      }

      const { data: subscriber, error } = await fetchSubscriberByToken(token);
      if (error || !subscriber) {
        console.warn('[unsubscribe] invalid token', { token, error });
        return htmlResponse('Link not found', 'This unsubscribe link has expired or is invalid.', 404);
      }

      logUnsubscribe(subscriber, {
        method: 'GET',
        ip: req.headers.get('x-forwarded-for'),
        userAgent: req.headers.get('user-agent'),
      });

      if (!subscriber.unsubscribed_at) {
        const { error: updateError } = await markUnsubscribed(subscriber.id);
        if (updateError) {
          console.error('[unsubscribe] failed to update subscriber', updateError);
          return htmlResponse('Something went wrong', 'We could not process your unsubscribe request. Please try again later.', 500);
        }
      }

      const alreadyMessage = subscriber.unsubscribed_at ? 'Looks like you were already unsubscribed. No further action was needed.' : 'You have been unsubscribed from future newsletter emails.';
      return htmlResponse('You are unsubscribed', alreadyMessage);
    }

    if (req.method === 'POST') {
      const originHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };
      const body = await req.json().catch(() => null);
      const token = typeof body?.token === 'string' ? body.token.trim() : undefined;
      const email = typeof body?.email === 'string' ? body.email.trim() : undefined;

      if (!token && !email) {
        return new Response(JSON.stringify({ error: 'token or email is required' }), { status: 400, headers: originHeaders });
      }

      const fetchResult = token ? await fetchSubscriberByToken(token) : await fetchSubscriberByEmail(email!.toLowerCase());
      const { data: subscriber, error } = fetchResult;

      if (error || !subscriber) {
        console.warn('[unsubscribe] subscriber not found', { token, email, error });
        return new Response(JSON.stringify({ error: 'Subscriber not found' }), { status: 404, headers: originHeaders });
      }

      logUnsubscribe(subscriber, {
        method: 'POST',
        ip: req.headers.get('x-forwarded-for'),
        userAgent: req.headers.get('user-agent'),
      });

      if (!subscriber.unsubscribed_at) {
        const { error: updateError } = await markUnsubscribed(subscriber.id);
        if (updateError) {
          console.error('[unsubscribe] failed to update subscriber', updateError);
          return new Response(JSON.stringify({ error: 'Failed to unsubscribe' }), { status: 500, headers: originHeaders });
        }
      }

      return new Response(JSON.stringify({ success: true, alreadyUnsubscribed: Boolean(subscriber.unsubscribed_at) }), {
        status: 200,
        headers: originHeaders,
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    console.error('[unsubscribe] unexpected error', error);
    if (req.method === 'GET') {
      return htmlResponse('Something went wrong', 'We ran into an unexpected error while processing your request.', 500);
    }
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

