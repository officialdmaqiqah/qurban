import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkBalances() {
    console.log('Fetching data...');
    const [
        { data: keuangan },
        { data: reNew }
    ] = await Promise.all([
        supabase.from('keuangan').select('*'),
        supabase.from('master_data').select('val').eq('key', 'REKENING').single()
    ]);

    const channels = {};
    (keuangan || []).forEach(item => {
        const ch = item.channel || 'Tunai';
        if (!channels[ch]) channels[ch] = 0;
        if (item.tipe === 'pemasukan') channels[ch] += (parseFloat(item.nominal) || 0);
        else channels[ch] -= (parseFloat(item.nominal) || 0);
    });

    console.log('--- Channel Balances From DB ---');
    let totalAll = 0;
    Object.keys(channels).forEach(ch => {
        console.log(`${ch}: ${channels[ch]}`);
        totalAll += channels[ch];
    });
    console.log(`Grand Total (All Channels): ${totalAll}`);

    console.log('\n--- Configured Rekening in Master Data ---');
    const rekenings = reNew?.val || [];
    console.log(JSON.stringify(rekenings, null, 2));

    let totalDashboard = channels['Tunai'] || 0;
    console.log(`\nBase (Tunai/Cash): ${totalDashboard}`);
    rekenings.forEach(acc => {
        const key = `${acc.bank} - ${acc.norek}`;
        const val = channels[key] || 0;
        console.log(`Adding ${key}: ${val}`);
        totalDashboard += val;
    });

    console.log(`Final Dashboard Total: ${totalDashboard}`);
    
    if (channels['Kas operasional'] !== undefined) {
        console.log(`\nFound 'Kas operasional': ${channels['Kas operasional']}`);
        console.log(`Is it in Rekening list? ${rekenings.some(r => `${r.bank} - ${r.norek}` === 'Kas operasional')}`);
    }
}

checkBalances();
