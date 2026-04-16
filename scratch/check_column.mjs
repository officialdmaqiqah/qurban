import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkColumn() {
    console.log('Checking columns for table: keuangan...');
    
    // Attempting to select the column specifically to see if it fails
    const { data, error } = await supabase
        .from('keuangan')
        .select('agen_name')
        .limit(1);

    if (error) {
        console.error('Error selecting agen_name:', error.message);
        if (error.message.includes('column "agen_name" does not exist')) {
            console.log('CONFIRMED: Column "agen_name" is missing in table "keuangan".');
        } else {
            console.log('Other error detected:', error);
        }
    } else {
        console.log('SUCCESS: Column "agen_name" exists in table "keuangan".');
    }
}

checkColumn();
