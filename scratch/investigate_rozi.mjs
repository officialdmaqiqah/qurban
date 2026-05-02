import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function investigate() {
    console.log('--- Investigating TRX00023 ---');

    // 1. Search in master_data for TRX00023
    console.log('\nSearching master_data for TRX00023:');
    const { data: trxData } = await supabase.from('master_data').select('*').ilike('key', '%TRX00023%');
    console.log(JSON.stringify(trxData, null, 2));

    // 2. Search in master_data for PAY-994691
    console.log('\nSearching master_data for PAY-994691:');
    const { data: payData } = await supabase.from('master_data').select('*').ilike('key', '%PAY-994691%');
    console.log(JSON.stringify(payData, null, 2));

    // 3. Search in master_data for Adjustments
    const adjs = ['ADJ-091230-24', 'ADJ-077913-12', 'ADJ-050988-03'];
    for (const adj of adjs) {
        console.log(`\nSearching master_data for ${adj}:`);
        const { data: adjData } = await supabase.from('master_data').select('*').ilike('key', `%${adj}%`);
        console.log(JSON.stringify(adjData, null, 2));
    }

    // 4. Search in keuangan for relevant entries
    console.log('\nSearching keuangan for "Rozi" or "TRX00023" or "PAY-994691":');
    const { data: finData } = await supabase.from('keuangan').select('*').or('deskripsi.ilike.%Rozi%,deskripsi.ilike.%TRX00023%,deskripsi.ilike.%PAY-994691%');
    console.log(JSON.stringify(finData, null, 2));

    // 5. Search for the payment amount in keuangan
    console.log('\nSearching keuangan for amount 1,500,000 on 2026-04-24:');
    const { data: amountData } = await supabase.from('keuangan').select('*').eq('tanggal', '2026-04-24').eq('nominal', 1500000);
    console.log(JSON.stringify(amountData, null, 2));
}

investigate();
