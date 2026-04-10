import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    console.log("--- ALL PROFILES ---");
    const { data: profiles, error: pError } = await supabase
        .from('profiles')
        .select('*');
    
    if (pError) console.error(pError);
    else console.log(JSON.stringify(profiles, null, 2));

    console.log("\n--- RECENT TRANSAKSI ---");
    const { data: trxs, error: tError } = await supabase
        .from('transaksi')
        .select('*')
        .order('id', { ascending: false })
        .limit(20);
    
    if (tError) console.error(tError);
    else {
        trxs.forEach(t => {
            console.log(`ID: ${t.id} | Agen: ${JSON.stringify(t.agen)} | Cust: ${t.customer?.nama}`);
        });
    }
}

check();
