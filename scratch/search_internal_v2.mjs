import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function search() {
    console.log('Searching for any category containing "internal" in keuangan...');
    const { data: fin } = await supabase.from('keuangan').select('*');
    const matches = fin.filter(f => (f.kategori || '').toLowerCase().includes('internal'));
    console.log('Matches:', matches.map(f => ({ id: f.id, nominal: f.nominal, ket: f.keterangan, kat: f.kategori, channel: f.channel })));
}

search();
