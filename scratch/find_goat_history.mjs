import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function findGoatHistory() {
    const goatId = 'KB07BEME03J';
    console.log(`Searching for transaction history of goat: ${goatId}`);
    
    const { data: trxs, error } = await supabase
        .from('transaksi')
        .select('*');

    if (error) {
        console.error(error);
        return;
    }

    const matched = trxs.filter(t => {
        const items = t.items || [];
        return items.some(it => it.goatId === goatId);
    });

    if (matched.length === 0) {
        console.log('No transaction history found for this goat.');
    } else {
        console.log(`Found ${matched.length} transactions:`);
        matched.forEach(t => {
            console.log(`- TRX ID: ${t.id}, Customer: ${t.customer?.nama}, Tgl: ${t.tgl_trx}`);
        });
    }
}

findGoatHistory();
