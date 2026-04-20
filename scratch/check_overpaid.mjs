
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkTrx() {
    console.log('Checking TRX00019...');
    const { data: trx, error } = await supabase.from('transaksi').select('*').eq('id', 'TRX00019').single();
    
    if (error) {
        console.error('Error fetching TRX00019:', error);
        return;
    }
    
    console.log('TRX00019 Current State:');
    console.log('Total Deal:', trx.total_deal);
    console.log('Total Paid:', trx.total_paid);
    console.log('Total Overpaid:', trx.total_overpaid);
    
    const { data: allTrx, error: allErr } = await supabase.from('transaksi').select('id, total_deal, total_paid, total_overpaid');
    if (allErr) {
        console.error('Error fetching all trx:', allErr);
    } else {
        const buggy = allTrx.filter(t => t.total_paid > t.total_deal);
        console.log('Total transactions with paid > deal:', buggy.length);
        buggy.forEach(b => {
            console.log(`- ${b.id}: Paid ${b.total_paid} vs Deal ${b.total_deal}`);
        });
    }
}

checkTrx();
