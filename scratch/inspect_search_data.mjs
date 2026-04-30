import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSearch() {
    const { data, error } = await supabase.from('stok_kambing').select('no_tali, warna_tali, batch, supplier, lokasi').limit(20);
    if (error) {
        console.error(error);
        return;
    }
    console.table(data);
}

checkSearch();
