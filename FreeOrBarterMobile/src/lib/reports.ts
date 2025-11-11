import { supabase } from './supabase';

export const REPORT_CATEGORIES = [
  { value: 'harassment', label: 'Harassment or bullying' },
  { value: 'spam', label: 'Spam or scam' },
  { value: 'inappropriate', label: 'Inappropriate or adult content' },
  { value: 'illegal', label: 'Illegal or dangerous activity' },
  { value: 'self-harm', label: 'Self-harm or suicide' },
  { value: 'other', label: 'Other' },
];

interface SubmitReportOptions {
  targetType: 'user' | 'item' | 'message' | 'comment' | 'other';
  targetId: string;
  category: string;
  description?: string;
}

export async function submitReport({
  targetType,
  targetId,
  category,
  description,
}: SubmitReportOptions) {
  const { data, error } = await supabase.functions.invoke<{ report?: { id: string } }>('report-create', {
    body: {
      targetType,
      targetId,
      category,
      description,
      metadata: { source: 'mobile' },
    },
  });

  if (error || !data?.report?.id) {
    throw new Error(error?.message ?? 'Failed to submit report');
  }

  return data.report.id;
}

