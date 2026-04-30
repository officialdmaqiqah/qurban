import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkGoats() {
    const { data: goats } = await supabase.from('stok_kambing').select('no_tali, status_transaksi, status_fisik').in('no_tali', ['32', '03', '12', '24']);
    console.log("Goats:", goats);
}

checkGoats();
