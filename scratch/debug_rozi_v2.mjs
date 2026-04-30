import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugRozi() {
    console.log('Searching for 1,500,000 in transactions...');
    const { data: trxs } = await supabase.from('transaksi').select('*');
    const trxMatches = trxs.filter(t => JSON.stringify(t).toLowerCase().includes('rozi') || t.total_deal === 1500000);
    console.log('Trx matches:', trxMatches.map(t => ({ id: t.id, total: t.total_deal, cust: t.customer?.nama, note: t.keterangan })));

    console.log('Searching for 1,500,000 in keuangan...');
    const { data: fin } = await supabase.from('keuangan').select('*');
    const finMatches = fin.filter(f => JSON.stringify(f).toLowerCase().includes('rozi') || Math.abs(f.nominal) === 1500000);
    console.log('Finance matches:', finMatches.map(f => ({ id: f.id, nominal: f.nominal, deskripsi: f.deskripsi, kategori: f.kategori })));
}

debugRozi();
