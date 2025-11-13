import { supabase } from './supabase';

export type ModerationAction = 'remove_content' | 'ban_user' | 'dismiss_report' | 'warn_user';
export type ReportTargetType = 'user' | 'item' | 'message' | 'comment' | 'other';

interface ModerateActionOptions {
  action: ModerationAction;
  reportId?: string;
  targetType: ReportTargetType;
  targetId: string;
  notes?: string;
}

interface ModerateActionResponse {
  success: boolean;
  message?: string;
}

/**
 * Perform a moderation action (remove content, ban user, dismiss report)
 */
export async function moderateAction({
  action,
  reportId,
  targetType,
  targetId,
  notes,
}: ModerateActionOptions): Promise<ModerateActionResponse> {
  const { data, error } = await supabase.functions.invoke<ModerateActionResponse>('moderate-action', {
    body: {
      action,
      reportId,
      targetType,
      targetId,
      notes,
    },
  });

  if (error) {
    console.error('Moderate action error:', error);
    // Try to extract more detailed error message
    const errorMessage = error.message || error.context?.message || 'Failed to perform moderation action';
    const errorDetails = error.context?.error || error.context;
    throw new Error(errorDetails ? `${errorMessage}: ${JSON.stringify(errorDetails)}` : errorMessage);
  }

  if (!data) {
    throw new Error('No response from moderation service');
  }

  return data;
}

/**
 * Remove content (item or message)
 */
export async function removeContent(
  targetType: 'item' | 'message',
  targetId: string,
  reportId?: string,
  notes?: string
): Promise<void> {
  await moderateAction({
    action: 'remove_content',
    reportId,
    targetType,
    targetId,
    notes,
  });
}

/**
 * Ban a user
 */
export async function banUser(
  userId: string,
  reportId?: string,
  reason?: string
): Promise<void> {
  await moderateAction({
    action: 'ban_user',
    reportId,
    targetType: 'user',
    targetId: userId,
    notes: reason,
  });
}

/**
 * Dismiss a report (no action taken)
 */
export async function dismissReport(
  reportId: string,
  notes?: string
): Promise<void> {
  // First get the report to find target info
  const { data: report, error: reportError } = await supabase
    .from('reports')
    .select('target_type, target_id')
    .eq('id', reportId)
    .single();

  if (reportError || !report) {
    throw new Error('Report not found');
  }

  await moderateAction({
    action: 'dismiss_report',
    reportId,
    targetType: report.target_type,
    targetId: report.target_id,
    notes,
  });
}

/**
 * Resolve a report with an action
 */
export async function resolveReport(
  reportId: string,
  action: 'remove_content' | 'ban_user' | 'dismiss_report',
  targetType: ReportTargetType,
  targetId: string,
  notes?: string
): Promise<void> {
  await moderateAction({
    action,
    reportId,
    targetType,
    targetId,
    notes,
  });
}

