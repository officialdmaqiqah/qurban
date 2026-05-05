import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';

async function checkSpecificFin() {
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase
        .from('keuangan')
        .select('*')
        .eq('id', 'FIN-885715')
        .single();

    if (error) {
        console.error("Error:", error);
        return;
    }

    console.log("=== Transaction FIN-885715 ===");
    console.log(JSON.stringify(data, null, 2));
}

checkSpecificFin();
