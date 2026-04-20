
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';

const supabase = createClient(supabaseUrl, supabaseKey)

async function listRecentTrx() {
    console.log('Fetching recent transactions...');
    const { data: trxs, error } = await supabase.from('transaksi').select('id, tgl_trx, total_deal, total_paid, agen').order('created_at', { ascending: false }).limit(10);
    
    if (error) {
        console.error('Error:', error);
        return;
    }
    
    trxs.forEach(t => {
        console.log(`${t.id} | ${t.tgl_trx} | Deal: ${t.total_deal} | Paid: ${t.total_paid} | Agen: ${JSON.stringify(t.agen)}`);
    });
}

listRecentTrx();
