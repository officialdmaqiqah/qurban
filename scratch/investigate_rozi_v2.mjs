import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function investigate() {
    console.log('--- Investigating TRX00023 ---');

    // 1. Search in transaksi table
    console.log('\nSearching transaksi for id = TRX00023:');
    const { data: trx, error: trxErr } = await supabase.from('transaksi').select('*').eq('id', 'TRX00023');
    if (trxErr) console.error('Trx Error:', trxErr);
    else console.log(JSON.stringify(trx, null, 2));

    // 2. Search in keuangan table for PAY-994691
    console.log('\nSearching keuangan for id = PAY-994691:');
    const { data: pay, error: payErr } = await supabase.from('keuangan').select('*').eq('id', 'PAY-994691');
    if (payErr) console.error('Pay Error:', payErr);
    else console.log(JSON.stringify(pay, null, 2));

    // 3. Search in keuangan table for Adjustments
    const adjs = ['ADJ-091230-24', 'ADJ-077913-12', 'ADJ-050988-03'];
    console.log('\nSearching keuangan for adjustments:');
    const { data: adjData, error: adjErr } = await supabase.from('keuangan').select('*').in('id', adjs);
    if (adjErr) console.error('Adj Error:', adjErr);
    else console.log(JSON.stringify(adjData, null, 2));

    // 4. Search in keuangan table for any record linked to TRX00023
    console.log('\nSearching keuangan linked to TRX00023:');
    const { data: linkedFins, error: linkedErr } = await supabase.from('keuangan').select('*').eq('related_trx_id', 'TRX00023');
    if (linkedErr) console.error('Linked Err:', linkedErr);
    else console.log(JSON.stringify(linkedFins, null, 2));

    // 5. Search for "Rozi" in transaksi (using ilike on customer->>nama)
    console.log('\nSearching transaksi for "Rozi":');
    const { data: roziTrx, error: roziErr } = await supabase.from('transaksi').select('*').ilike('customer->>nama', '%Rozi%');
    if (roziErr) {
        // Fallback to searching all and filtering in JS
        const { data: all } = await supabase.from('transaksi').select('*');
        const filtered = all?.filter(t => JSON.stringify(t).toLowerCase().includes('rozi'));
        console.log('Rozi matches (JS filter):', JSON.stringify(filtered, null, 2));
    } else {
        console.log(JSON.stringify(roziTrx, null, 2));
    }
}

investigate();
