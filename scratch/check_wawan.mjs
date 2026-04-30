import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data: profiles } = await supabase.from('profiles').select('*').ilike('nama', '%wawan%');
    console.log("PROFILES:", JSON.stringify(profiles, null, 2));
}

check();
