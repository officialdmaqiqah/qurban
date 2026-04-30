import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data, error } = await supabase.from('master_data').select('val').eq('key', 'AGENS').single();
    if (error) {
        console.error(error);
        return;
    }
    const agents = data.val || [];
    const wawan = agents.find(a => a.nama.toLowerCase().includes('wawan') || a.id.toLowerCase().includes('wse82'));
    const husni = agents.find(a => a.nama.toLowerCase().includes('husni') || a.id.toLowerCase().includes('husnidm'));
    
    console.log("Wawan:", wawan);
    console.log("Husni:", husni);
}

check();
