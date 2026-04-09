import { createClient } from '@supabase/supabase-js';
const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkColumns() {
    console.log('Checking columns of keuangan...');
    // We can use a query that returns 0 rows but shows columns in data if we are lucky, 
    // or just look at one record.
    const { data, error } = await supabase.from('keuangan').select('*').limit(1);
    
    if (error) {
        console.error('Error:', error);
    } else if (data && data.length > 0) {
        console.log('Columns:', Object.keys(data[0]));
    } else {
        console.log('No data found to check columns. Attempting to insert dummy to see error...');
        const { error: insError } = await supabase.from('keuangan').insert([{ id: 'test-'+Date.now(), related_goat_id: 'test' }]);
        console.log('Insert error with related_goat_id:', insError?.message || 'Success (Column exists)');
    }
}

checkColumns();
