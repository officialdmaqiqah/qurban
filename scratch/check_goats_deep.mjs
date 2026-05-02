import { createClient } from '@supabase/supabase-js';
const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    console.log("Checking goats for TRX00046...");
    const { data: goats } = await supabase.from('stok_kambing').select('*').eq('transaction_id', 'TRX00046');
    console.log(goats);

    console.log("\nChecking goats with no_tali 11...");
    const { data: goats11 } = await supabase.from('stok_kambing').select('*').eq('no_tali', '11');
    console.log(goats11);

    console.log("\nChecking goats with no_tali 02...");
    const { data: goats02 } = await supabase.from('stok_kambing').select('*').eq('no_tali', '02');
    console.log(goats02);
}

check();
