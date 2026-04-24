import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function searchRozi() {
    const { data: trxs } = await supabase.from('transaksi').select('*');
    const filtered = trxs.filter(t => 
        (t.customer?.nama || '').toLowerCase().includes('rozi') ||
        (t.agen?.nama || '').toLowerCase().includes('rozi')
    );
    console.log('Transactions with Rozi:', filtered.map(t => ({ id: t.id, cust: t.customer?.nama, agen: t.agen?.nama, total: t.total_deal, items: t.items })));
}

searchRozi();
