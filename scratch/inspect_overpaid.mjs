
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectOverpaid() {
    console.log("--- Transactions with Overpaid > 0 ---");
    const { data: trxs } = await supabase.from('transaksi')
        .select('id, customer, total_deal, total_paid, total_overpaid, history_bayar')
        .gt('total_overpaid', 0)
        .limit(10);
    
    if (!trxs || trxs.length === 0) {
        console.log("No overpaid transactions found (via gt). Checking total_paid > total_deal...");
        const { data: trxs2 } = await supabase.from('transaksi').select('*');
        const over = trxs2.filter(t => t.total_paid > t.total_deal);
        console.log(`Found ${over.length} overpaid transactions via filter.`);
        over.slice(0, 5).forEach(t => {
            console.log(`\nID: ${t.id} | Deal: ${t.total_deal} | Paid: ${t.total_paid} | Over: ${t.total_overpaid}`);
            console.log("History in DB:", JSON.stringify(t.history_bayar, null, 2));
        });
        return;
    }

    trxs.forEach(t => {
        console.log(`\nID: ${t.id} | Consumer: ${t.customer?.nama} | Deal: ${t.total_deal} | Paid: ${t.total_paid} | Over: ${t.total_overpaid}`);
        console.log("History in DB:", JSON.stringify(t.history_bayar, null, 2));
    });
}

inspectOverpaid();
