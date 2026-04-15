const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function listKeys() {
    const { data } = await supabase.from('master_data').select('key');
    console.log('Keys in master_data:', data.map(d => d.key));
}

listKeys();
