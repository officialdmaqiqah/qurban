import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTrx() {
    // Try to get transactions for Rozi
    const { data: keu } = await supabase.from('keuangan').select('related_trx_id, keterangan').ilike('keterangan', '%Rozi%');
    console.log("Keuangan records for Rozi:", keu);
}

checkTrx();
