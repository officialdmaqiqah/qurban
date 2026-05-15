import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function listRecentFins() {
    console.log('--- 20 CATATAN KEUANGAN TERBARU ---');
    const { data: fins, error } = await supabase
        .from('keuangan')
        .select('id, tanggal, keterangan, nominal')
        .order('tanggal', { ascending: false })
        .limit(20);
    
    if (error) console.error(error);
    else console.table(fins);
}

listRecentFins();
