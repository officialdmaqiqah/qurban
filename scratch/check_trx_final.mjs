
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';
const supabase = createClient(supabaseUrl, supabaseKey)

async function checkStatus() {
    const trxId = 'TRX00001';
    console.log(`Checking status for ${trxId}...`);
    
    const { data: trx, error } = await supabase.from('transaksi').select('*').eq('id', trxId).single();
    if (error) {
        console.error('Error:', error.message);
        // Try searching by customer name if ID fails
        return;
    }
    
    const sisa = trx.total_deal - trx.total_paid;
    console.log(`ID: ${trx.id} | Deal: ${trx.total_deal} | Paid: ${trx.total_paid} | Sisa: ${sisa}`);
    console.log(`History Bayar:`, JSON.stringify(trx.history_bayar, null, 2));
}

checkStatus();
