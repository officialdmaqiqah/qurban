
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';
const supabase = createClient(supabaseUrl, supabaseKey)

async function checkSoldGoats() {
    const { data, error } = await supabase.from('stok_kambing')
        .select('id, no_tali, transaction_id, status_transaksi')
        .neq('status_transaksi', 'Tersedia')
        .limit(10);
    
    if (error) return console.error(error);
    console.log('Sold Goats:', data.map(g => `${g.no_tali}: ${g.transaction_id || 'NULL'}`));
}

checkSoldGoats();
