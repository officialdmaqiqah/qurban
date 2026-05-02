import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkId() {
    console.log('--- Checking for Wawan ID ---');
    const { data, error } = await supabase.from('profiles').select('*').eq('id', '30348fa8-b8f3-4503-a2f7-b87191633738');
    if (error) console.error(error);
    else console.log('Wawan data:', JSON.stringify(data, null, 2));
}

checkId();
