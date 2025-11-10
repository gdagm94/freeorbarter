// @ts-ignore Remote Deno standard library import resolved at deploy time
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
// @ts-ignore Supabase client is bundled in the Deno runtime environment
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.1?dts';

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
  console.error('Missing required environment variables for delete-account function');
  throw new Error('Missing Supabase environment configuration');
}

const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type StoragePaths = Record<string, Set<string>>;

const parseStoragePath = (url?: string | null): { bucket: string; path: string } | null => {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    const prefix = '/storage/v1/object/public/';
    const idx = parsed.pathname.indexOf(prefix);
    if (idx === -1) return null;

    const bucketAndPath = parsed.pathname.slice(idx + prefix.length);
    const slashIndex = bucketAndPath.indexOf('/');
    if (slashIndex === -1) return null;

    const bucket = bucketAndPath.slice(0, slashIndex);
    const path = bucketAndPath.slice(slashIndex + 1);
    if (!bucket || !path) return null;

    return { bucket, path };
  } catch (_err) {
    return null;
  }
};

const addStorageUrl = (storagePaths: StoragePaths, url?: string | null) => {
  const parsed = parseStoragePath(url);
  if (!parsed) return;

  if (!storagePaths[parsed.bucket]) {
    storagePaths[parsed.bucket] = new Set();
  }
  storagePaths[parsed.bucket].add(parsed.path);
};

const extractMetadata = (
  body: Record<string, unknown> | null,
  method: string,
): Record<string, unknown> => {
  if (!body || typeof body !== 'object') {
    return { source: 'edge-delete-account', method };
  }

  const metadata: Record<string, unknown> = { source: 'edge-delete-account', method };

  if (typeof body.reason === 'string' && body.reason.trim().length > 0) {
    metadata.reason = body.reason.trim().slice(0, 500);
  }

  if (typeof body.feedback === 'string' && body.feedback.trim().length > 0) {
    metadata.feedback = body.feedback.trim().slice(0, 2000);
  }

  if (typeof body.platform === 'string' && body.platform.trim().length > 0) {
    metadata.platform = body.platform.trim().slice(0, 120);
  }

  if (typeof body.appVersion === 'string' && body.appVersion.trim().length > 0) {
    metadata.app_version = body.appVersion.trim().slice(0, 64);
  }

  if (typeof body.requestFollowUp === 'boolean') {
    metadata.request_follow_up = body.requestFollowUp;
  }

  return metadata;
};

const safeJsonParse = async (req: Request): Promise<Record<string, unknown> | null> => {
  const contentType = req.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return null;
  }

  try {
    const body = await req.json();
    if (body && typeof body === 'object' && !Array.isArray(body)) {
      return body as Record<string, unknown>;
    }
    return null;
  } catch (error) {
    console.warn('Account deletion request body could not be parsed as JSON', error);
    return null;
  }
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'DELETE' && req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed. Use DELETE.' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  const authorization = req.headers.get('Authorization');
  if (!authorization) {
    return new Response(
      JSON.stringify({ error: 'Missing Authorization header' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  const body = await safeJsonParse(req);
  const metadata = extractMetadata(body, req.method);

  const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authorization } },
  });

  try {
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired session' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const userId = user.id;
    const storagePaths: StoragePaths = {};

    // Fetch user profile
    const { data: profile, error: profileError } = await adminClient
      .from('users')
      .select('avatar_url')
      .eq('id', userId)
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      throw new Error(`Failed to fetch profile: ${profileError.message}`);
    }

    if (profile?.avatar_url) {
      addStorageUrl(storagePaths, profile.avatar_url);
    }

    // Fetch user items for storage cleanup
    const { data: items, error: itemsError } = await adminClient
      .from('items')
      .select('id, images')
      .eq('user_id', userId);

    if (itemsError) {
      throw new Error(`Failed to fetch items: ${itemsError.message}`);
    }

    for (const item of items ?? []) {
      if (Array.isArray(item.images)) {
        for (const imageUrl of item.images) {
          addStorageUrl(storagePaths, imageUrl);
        }
      }
    }

    // Fetch user messages and attachments for cleanup
    const { data: messages, error: messagesError } = await adminClient
      .from('messages')
      .select('id, image_url, file_url')
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);

    if (messagesError) {
      throw new Error(`Failed to fetch messages: ${messagesError.message}`);
    }

    const messageIds = (messages ?? []).map((message) => message.id);

    for (const message of messages ?? []) {
      addStorageUrl(storagePaths, message.image_url);
      addStorageUrl(storagePaths, message.file_url);
    }

    if (messageIds.length > 0) {
      const { data: messageFiles, error: messageFilesError } = await adminClient
        .from('message_files')
        .select('file_url')
        .in('message_id', messageIds);

      if (messageFilesError) {
        throw new Error(`Failed to fetch message files: ${messageFilesError.message}`);
      }

      for (const file of messageFiles ?? []) {
        addStorageUrl(storagePaths, file.file_url);
      }
    }

    const { error: cleanupError } = await adminClient.rpc('delete_user_account_data', {
      target_user_id: userId,
      target_email: user.email ?? null,
      metadata,
    });

    if (cleanupError) {
      throw new Error(`Failed to purge relational data: ${cleanupError.message}`);
    }

    const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(userId);
    if (deleteAuthError) {
      throw new Error(`Failed to delete auth user: ${deleteAuthError.message}`);
    }

    // Remove storage objects
    for (const [bucket, paths] of Object.entries(storagePaths)) {
      if (paths.size === 0) continue;
      const { error: storageError } = await adminClient.storage
        .from(bucket)
        .remove([...paths]);
      if (storageError) {
        console.error(`Failed to remove storage objects from bucket ${bucket}`, storageError);
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('Account deletion failed', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
