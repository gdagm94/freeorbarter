import { supabase } from './supabase';

export type ReportTargetType = 'user' | 'item' | 'message' | 'comment' | 'other';

export const REPORT_CATEGORIES: { value: string; label: string }[] = [
  { value: 'harassment', label: 'Harassment or bullying' },
  { value: 'spam', label: 'Spam or scam' },
  { value: 'inappropriate', label: 'Inappropriate or adult content' },
  { value: 'illegal', label: 'Illegal or dangerous activity' },
  { value: 'self-harm', label: 'Self-harm or suicide' },
  { value: 'other', label: 'Other' },
];

interface SubmitReportOptions {
  targetType: ReportTargetType;
  targetId: string;
  category: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export async function submitReport({
  targetType,
  targetId,
  category,
  description,
  metadata,
}: SubmitReportOptions) {
  const { data, error } = await supabase.functions.invoke<{ report?: { id: string } }>('report-create', {
    body: {
      targetType,
      targetId,
      category,
      description,
      metadata,
    },
  });

  if (error) {
    throw new Error(error.message || 'Failed to submit report');
  }

  if (!data?.report?.id) {
    throw new Error('Failed to submit report');
  }

  return data.report.id;
}

