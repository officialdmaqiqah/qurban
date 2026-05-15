import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect3() {
    const ids = ['TRX00084', 'TRX00083', 'TRX00045'];
    console.log("🔍 INVESTIGASI 3 TRANSAKSI TERAKHIR...");

    const { data: trxs } = await supabase.from('transaksi').select('*').in('id', ids);
    const { data: allFins } = await supabase.from('keuangan').select('*');

    for (const trx of (trxs || [])) {
        console.log(`\n--- [${trx.id}] ${trx.customer?.nama} (Deal: ${trx.total_deal}) ---`);
        const tId = trx.id.toUpperCase();
        const rawName = (trx.customer?.nama || '').toLowerCase().trim();
        const honorifics = ['haji', 'hj', 'pak', 'bpk', 'ibu', 'ny', 'tn', 'kak', 'bang', 'mas', 'mbak', 'bin', 'binti'];
        const nameParts = rawName.split(' ').filter(p => p.length >= 4 && !honorifics.includes(p));

        const matched = (allFins || []).filter(f => {
            const fId = (f.related_trx_id || '').toUpperCase();
            const fDesc = (f.keterangan || '').toLowerCase();
            const fCat = (f.kategori || '').toLowerCase();
            
            if (fId === tId) return true;
            if (fId && fId !== tId) return false;
            if (fDesc.includes(tId.toLowerCase())) return true;

            if (!fId) {
                if (rawName.length > 5 && (fDesc.includes(rawName) || fCat.includes(rawName))) return true;
                if (nameParts.length > 0) return nameParts.some(p => fDesc.includes(p));
            }
            return false;
        });

        console.log(`Matched Records (${matched.length}):`);
        let sum = 0;
        matched.forEach(f => {
            const nom = f.tipe === 'pengeluaran' ? -Math.abs(f.nominal) : Math.abs(f.nominal);
            console.log(`  - [${f.tanggal}] ${f.kategori}: ${f.nominal} (${f.keterangan}) | ID: ${f.id}`);
            sum += nom;
        });
        console.log(`CALCULATED TOTAL PAID: ${sum}`);
    }
}
inspect3();
