import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    console.log("--- SCANNING FOR ANY TRANSACTIONS ---");
    const { data: trxs, error } = await supabase.from('transaksi').select('id, agen').limit(5);
    if (error) console.error(error);
    else console.log("Recent Transactions:", trxs);

    console.log("--- SCANNING FOR ANY PROFILES ---");
    const { data: profs, error: e2 } = await supabase.from('profiles').select('id, full_name').limit(5);
    if (e2) console.error(e2);
    else console.log("Recent Profiles:", profs);
}

check();
