import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testUpsert() {
    const { data, error } = await supabase.from('master_data').upsert({ 
        id: 'trip-record-master', 
        key: 'TRIPS_TEST', 
        val: [] 
    }, { onConflict: 'key' });
    
    console.log("Upsert Error:", error);
}

testUpsert();
