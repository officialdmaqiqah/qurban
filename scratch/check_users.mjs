import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .or('full_name.ilike.%Wawan%,full_name.ilike.%Husni%,email.ilike.%Husni%,email.ilike.%wawan%');
    
    if (error) {
        console.error("Error:", error);
    } else {
        console.log("Users found:", JSON.stringify(data, null, 2));
    }
}

check();
