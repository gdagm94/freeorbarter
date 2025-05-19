import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Pusher from 'npm:pusher@5.1.1-beta';

const pusher = new Pusher({
  appId: '1983922',
  key: 'f0bfc4cf89cd7a215ee0',
  secret: '7ff32ce242cadefb269f',
  cluster: 'mt1',
  useTLS: true
});

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { channel, event, data } = body;

    // Validate channel name format
    if (!channel.startsWith('private-')) {
      throw new Error('Invalid channel name format');
    }

    await pusher.trigger(channel, event, data);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});