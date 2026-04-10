import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    console.log("--- INSPECTING COLUMN TYPES ---");
    // I will try to fetch one row and check the type of 'agen'
    const { data, error } = await supabase.from('transaksi').select('agen').limit(1);
    
    if (error) console.error(error);
    else {
        if (data.length > 0) {
            console.log("Type of 'agen':", typeof data[0].agen);
            console.log("Content:", data[0].agen);
        } else {
            console.log("No data found to inspect.");
        }
    }
}

check();
