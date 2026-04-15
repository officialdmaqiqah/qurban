const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkProfiles() {
    const { data } = await supabase.from('profiles').select('*').limit(5);
    console.log('Profiles:', JSON.stringify(data, null, 2));
}

checkProfiles();
