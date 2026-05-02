import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTables() {
    console.log('--- Checking transaksi ---');
    const { data: trx, error: trxErr } = await supabase.from('transaksi').select('id, customer, total_deal, total_paid').limit(5);
    if (trxErr) console.error(trxErr);
    else console.log('Sample Transaksi:', trx);

    console.log('--- Checking keuangan ---');
    const { data: keu, error: keuErr } = await supabase.from('keuangan').select('id, nominal, kategori, related_trx_id').limit(5);
    if (keuErr) console.error(keuErr);
    else console.log('Sample Keuangan:', keu);
}

checkTables();
