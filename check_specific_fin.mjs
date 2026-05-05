import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';

async function checkSpecificIds() {
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase
        .from('keuangan')
        .select('*')
        .in('id', ['FIN-030334', 'FIN-104754']);

    if (error) {
        console.error("Error:", error);
        return;
    }

    console.log("=== Specific Keuangan Records ===");
    console.log(JSON.stringify(data, null, 2));
}

checkSpecificIds();
