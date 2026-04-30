import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function search() {
    const { data: trx, error: errTrx } = await supabase.from('transaksi').select('id, komisi');
    if (errTrx) {
        console.error("Error:", errTrx);
    } else {
        const found = trx.find(t => t.id.includes('TRX00037'));
        console.log("Found:", found);
    }
}

search();
