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

interface FilterRequest {
  content: string;
  contentType: 'item_title' | 'item_description' | 'message';
  contentId?: string;
}

interface FilterResult {
  allowed: boolean;
  blocked: boolean;
  warned: boolean;
  matchedKeywords?: Array<{
    keyword: string;
    severity: 'warning' | 'block';
  }>;
  message?: string;
}

function normalizeText(text: string): string {
  // Convert to lowercase and remove extra whitespace
  return text.toLowerCase().trim().replace(/\s+/g, ' ');
}

function checkKeywordMatch(content: string, keyword: string, patternType: string): boolean {
  const normalizedContent = normalizeText(content);
  const normalizedKeyword = normalizeText(keyword);

  switch (patternType) {
    case 'exact':
      return normalizedContent === normalizedKeyword;
    case 'contains':
      return normalizedContent.includes(normalizedKeyword);
    case 'regex':
      try {
        const regex = new RegExp(normalizedKeyword, 'i');
        return regex.test(content);
      } catch {
        // Invalid regex, fall back to contains
        return normalizedContent.includes(normalizedKeyword);
      }
    default:
      return normalizedContent.includes(normalizedKeyword);
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

    const body: FilterRequest = await req.json();
    const { content, contentType, contentId } = body ?? {};

    if (!content || typeof content !== 'string') {
      return new Response(JSON.stringify({ error: 'content is required and must be a string' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!contentType || !['item_title', 'item_description', 'message'].includes(contentType)) {
      return new Response(JSON.stringify({ error: 'contentType must be one of: item_title, item_description, message' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch all enabled blocked keywords
    const { data: keywords, error: keywordsError } = await supabaseClient
      .from('blocked_keywords')
      .select('id, keyword, pattern_type, severity')
      .eq('enabled', true);

    if (keywordsError) {
      console.error('Failed to fetch keywords', keywordsError);
      return new Response(JSON.stringify({ error: 'Failed to check content' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check content against keywords
    const matchedKeywords: Array<{ keyword: string; severity: 'warning' | 'block' }> = [];
    let hasBlock = false;
    let hasWarning = false;
    let firstMatchedKeywordId: string | null = null;

    if (keywords && keywords.length > 0) {
      for (const kw of keywords) {
        if (checkKeywordMatch(content, kw.keyword, kw.pattern_type)) {
          matchedKeywords.push({
            keyword: kw.keyword,
            severity: kw.severity as 'warning' | 'block',
          });

          if (!firstMatchedKeywordId) {
            firstMatchedKeywordId = kw.id;
          }

          if (kw.severity === 'block') {
            hasBlock = true;
          } else if (kw.severity === 'warning') {
            hasWarning = true;
          }
        }
      }
    }

    const result: FilterResult = {
      allowed: !hasBlock,
      blocked: hasBlock,
      warned: hasWarning && !hasBlock,
      matchedKeywords: matchedKeywords.length > 0 ? matchedKeywords : undefined,
    };

    // Determine action taken
    let actionTaken: 'blocked' | 'warned' | 'allowed';
    if (hasBlock) {
      actionTaken = 'blocked';
      result.message = 'Your content contains inappropriate language and cannot be posted.';
    } else if (hasWarning) {
      actionTaken = 'warned';
      result.message = 'Your content may contain inappropriate language. Please review and edit.';
    } else {
      actionTaken = 'allowed';
    }

    // Log the filter check
    if (matchedKeywords.length > 0 && firstMatchedKeywordId) {
      const logPayload = {
        user_id: user.id,
        content_type: contentType,
        content_id: contentId || null,
        matched_keyword_id: firstMatchedKeywordId,
        action_taken: actionTaken,
        content_preview: content.substring(0, 200), // Store first 200 chars
      };

      await supabaseClient
        .from('content_filter_logs')
        .insert(logPayload);
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    console.error('Content filter check failed', err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

