import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function findStuckGoats() {
    const { data } = await supabase.from('stok_kambing').select('*').eq('status_transaksi', 'Terdistribusi');
    console.log('Stuck Goats (Terdistribusi):', data.map(k => ({ id: k.id, no_tali: k.no_tali, status_fisik: k.status_fisik })));
}

findStuckGoats();
