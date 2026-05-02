import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function listKeys() {
    console.log('--- Listing first 50 keys from master_data ---');
    const { data, error } = await supabase.from('master_data').select('key').limit(50);
    if (error) {
        console.error('Error:', error);
    } else {
        data.forEach(d => console.log(`- ${d.key}`));
    }

    console.log('\n--- Listing first 10 entries from keuangan ---');
    const { data: fin, error: finErr } = await supabase.from('keuangan').select('*').limit(10);
    if (finErr) {
        console.error('Error:', finErr);
    } else {
        console.log(JSON.stringify(fin, null, 2));
    }
}

listKeys();
