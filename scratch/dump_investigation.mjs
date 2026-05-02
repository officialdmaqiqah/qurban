import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function dump() {
    console.log('--- Dumping last 100 from keuangan ---');
    const { data: fin, error: finErr } = await supabase.from('keuangan').select('*').order('created_at', { ascending: false }).limit(100);
    if (finErr) console.error(finErr);
    else console.log('Keuangan count:', fin.length);

    console.log('--- Dumping last 100 from transaksi ---');
    const { data: trx, error: trxErr } = await supabase.from('transaksi').select('*').order('created_at', { ascending: false }).limit(100);
    if (trxErr) console.error(trxErr);
    else console.log('Transaksi count:', trx.length);

    if (fin) {
        const matches = fin.filter(f => JSON.stringify(f).toLowerCase().includes('rozi') || JSON.stringify(f).toLowerCase().includes('trx00023'));
        console.log('\nKeuangan matches:', JSON.stringify(matches, null, 2));
    }

    if (trx) {
        const matches = trx.filter(t => JSON.stringify(t).toLowerCase().includes('rozi') || t.id === 'TRX00023');
        console.log('\nTransaksi matches:', JSON.stringify(matches, null, 2));
    }
}

dump();
