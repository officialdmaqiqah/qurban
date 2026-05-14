
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectTrxs(ids) {
    for (const id of ids) {
        console.log(`\n--- Inspecting ${id} ---`);
        const { data: trx } = await supabase.from('transaksi').select('*').eq('id', id).single();
        if (!trx) {
            console.log(`Transaction ${id} not found.`);
            continue;
        }

        console.log(`Customer: ${trx.customer?.nama}`);
        console.log(`Total Deal: ${trx.total_deal}`);
        console.log(`Total Paid (in DB): ${trx.total_paid}`);
        console.log(`Total Overpaid (in DB): ${trx.total_overpaid}`);
        
        console.log("\nFinance Records (keuangan):");
        const { data: fins } = await supabase.from('keuangan').select('*').eq('related_trx_id', id);
        if (!fins || fins.length === 0) {
            console.log("No finance records found linked to this TRX ID.");
        } else {
            fins.forEach(f => {
                console.log(`- ID: ${f.id} | Tgl: ${f.tanggal} | Tipe: ${f.tipe} | Kat: ${f.kategori} | Nom: ${f.nominal} | Ket: ${f.keterangan}`);
            });
        }
    }
}

inspectTrxs(['TRX00080', 'TRX00072']);
