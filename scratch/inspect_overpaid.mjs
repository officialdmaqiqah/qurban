import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
    const { data: trxs } = await supabase.from('transaksi').select('id, total_deal, total_paid, total_overpaid, customer');
    console.log(`Total Transactions: ${trxs.length}`);
    
    trxs.forEach(t => {
        const sisa = t.total_deal - t.total_paid;
        if (sisa < -1000 || t.total_overpaid > 1000) {
            console.log(`OVERPAID: ${t.id} | Deal: ${t.total_deal} | Paid: ${t.total_paid} | Over: ${t.total_overpaid} | Cust: ${t.customer?.nama}`);
        }
    });
}
inspect();
