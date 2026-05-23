import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTRX() {
    const { data: trx, error: err1 } = await supabase
        .from('transaksi')
        .select('*')
        .limit(1);
        
    console.log("TRX Columns:");
    console.log(err1 ? err1 : Object.keys(trx[0] || {}));
    console.log("TRX Sample:");
    console.log(trx[0]);
}

checkTRX();
