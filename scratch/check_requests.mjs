import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRequests() {
    const { data, error } = await supabase.from('edit_requests')
        .select('*')
        .eq('status', 'pending')
        .order('timestamp', { ascending: false });

    if (error) {
        console.error('Error fetching requests:', error);
        return;
    }

    console.log('Total pending requests:', data?.length);
    console.log('Recent 5 pending requests:');
    console.log(JSON.stringify(data.slice(0, 5), null, 2));
}

checkRequests();
