import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data: all, error } = await supabase.from('stok_kambing').select('status_fisik, status_transaksi, count(*)', { count: 'exact' });
    console.log("All counts:", all);

    const { data: counts } = await supabase.from('stok_kambing').select('*');
    const groupings = counts.reduce((acc, curr) => {
        const key = `${curr.status_fisik} - ${curr.status_transaksi}`;
        acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, {});
    console.log("Groupings:", groupings);
}

check();
