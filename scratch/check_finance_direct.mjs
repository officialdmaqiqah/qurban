
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkFinance(trxIds) {
    console.log("Checking finance records for:", trxIds);
    const { data, error } = await supabase
        .from('keuangan')
        .select('*')
        .in('related_trx_id', trxIds);
    
    if (error) {
        console.error("Error:", error);
    } else {
        console.log("Records found:", data.length);
        data.forEach(r => {
            console.log(`[${r.related_trx_id}] ${r.tipe} | ${r.kategori} | ${r.nominal} | ${r.keterangan}`);
        });
    }
}

checkFinance(['TRX00080', 'TRX00072']);
