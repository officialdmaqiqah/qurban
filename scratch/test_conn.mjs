
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
    console.log('Testing connection...');
    const { data, error } = await supabase.from('master_data').select('*').limit(1);
    if (error) console.error('Error:', error);
    else console.log('Master Data Sample:', data);
}

testConnection();
