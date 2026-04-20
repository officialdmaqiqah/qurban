
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ'; 
const supabase = createClient(supabaseUrl, supabaseKey);

async function investigate() {
    console.log('--- Investigating Aziz ---');

    // 1. Find the transaction by customer name
    const { data: trxs, error: trxErr } = await supabase
        .from('transaksi')
        .select('*')
        .ilike('customer->>nama', '%Aziz%');

    if (trxErr) {
        console.error('Error fetching transaksi:', trxErr.message);
        return;
    }

    if (trxs.length === 0) {
        console.log('No transaction found for consumer "Aziz"');
        return;
    }

    console.log('Found transactions:', trxs.length);
    for (const trx of trxs) {
        console.log(`\n--- Transaction: ${trx.id} ---`);
        console.log('Customer:', trx.customer.nama);
        console.log('Total Deal:', trx.total_deal);
        console.log('Total Paid:', trx.total_paid);
        console.log('Total Overpaid:', trx.total_overpaid);
        console.log('History Bayar:', JSON.stringify(trx.history_bayar, null, 2));

        // 2. Find related records in keuangan
        const { data: keu, error: keuErr } = await supabase
            .from('keuangan')
            .select('*')
            .eq('related_trx_id', trx.id);
        
        if (keuErr) {
            console.error('Error fetching keuangan:', keuErr.message);
        } else {
            console.log('Related Keuangan Records:', JSON.stringify(keu, null, 2));
        }
    }
}

investigate();
