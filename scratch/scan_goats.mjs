import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function scanGoats() {
    const { data } = await supabase.from('stok_kambing').select('id, status_fisik, status_transaksi');
    const matches = data.filter(k => 
        (k.status_fisik || '').toLowerCase().includes('sembelih') || 
        (k.status_transaksi || '').toLowerCase().includes('sembelih')
    );
    console.log('Matches:', matches);
}

scanGoats();
