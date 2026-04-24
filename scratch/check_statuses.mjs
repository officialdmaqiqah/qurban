import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkStatus() {
    const { data } = await supabase.from('stok_kambing').select('status_transaksi, status_fisik');
    const counts = {};
    data.forEach(d => {
        const key = `${d.status_transaksi} | ${d.status_fisik}`;
        counts[key] = (counts[key] || 0) + 1;
    });
    console.log('Status Counts:', counts);
}

checkStatus();
