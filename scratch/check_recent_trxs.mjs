import { createClient } from '@supabase/supabase-js';
const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data: trxs } = await supabase.from('transaksi').select('id, customer, created_at').order('created_at', { ascending: false }).limit(10);
    console.log("Recent transactions:");
    console.log(trxs);

    const { data: trxsAgen } = await supabase.from('transaksi_agen').select('id, customer, created_at').order('created_at', { ascending: false }).limit(10);
    console.log("\nRecent agent transactions:");
    console.log(trxsAgen);
}

check();
