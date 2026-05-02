import { createClient } from '@supabase/supabase-js';
const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function find() {
    const { data: trxs } = await supabase.from('transaksi').select('id, customer, total_deal, total_paid, items').ilike('customer->>nama', '%Aziz%');
    trxs.forEach(t => {
        console.log(`TRX: ${t.id} | Customer: ${t.customer.nama} | Total Deal: ${t.total_deal} | Paid: ${t.total_paid}`);
        console.log(`Items: ${JSON.stringify(t.items)}`);
    });
}

find();
