import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectNew() {
    const ids = ['TRX00031', 'TRX00019'];
    console.log("🔍 INVESTIGASI ISFIANSAH & ZAINAL...");

    const { data: trxs } = await supabase.from('transaksi').select('*').in('id', ids);
    const { data: allFins } = await supabase.from('keuangan').select('*');

    for (const trx of (trxs || [])) {
        console.log(`\n--- [${trx.id}] ${trx.customer?.nama} ---`);
        const rawName = (trx.customer?.nama || '').toLowerCase().trim();
        
        const matched = (allFins || []).filter(f => {
            const fDesc = (f.keterangan || '').toLowerCase();
            const fCat = (f.kategori || '').toLowerCase();
            const fId = (f.related_trx_id || '').toUpperCase();
            if (fId === trx.id) return true;
            if (!fId && (fDesc.includes(rawName) || fCat.includes(rawName))) return true;
            return false;
        });

        matched.forEach(f => {
            console.log(`  - [${f.tanggal}] ${f.kategori}: ${f.nominal} | Ket: ${f.keterangan}`);
        });
    }
}
inspectNew();
