import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function findGoat03() {
    const { data } = await supabase.from('stok_kambing').select('*').eq('no_tali', '03');
    console.log('Goats with No Tali 03:', data);
}

findGoat03();
