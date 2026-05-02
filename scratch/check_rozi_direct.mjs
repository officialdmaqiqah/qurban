import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTrx() {
    console.log('--- Checking TRX00023 in "transaksi" table ---');
    const { data, error } = await supabase.from('transaksi').select('*').eq('id', 'TRX00023');
    if (error) {
        console.error('Error:', error);
    } else {
        console.log('TRX00023 Data:', JSON.stringify(data, null, 2));
    }

    console.log('\n--- Searching for "Rozi" in "transaksi" table ---');
    const { data: roziData, error: roziErr } = await supabase.from('transaksi').select('*').ilike('customer->>nama', '%Rozi%');
    if (roziErr) {
        // Try simple search if JSON path fails
        const { data: allTrx } = await supabase.from('transaksi').select('*').limit(100);
        const filtered = allTrx?.filter(t => JSON.stringify(t).toLowerCase().includes('rozi'));
        console.log('Rozi matches (JS filter):', JSON.stringify(filtered, null, 2));
    } else {
        console.log('Rozi Data:', JSON.stringify(roziData, null, 2));
    }

    console.log('\n--- Checking "keuangan" table for PAY-994691 ---');
    const { data: fin, error: finErr } = await supabase.from('keuangan').select('*').ilike('deskripsi', '%PAY-994691%');
    if (finErr) {
        console.error('Error Keuangan:', finErr);
    } else {
        console.log('PAY-994691 Keuangan:', JSON.stringify(fin, null, 2));
    }
}

checkTrx();
