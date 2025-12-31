import { supabase } from './supabase';

type PushPayload = {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  badge?: number;
};

export async function sendPushNotification(payload: PushPayload) {
  try {
    const { data, error } = await supabase.functions.invoke('send-push', {
      body: {
        user_id: payload.userId,
        title: payload.title,
        body: payload.body,
        data: payload.data ?? {},
        badge: payload.badge,
      },
    });

    if (error) {
      console.warn('send-push returned error', error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (err) {
    console.warn('Failed to invoke send-push', err);
    return { success: false, error: err };
  }
}

