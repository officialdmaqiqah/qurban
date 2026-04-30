import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function search() {
    console.log('Searching for "Internal Transfer / Aqiqah" in keuangan...');
    const { data: fin } = await supabase.from('keuangan').select('*').eq('kategori', 'Internal Transfer / Aqiqah');
    console.log('Matches:', fin.map(f => ({ id: f.id, nominal: f.nominal, ket: f.keterangan, date: f.tanggal, channel: f.channel })));
    
    const total = fin.reduce((acc, f) => acc + (f.nominal || 0), 0);
    console.log('Total internal transfer:', total);
}

search();
