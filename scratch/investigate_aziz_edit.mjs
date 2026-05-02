import { createClient } from '@supabase/supabase-js';
const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    console.log("--- TRANSACTION TRX00046 ---");
    const { data: trx } = await supabase.from('transaksi').select('*').eq('id', 'TRX00046').single();
    console.log(JSON.stringify(trx, null, 2));

    console.log("\n--- GOAT 02 MERAH ---");
    const { data: goat02 } = await supabase.from('stok_kambing').select('*').eq('no_tali', '02').eq('warna_tali', 'Merah').single();
    console.log(JSON.stringify(goat02, null, 2));

    console.log("\n--- GOAT 11 PUTIH ---");
    const { data: goat11 } = await supabase.from('stok_kambing').select('*').eq('no_tali', '11').eq('warna_tali', 'Putih').single();
    console.log(JSON.stringify(goat11, null, 2));
    
    console.log("\n--- LEDGER FOR TRX00046 ---");
    const { data: ledger } = await supabase.from('keuangan').select('*').eq('transaction_id', 'TRX00046');
    console.log(JSON.stringify(ledger, null, 2));
}

check();
