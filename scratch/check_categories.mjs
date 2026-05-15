import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkKategori() {
    const { data } = await supabase.from('keuangan').select('kategori, tipe');
    const stats = {};
    (data || []).forEach(f => {
        const key = `${f.tipe}: ${f.kategori}`;
        stats[key] = (stats[key] || 0) + 1;
    });
    console.log("KATEGORI KEUANGAN DI DATABASE:");
    console.log(JSON.stringify(stats, null, 2));
}
checkKategori();
