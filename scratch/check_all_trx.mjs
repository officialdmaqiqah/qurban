import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAllTrx() {
    const { data: trxs, error } = await supabase.from('transaksi').select('*');
    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Total Trxs:', trxs?.length);
        if (trxs?.length > 0) {
            console.log('Sample:', trxs[0]);
        }
    }
}

checkAllTrx();
