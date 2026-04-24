import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
    // We can't really check schema directly without admin, but we can try to insert a dummy key
    const { error } = await supabase.from('master_data').upsert({ key: 'TEST_KEY', val: 'test' });
    console.log('Upsert Error:', error);
}

checkSchema();
