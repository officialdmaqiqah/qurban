import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';

async function checkMasterData() {
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase
        .from('master_data')
        .select('*');

    if (error) {
        console.error("Error:", error);
        return;
    }

    console.log("=== Master Data Keys ===");
    data.forEach(d => console.log(d.key));
    
    const modal = data.find(d => d.key.includes('MODAL') || d.key.includes('INVEST'));
    if (modal) {
        console.log("\n=== Modal Found ===");
        console.log(JSON.stringify(modal, null, 2));
    } else {
        console.log("\nNo modal key found in master_data.");
    }
}

checkMasterData();
