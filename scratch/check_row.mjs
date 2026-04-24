import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRow() {
    const { data } = await supabase.from('stok_kambing').select('*').limit(1).single();
    console.log('Row Sample:', data);
}

checkRow();
