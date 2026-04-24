import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function findSilfi() {
    const { data: trxs } = await supabase.from('transaksi').select('*');
    if (!trxs) return;

    const silfi = trxs.filter(t => JSON.stringify(t.customer).toLowerCase().includes('silfi'));
    console.log('Found Silfi Transactions:', silfi.length);
    silfi.forEach(t => {
        console.log(`ID: ${t.id}, Date: ${t.tgl_trx || t.tglTrx}, Customer: ${t.customer?.nama}, Total Deal: ${t.total_deal}`);
    });
}

findSilfi();
