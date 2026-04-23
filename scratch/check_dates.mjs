import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTrxDates() {
    const { data: trxs } = await supabase.from('transaksi').select('id, tgl_trx, tglTrx').limit(5);
    console.log('Sample Transaksi Dates:', trxs);
}

checkTrxDates();
