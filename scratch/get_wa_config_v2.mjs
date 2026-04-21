import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function getConfig() {
    const { data, error } = await supabase.from('master_data').select('*').eq('key', 'WA_CONFIG').single();
    if (error) {
        console.error('Error:', error);
        return;
    }
    console.log(JSON.stringify(data.val, null, 2));
}

getConfig();
