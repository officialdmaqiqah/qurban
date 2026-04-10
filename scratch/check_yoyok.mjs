import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    console.log("--- SEARCHING FOR PROFILE BY EMAIL ---");
    const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*')
        .or('email.ilike.%yoyok%,full_name.ilike.%yoyok%');
    
    if (error) {
        console.error("Error fetching profiles:", error);
    } else {
        console.log(`Found ${profiles.length} profiles`);
        console.log(JSON.stringify(profiles, null, 2));
    }
}

check();
