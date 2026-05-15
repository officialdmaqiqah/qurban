import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function searchBatch() {
    const { data: goats } = await supabase.from('stok_kambing').select('batch, no_tali, supplier').ilike('batch', '%010%');
    console.log(`Goats found: ${goats?.length || 0}`);
    goats?.forEach(g => console.log(` - Batch: ${g.batch}, No Tali: ${g.no_tali}, Supplier: ${g.supplier}`));
}

searchBatch();
