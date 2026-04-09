import { createClient } from '@supabase/supabase-js';
const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function listTables() {
    const { data, error } = await supabase.from('master_data').select('*', { count: 'exact' });
    console.log('master_data rows:', data?.length);
    
    // Check for other potential tables or keys
    const { data: allData, error: allErr } = await supabase.from('master_data').select('key');
    console.log('Keys in master_data:', allData);
}

listTables();
