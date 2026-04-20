
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkAllKeys() {
    const { data, error } = await supabase.from('master_data').select('key, val');
    if (error) {
        console.error('Error:', error);
    } else {
        console.log('All Master Data Keys:');
        data.forEach(d => console.log(`- ${d.key}: ${JSON.stringify(d.val).slice(0, 50)}...`));
    }
}

checkAllKeys();
