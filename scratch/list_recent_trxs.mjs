import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function listRecent() {
    const { data: trxs } = await supabase.from('transaksi').select('*').order('created_at', { ascending: false }).limit(10);
    console.log('Recent Transactions:');
    trxs.forEach(t => {
        console.log(`ID: ${t.id}, Customer: ${t.customer?.nama}, Total: ${t.total_deal}, Items: ${t.items?.length}`);
    });
}

listRecent();
