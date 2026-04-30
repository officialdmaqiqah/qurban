
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectChaos() {
    const targetIds = ['TRX00030', 'TRX00031', 'TRX00023', 'TRX00019'];
    console.log("Inspecting messy transactions...");

    const { data: transactions, error } = await supabase
        .from('transaksi')
        .select('*')
        .in('id', targetIds);

    if (error) {
        console.error("Error fetching transactions:", error);
        return;
    }

    transactions.forEach(t => {
        console.log(`\n--- ${t.id} ---`);
        console.log(`Customer: ${t.customer?.nama}`);
        console.log(`Total Deal: ${t.total_deal}`);
        console.log(`Total Paid: ${t.total_paid}`);
        console.log(`Total Overpaid: ${t.total_overpaid}`);
        console.log(`History Bayar Count: ${t.history_bayar?.length || 0}`);
        console.log(`History Bayar:`, JSON.stringify(t.history_bayar, null, 2));
    });

    // Also check keuangan for one of them
    console.log("\nChecking keuangan for TRX00030...");
    const { data: fin } = await supabase
        .from('keuangan')
        .select('*')
        .eq('related_trx_id', 'TRX00030');
    
    console.log("Keuangan records for TRX00030:", JSON.stringify(fin, null, 2));
}

inspectChaos();
