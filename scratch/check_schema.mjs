
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkSchema() {
    const { data, error } = await supabase.from('keuangan').select('*').limit(1);
    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Sample Row:', JSON.stringify(data[0], null, 2));
    }
}

checkSchema();
