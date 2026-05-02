import { createClient } from '@supabase/supabase-js';
const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data: trx } = await supabase.from('transaksi').select('*').eq('id', 'TRX00046').single();
    if (trx) {
        console.log("Transaction TRX00046 found:");
        console.log(JSON.stringify(trx, null, 2));
    } else {
        console.log("Transaction TRX00046 NOT found.");
        // Try searching for any transaction with '46' in the ID
        const { data: partial } = await supabase.from('transaksi').select('id, customer').ilike('id', '%46%');
        console.log("Transactions with 46 in ID:", partial);
    }
}

check();
