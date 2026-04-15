const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAgents() {
    const { data } = await supabase.from('master_data').select('val').eq('key', 'AGENS').single();
    console.log('Agents Data:', JSON.stringify(data?.val, null, 2));
}

checkAgents();
