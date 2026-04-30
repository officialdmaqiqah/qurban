
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';
const supabase = createClient(supabaseUrl, supabaseKey)

async function checkStatus() {
    const trxId = 'TRX00001';
    console.log(`Checking status for ${trxId}...`);
    
    const { data: agensData, error } = await supabase.from('master_data').select('val').eq('key', 'AGENS').single();
    if (error) {
        console.error('Error:', error.message);
        return;
    }
    
    const agens = agensData.val;
    const fitri = agens.find(a => a.nama.toLowerCase().includes('fitri'));
    console.log(`Fitri found in DB:`, JSON.stringify(fitri, null, 2));
}

checkStatus();
