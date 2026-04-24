import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSlaughtered() {
    const { data } = await supabase.from('stok_kambing').select('id, status_fisik');
    const slaughtered = data.filter(d => (d.status_fisik || '').toLowerCase().includes('sembelih'));
    console.log('Slaughtered found:', slaughtered);
}

checkSlaughtered();
