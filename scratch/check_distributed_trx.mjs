import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data: trxs } = await supabase.from('transaksi').select('id, items, status_pengiriman, status_pembayaran');
    console.log("Total Transactions:", trxs ? trxs.length : 0);
    if(trxs) {
        trxs.forEach(t => {
            if(t.status_pengiriman !== 'Menunggu') console.log(t);
        });
    }
}

check();
