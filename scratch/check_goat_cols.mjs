
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://juscihvfhmibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';
const supabase = createClient(supabaseUrl, supabaseKey)

async function checkGoatColumns() {
    const { data, error } = await supabase.from('stok_kambing').select('*').limit(1);
    if (error) return console.error(error);
    if (data && data.length > 0) {
        console.log('Columns:', Object.keys(data[0]));
    }
}

checkGoatColumns();
