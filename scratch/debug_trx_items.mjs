
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkTrx() {
    const { data, error } = await supabase.from('transaksi').select('*').limit(5);
    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Transactions:', JSON.stringify(data, null, 2));
    }
}

checkTrx();
