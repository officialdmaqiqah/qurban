
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkAllGoats() {
    const { data: goats } = await supabase.from('stok_kambing').select('status_transaksi').limit(1000);
    const stats = {};
    goats?.forEach(g => {
        stats[g.status_transaksi] = (stats[g.status_transaksi] || 0) + 1;
    });
    console.log('Goat Status Stats:', stats);
}

checkAllGoats();
