import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
// Using the public key found in the project or I'll just use a mock if I can't find it.
// Actually, I should use the one from the project.
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function repairTRX(trxId) {
    console.log(`Checking data for ${trxId}...`);
    
    // 1. Get all financial records for this TRX
    const { data: fins, error: finError } = await supabase
        .from('keuangan')
        .select('*')
        .eq('related_trx_id', trxId);

    if (finError) {
        console.error('Error fetching keuangan:', finError);
        return;
    }

    console.log(`Found ${fins.length} transactions in keuangan.`);

    const total = fins.reduce((sum, f) => sum + parseFloat(f.nominal || 0), 0);
    const history = fins.map(f => ({
        payId: f.id,
        tgl: f.tanggal,
        nominal: parseFloat(f.nominal),
        channel: f.channel,
        buktiUrl: f.bukti_url
    }));

    console.log(`Recalculated total: ${total}`);

    // 2. Update the transaksi table
    const { error: updateError } = await supabase
        .from('transaksi')
        .update({
            total_paid: total,
            history_bayar: history
        })
        .eq('id', trxId);

    if (updateError) {
        console.error('Error updating transaksi:', updateError);
    } else {
        console.log(`Successfully repaired ${trxId}!`);
    }
}

repairTRX('TRX00001');
