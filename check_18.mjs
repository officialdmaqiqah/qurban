import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';

async function checkKeterangan() {
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase
        .from('keuangan')
        .select('*')
        .ilike('keterangan', '%18%');

    if (error) {
        console.error("Error:", error);
        return;
    }

    console.log("=== Records with '18' in Keterangan ===");
    console.log(JSON.stringify(data, null, 2));
}

checkKeterangan();
