import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';

async function checkLargeIncome() {
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase
        .from('keuangan')
        .select('*')
        .eq('tipe', 'pemasukan')
        .gte('nominal', 5000000);

    if (error) {
        console.error("Error:", error);
        return;
    }

    console.log("=== Large Income Records ===");
    console.log(JSON.stringify(data, null, 2));
}

checkLargeIncome();
