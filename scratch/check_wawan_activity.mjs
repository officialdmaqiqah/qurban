import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkWawanActivity() {
    console.log('Checking for any transaction linked to Wawan...');
    
    const { data: trxs, error } = await supabase
        .from('transaksi')
        .select('*');

    if (error) {
        console.error(error);
        return;
    }

    const matched = trxs.filter(t => {
        const agen = t.agen || {};
        return (agen.nama || '').toLowerCase().includes('wawan') || 
               (agen.wa || '').includes('6285267375005') ||
               (agen.id || '').includes('30348fa8') ||
               (agen.email || '').toLowerCase().includes('wse82');
    });

    if (matched.length === 0) {
        console.log('No transactions found linked to Wawan.');
    } else {
        console.log(`Found ${matched.length} transactions:`);
        matched.forEach(t => {
            console.log(`- TRX ID: ${t.id}, Customer: ${t.customer?.nama}, Tgl: ${t.tgl_trx}`);
        });
    }
}

checkWawanActivity();
