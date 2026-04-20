
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkSold() {
    console.log('Checking stok_kambing for sold items...');
    const { data: sold, error } = await supabase.from('stok_kambing').select('id, no_tali, status_transaksi, transaction_id').eq('status_transaksi', 'Terjual');
    
    if (error) {
        console.error('Error:', error);
        return;
    }
    
    console.log('Sold items found:', sold.length);
    sold.forEach(s => {
        console.log(`Goat ID: ${s.id} | No Tali: ${s.no_tali} | Trx ID: ${s.transaction_id}`);
    });
}

checkSold();
