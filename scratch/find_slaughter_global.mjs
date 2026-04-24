import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function findSembelih() {
    const { data, error } = await supabase.from('master_data').select('*');
    if (error) {
        console.error(error);
        return;
    }
    console.log('Total Rows:', data.length);
    data.forEach(row => {
        const str = JSON.stringify(row.val);
        if (str && str.includes('SMB-')) {
            console.log('Found SMB- in key:', row.key);
        }
        if (str && str.includes('Sembelih')) {
            console.log('Found Sembelih in key:', row.key);
        }
    });
}

findSembelih();
