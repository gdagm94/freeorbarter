import { supabase } from './supabase';

export interface Report {
  id: string;
  reporter_id: string;
  target_type: 'user' | 'item' | 'message' | 'comment' | 'other';
  target_id: string;
  category: string;
  description: string | null;
  status: 'pending' | 'in_review' | 'resolved' | 'dismissed';
  metadata: Record<string, unknown> | null;
  created_at: string;
  resolved_at?: string | null;
  resolved_by?: string | null;
  resolution_notes?: string | null;
  reporter?: {
    username: string;
    avatar_url: string | null;
  };
}

export interface ReportTarget {
  type: 'user' | 'item' | 'message';
  data: any;
}

export interface ReportWithTarget extends Report {
  target?: ReportTarget;
}

/**
 * Fetch reports with optional status filter
 */
export async function fetchReports(status?: string): Promise<Report[]> {
  let query = supabase
    .from('reports')
    .select(`
      *,
      reporter:reporter_id (
        username,
        avatar_url
      )
    `)
    .order('created_at', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message || 'Failed to fetch reports');
  }

  return data || [];
}

/**
 * Get the target content for a report (item, message, or user)
 */
export async function getReportTarget(report: Report): Promise<ReportTarget | null> {
  try {
    switch (report.target_type) {
      case 'item': {
        const { data, error } = await supabase
          .from('items')
          .select('id, title, description, images, user_id, created_at')
          .eq('id', report.target_id)
          .single();

        if (error || !data) return null;
        return { type: 'item', data };
      }

      case 'message': {
        const { data, error } = await supabase
          .from('messages')
          .select('id, content, sender_id, receiver_id, created_at, image_url')
          .eq('id', report.target_id)
          .single();

        if (error || !data) return null;
        return { type: 'message', data };
      }

      case 'user': {
        const { data, error } = await supabase
          .from('users')
          .select('id, username, avatar_url, created_at')
          .eq('id', report.target_id)
          .single();

        if (error || !data) return null;
        return { type: 'user', data };
      }

      default:
        return null;
    }
  } catch (err) {
    console.error('Error fetching report target:', err);
    return null;
  }
}

/**
 * Update report status
 */
export async function updateReportStatus(
  reportId: string,
  status: 'pending' | 'in_review' | 'resolved' | 'dismissed',
  notes?: string
): Promise<void> {
  const updateData: any = {
    status,
  };

  if (status === 'resolved' || status === 'dismissed') {
    updateData.resolved_at = new Date().toISOString();
    if (notes) {
      updateData.resolution_notes = notes;
    }
  }

  const { error } = await supabase
    .from('reports')
    .update(updateData)
    .eq('id', reportId);

  if (error) {
    throw new Error(error.message || 'Failed to update report status');
  }
}

/**
 * Check if current user is a moderator
 */
export async function isModerator(): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    // Check JWT claims for moderator/admin role
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return false;

    const role = session.user.user_metadata?.role || session.user.app_metadata?.role;
    return role === 'moderator' || role === 'admin';
  } catch {
    return false;
  }
}

