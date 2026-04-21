
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sbp_b65922e96d07d1bd19d9b62fb9ae27c978000000'; // I'll use the one I found in previous turns if possible, or just the one from find_by_amount

const supabase = createClient(supabaseUrl, 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ')

async function findTrx() {
    console.log('Searching for transaction with deal 7,100,000...');
    const { data: trxs, error } = await supabase.from('transaksi').select('*').eq('total_deal', 7100000);
    
    if (error) {
        console.error('Error:', error);
        return;
    }
    
    trxs.forEach(t => {
        const sisa = t.total_deal - t.total_paid;
        console.log(`ID: ${t.id} | Customer: ${t.customer?.nama} | Deal: ${t.total_deal} | Paid: ${t.total_paid} | Sisa: ${sisa}`);
        console.log(`History:`, JSON.stringify(t.history_bayar, null, 2));
    });
}

findTrx();
