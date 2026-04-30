import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data: fins } = await supabase.from('keuangan').select('*').eq('id', 'REF-881671').single();
    console.log("KEUANGAN REF:", JSON.stringify(fins, null, 2));
}

check();
