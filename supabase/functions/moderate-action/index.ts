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

interface ModerateActionRequest {
  action: 'remove_content' | 'ban_user' | 'dismiss_report' | 'warn_user';
  reportId?: string;
  targetType: 'user' | 'item' | 'message' | 'comment' | 'other';
  targetId: string;
  notes?: string;
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

  // Create user client to verify auth and role
  const userClient = createClient(supabaseUrl, serviceRoleKey, {
    global: {
      headers: { Authorization: authHeader },
    },
  });

  // Create service role client for database operations (bypasses RLS)
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  try {
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if user is moderator/admin
    // First try JWT claims
    const { data: { session } } = await userClient.auth.getSession();
    let role = session?.user?.user_metadata?.role || session?.user?.app_metadata?.role;
    
    // If role not in JWT, check auth.users table directly using admin client
    if (!role || (role !== 'moderator' && role !== 'admin')) {
      const { data: authUser, error: authError } = await adminClient.auth.admin.getUserById(user.id);
      
      if (!authError && authUser?.user) {
        role = authUser.user.user_metadata?.role || authUser.user.app_metadata?.role;
      }
    }
    
    // Log role check for debugging
    console.log('Role check:', {
      userId: user.id,
      role,
      userMetadata: session?.user?.user_metadata,
      appMetadata: session?.user?.app_metadata,
    });
    
    if (role !== 'moderator' && role !== 'admin') {
      return new Response(JSON.stringify({ 
        error: 'Forbidden: Moderator access required',
        details: `User role: ${role || 'none'}, User ID: ${user.id}`
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body: ModerateActionRequest = await req.json();
    const { action, reportId, targetType, targetId, notes } = body;

    if (!action) {
      return new Response(JSON.stringify({ error: 'Missing required field: action' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // For dismiss_report, reportId is required
    if (action === 'dismiss_report' && !reportId) {
      return new Response(JSON.stringify({ error: 'Missing required field: reportId (required for dismiss_report)' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!targetType || !targetId) {
      return new Response(JSON.stringify({ error: 'Missing required fields: targetType, targetId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Perform the moderation action
    switch (action) {
      case 'remove_content': {
        if (targetType === 'item') {
          // Delete the item
          const { error: deleteError } = await adminClient
            .from('items')
            .delete()
            .eq('id', targetId);

          if (deleteError) {
            console.error('Error deleting item:', deleteError);
            return new Response(JSON.stringify({ error: 'Failed to remove content' }), {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        } else if (targetType === 'message') {
          // Delete the message
          const { error: deleteError } = await adminClient
            .from('messages')
            .delete()
            .eq('id', targetId);

          if (deleteError) {
            console.error('Error deleting message:', deleteError);
            return new Response(JSON.stringify({ error: 'Failed to remove content' }), {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        }
        break;
      }

      case 'ban_user': {
        if (targetType !== 'user') {
          return new Response(JSON.stringify({ error: 'Invalid target type for ban_user action' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Call the ban_user function
        const { error: banError } = await adminClient.rpc('ban_user', {
          user_id_to_ban: targetId,
          ban_reason: notes || null,
        });

        if (banError) {
          console.error('Error banning user:', banError);
          return new Response(JSON.stringify({ error: 'Failed to ban user' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        break;
      }

      case 'dismiss_report':
        // Just update the report status, no content removal
        break;

      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    // Log the moderation action
    const { error: logError } = await adminClient
      .from('moderation_actions')
      .insert({
        moderator_id: user.id,
        report_id: reportId || null,
        action_type: action,
        target_type: targetType,
        target_id: targetId,
        notes: notes || null,
      });

    if (logError) {
      console.error('Error logging moderation action:', logError);
      // Don't fail the request if logging fails
    }

    // Update report status if reportId is provided
    if (reportId) {
      // First, verify the report exists
      const { data: existingReport, error: fetchError } = await adminClient
        .from('reports')
        .select('id, status')
        .eq('id', reportId)
        .single();

      if (fetchError || !existingReport) {
        console.error('Report not found:', { reportId, error: fetchError });
        return new Response(JSON.stringify({ error: 'Report not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const reportStatus = action === 'dismiss_report' ? 'dismissed' : 'resolved';
      const updateData: any = {
        status: reportStatus,
        resolved_at: new Date().toISOString(),
        resolved_by: user.id,
      };

      if (notes) {
        updateData.resolution_notes = notes;
      }

      console.log('Updating report:', { 
        reportId, 
        currentStatus: existingReport.status,
        newStatus: reportStatus, 
        updateData 
      });

      const { data: updatedReport, error: updateError } = await adminClient
        .from('reports')
        .update(updateData)
        .eq('id', reportId)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating report status:', {
          error: updateError,
          code: updateError.code,
          message: updateError.message,
          details: updateError.details,
          hint: updateError.hint,
        });
        return new Response(JSON.stringify({ 
          error: `Failed to update report: ${updateError.message}`,
          details: updateError.details,
          hint: updateError.hint,
          code: updateError.code
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!updatedReport) {
        console.error('Report not found after update attempt:', reportId);
        return new Response(JSON.stringify({ error: 'Report not found after update' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log('Report updated successfully:', updatedReport.id);
    }

    return new Response(JSON.stringify({ 
      success: true,
      message: `Action ${action} completed successfully`
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    console.error('Moderation action failed', err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

