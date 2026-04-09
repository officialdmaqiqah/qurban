import { createClient } from '@supabase/supabase-js';
const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkLoss() {
    console.log('Checking for any LOSS records in keuangan...');
    const { data, error } = await supabase
        .from('keuangan')
        .select('*')
        .ilike('id', 'LOSS-%');
    
    if (error) console.error('Error:', error);
    else console.log('Found records:', data?.length, data);

    console.log('Checking categories in keuangan...');
    const { data: cats } = await supabase.from('keuangan').select('kategori');
    const uniqueCats = [...new Set(cats?.map(c => c.kategori))];
    console.log('Unique categories seen in DB:', uniqueCats);
}

checkLoss();
