import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function findRoziTrx() {
    const { data: goats } = await supabase.from('stok_kambing').select('*').in('no_tali', ['12', '03', '24']);
    const ids = goats.map(g => g.id);
    const { data: trxs } = await supabase.from('transaksi').select('*');
    
    const matchingTrxs = trxs.filter(t => (t.items || []).some(it => ids.includes(it.goatId)));
    
    console.log('Matching Transactions:', matchingTrxs.map(t => ({ id: t.id, cust: t.customer?.nama, agen: t.agen?.nama, total: t.total_deal })));
    console.log('Goats found:', goats.map(g => ({ id: g.id, no: g.no_tali, warna: g.warna_tali })));
}

findRoziTrx();
