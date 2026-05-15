
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';
const supabase = createClient(supabaseUrl, supabaseKey)

async function checkTrx() {
    const { data, error } = await supabase.from('transaksi').select('id, items').limit(10);
    if (error) return console.error(error);
    
    data.forEach(t => {
        console.log('TRX:', t.id);
        if (t.items && t.items.length > 0) {
            console.log('  Keys in item[0]:', Object.keys(t.items[0]));
            console.log('  Sample Item:', JSON.stringify(t.items[0]));
        }
    });
}

checkTrx();
