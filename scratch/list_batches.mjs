import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function listBatches() {
    const { data: goats } = await supabase.from('stok_kambing').select('batch');
    const batches = [...new Set(goats?.map(g => g.batch))];
    console.log(`Unique Batches: ${batches.join(', ')}`);
}

listBatches();
