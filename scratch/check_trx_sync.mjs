
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTrx(ids) {
    console.log('--- CHECKING TRANSACTIONS ---');
    for (const id of ids) {
        console.log(`\nTransaction Search: ${id}`);
        const { data: trxs, error: tErr } = await supabase.from('transaksi').select('*').eq('id', id);
        if (tErr) {
            console.error(`Error fetching ${id}:`, tErr.message);
            continue;
        }
        
        console.log(`Found ${trxs.length} records.`);
        
        for (const trx of trxs) {
            console.log(`- Trx ID: ${trx.id} (DB Internal ID: ${trx.id_db || 'N/A'})`);
            console.log(`  Total Deal: ${trx.total_deal}`);
            console.log(`  Total Paid (Current): ${trx.total_paid}`);
            console.log(`  History Bayar (Length): ${trx.history_bayar?.length || 0}`);
            
            const { data: fins, error: fErr } = await supabase.from('keuangan').select('*').eq('related_trx_id', trx.id);
            if (fErr) {
                console.error(`  Error fetching finance for ${trx.id}:`, fErr.message);
            } else {
                console.log(`  Keuangan Records Linked to ${trx.id}: ${fins.length}`);
                let calcTotal = 0;
                fins.forEach(f => {
                    const nominal = parseFloat(f.nominal) || 0;
                    if (f.tipe === 'pemasukan') calcTotal += nominal;
                    else if (f.tipe === 'pengeluaran' && (f.kategori?.toLowerCase().includes('refund') || f.kategori?.toLowerCase().includes('pengembalian'))) calcTotal -= nominal;
                    console.log(`    * ${f.id}: ${f.tanggal} | ${f.tipe} | ${f.kategori} | ${f.nominal}`);
                });
                console.log(`  Calculated Total from Keuangan: ${calcTotal}`);
                if (calcTotal !== trx.total_paid) {
                    console.log(`  !!! DISCREPANCY DETECTED: Trx Total Paid (${trx.total_paid}) vs Keuangan (${calcTotal})`);
                }
            }
        }
    }
}

checkTrx(['TRX00031', 'TRX00030', 'TRX00023']);
