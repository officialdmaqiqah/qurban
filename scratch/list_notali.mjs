import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function listNoTali() {
    const { data } = await supabase.from('stok_kambing').select('no_tali');
    console.log('No Tali List:', data.map(k => k.no_tali).sort());
}

listNoTali();
