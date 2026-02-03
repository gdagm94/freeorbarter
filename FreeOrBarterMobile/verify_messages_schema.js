const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://xvdltodlekapbklymsvz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh2ZGx0b2RsZWthcGJrbHltc3Z6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzkyOTM1NjgsImV4cCI6MjA1NDg2OTU2OH0.XBHXWOUx_B5SAFagTYDk-2F1M8THGagtNOaazqkQ95k';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRLS() {
    console.log('Testing RLS update...');

    // 1. Sign in as a test user (you might need to provide credentials or create a temp user if possible, 
    // or just use the anon key if we can mock auth, but RLS usually needs a real user).
    // SINCE I CANNOT INTERACTIVELY LOGIN, I WILL TRY TO UPDATE A MESSAGE SENT BY A SPECIFIC USER IF I CAN FIND ONE.
    // OR BETTER: Just check if the public policy allows update (permissive).

    // Actually, checking RLS from a script with Anon key is hard if I don't have a user token.
    // BUT, I can check if the 'archived' column is even updateable at all.

    const { data, error } = await supabase
        .from('messages')
        .select('id, content, sender_id, receiver_id, archived')
        .limit(1);

    if (error) {
        console.error('Error fetching message:', error);
        return;
    }

    if (data && data.length > 0) {
        const msg = data[0];
        console.log('Found message:', msg);

        // We cannot update it without being logged in as the sender (due to RLS).
        // This script proves we can READ it.

        console.log('NOTE: To fully verify the RLS fix, we need to be logged in as user:', msg.sender_id);
        console.log('However, if the app fails, it might be the QUERY SYNTAX.');
    } else {
        console.log('No messages found (RLS might be hiding them if not logged in).');
    }
}

checkRLS();
