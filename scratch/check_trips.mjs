import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTrips() {
    const { data, error } = await supabase.from('master_data').select('val').eq('key', 'TRIPS').single();
    if (error) {
        console.error(error);
        return;
    }
    console.log('Total Trips:', data.val?.length || 0);
    console.log('Sample Trips:', JSON.stringify(data.val?.slice(0, 5), null, 2));
}

checkTrips();
