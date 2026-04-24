import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCategories() {
    const { data: catOut } = await supabase.from('master_data').select('val').eq('key', 'KAT_KEU_OUT').single();
    console.log('Current KAT_KEU_OUT:', catOut?.val);
    
    // Add "Internal Transfer / Aqiqah" if not present
    if (catOut?.val && !catOut.val.includes('Internal Transfer / Aqiqah')) {
        const newVal = [...catOut.val, 'Internal Transfer / Aqiqah'];
        // await supabase.from('master_data').update({ val: newVal }).eq('key', 'KAT_KEU_OUT');
        console.log('Would update to:', newVal);
    }
}

checkCategories();
