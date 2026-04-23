
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMismatches() {
    console.log("Checking for deposit usage mismatches...");
    
    // 1. Get all Pemakaian Titipan Agen (OUT) records
    const { data: outRecords, error: err1 } = await supabase
        .from('keuangan')
        .select('*')
        .eq('kategori', 'Pemakaian Titipan Agen')
        .eq('tipe', 'pengeluaran');

    if (err1) {
        console.error("Error fetching OUT records:", err1);
        return;
    }

    console.log(`Found ${outRecords.length} 'Pemakaian Titipan Agen' records.`);

    let mismatchCount = 0;
    for (const outRec of outRecords) {
        if (!outRec.related_trx_id) continue;

        // 2. Find the corresponding IN record (Jual Kambing or Pelunasan Order)
        const { data: inRecords, error: err2 } = await supabase
            .from('keuangan')
            .select('*')
            .eq('related_trx_id', outRec.related_trx_id)
            .eq('tipe', 'pemasukan')
            .eq('nominal', outRec.nominal); 

        if (err2) {
            console.error(`Error fetching IN records for TRX ${outRec.related_trx_id}:`, err2);
            continue;
        }

        const match = inRecords?.find(inRec => inRec.channel !== outRec.channel);
        
        if (match) {
            mismatchCount++;
            console.log(`Mismatch found for Transaction ${outRec.related_trx_id}:`);
            console.log(`  OUT: ID=${outRec.id}, Channel=${outRec.channel}, Category=${outRec.kategori}`);
            console.log(`  IN:  ID=${match.id}, Channel=${match.channel}, Category=${match.kategori}`);
            console.log(`Suggested Fix: Update OUT channel to '${match.channel}'`);
            console.log('---');
        }
    }

    if (mismatchCount === 0) {
        console.log("No mismatches found.");
    } else {
        console.log(`Total ${mismatchCount} mismatches detected.`);
    }
}

checkMismatches();
