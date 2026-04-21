
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';

const supabase = createClient(supabaseUrl, supabaseKey)

async function findRecent() {
    console.log('Fetching last 10 transactions...');
    const { data: trxs, error } = await supabase.from('transaksi').select('*').order('tgl_trx', { ascending: false }).limit(20);
    
    if (error) {
        console.error('Error:', error);
        return;
    }
    
    trxs.forEach(t => {
        const sisa = (t.total_deal || 0) - (t.total_paid || 0);
        console.log(`ID: ${t.id} | Customer: ${t.customer?.nama} | Deal: ${t.total_deal} | Paid: ${t.total_paid} | Sisa: ${sisa} | HistoryItems: ${(t.history_bayar || []).length}`);
        if (t.total_deal === 7100000 || sisa === 3300000) {
            console.log('   >>> FOUND MATCH! History:', JSON.stringify(t.history_bayar, null, 2));
        }
    });
}

findRecent();
