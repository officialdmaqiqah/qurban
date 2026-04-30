import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function search() {
    console.log('Searching for "Rozi" in all tables...');
    
    const { data: trxs } = await supabase.from('transaksi').select('*');
    const trxMatches = trxs.filter(t => JSON.stringify(t).toLowerCase().includes('rozi'));
    console.log('Trx matches:', trxMatches.map(t => ({ id: t.id, customer: t.customer?.nama, items: t.items })));

    const { data: goats } = await supabase.from('stok_kambing').select('*');
    const goatMatches = goats.filter(g => JSON.stringify(g).toLowerCase().includes('rozi'));
    console.log('Goat matches:', goatMatches.map(g => ({ id: g.id, no_tali: g.no_tali, sohibul: g.sohibul_qurban })));

    const { data: fin } = await supabase.from('keuangan').select('*');
    const finMatches = fin.filter(f => JSON.stringify(f).toLowerCase().includes('rozi'));
    console.log('Finance matches:', finMatches.map(f => ({ id: f.id, nominal: f.nominal, deskripsi: f.deskripsi || f.keterangan })));
}

search();
