import { supabase } from './supabase';

export type ContentType = 'item_title' | 'item_description' | 'message';

export interface FilterResult {
  allowed: boolean;
  blocked: boolean;
  warned: boolean;
  matchedKeywords?: Array<{
    keyword: string;
    severity: 'warning' | 'block';
  }>;
  message?: string;
}

interface CheckContentOptions {
  content: string;
  contentType: ContentType;
  contentId?: string;
}

export async function checkContent({
  content,
  contentType,
  contentId,
}: CheckContentOptions): Promise<FilterResult> {
  const { data, error } = await supabase.functions.invoke<FilterResult>('content-filter', {
    body: {
      content,
      contentType,
      contentId,
    },
  });

  if (error || !data) {
    throw new Error(error?.message ?? 'Failed to check content');
  }

  return data;
}

