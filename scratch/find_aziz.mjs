import { createClient } from '@supabase/supabase-js';
const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function find() {
    const { data: trxs } = await supabase.from('transaksi').select('*').ilike('customer->>nama', '%Aziz%');
    console.log("Transactions for Aziz:");
    console.log(JSON.stringify(trxs, null, 2));

    const { data: goats } = await supabase.from('stok_kambing').select('*').eq('no_tali', '11');
    console.log("\nGoats with No Tali 11:");
    console.log(JSON.stringify(goats, null, 2));
}

find();
