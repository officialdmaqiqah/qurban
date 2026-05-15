import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkBT010() {
    const { data: goats } = await supabase.from('stok_kambing').select('*').eq('batch', 'BT010');
    console.log(`Goats in Batch BT010: ${goats?.length || 0}`);
    goats?.forEach(g => console.log(` - No Tali: ${g.no_tali}, Supplier: ${g.supplier}`));
}

checkBT010();
