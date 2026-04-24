import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDelivered() {
    const { data: goats } = await supabase.from('stok_kambing').select('id, no_tali, status_transaksi, status_fisik').eq('status_transaksi', 'Terdistribusi');
    console.log('Goats Terdistribusi:', goats);
}

checkDelivered();
