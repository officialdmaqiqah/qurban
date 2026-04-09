import { createClient } from '@supabase/supabase-js';
const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMissing() {
    console.log('Testing column batch and supplier in keuangan...');
    const { error: errBatch } = await supabase.from('keuangan').insert([{ id: 'test-batch', batch: 'test' }]);
    console.log('Batch column error:', errBatch?.message || 'Success');

    const { error: errSupp } = await supabase.from('keuangan').insert([{ id: 'test-supp', supplier: 'test' }]);
    console.log('Supplier column error:', errSupp?.message || 'Success');
}

checkMissing();
