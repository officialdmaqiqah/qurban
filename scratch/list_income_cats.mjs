import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function listCategories() {
    const { data: fin, error } = await supabase.from('keuangan').select('kategori, tipe, nominal, tanggal').eq('tipe', 'pemasukan');
    if (error) {
        console.error(error);
        return;
    }

    const cats = {};
    fin.forEach(f => {
        cats[f.kategori] = (cats[f.kategori] || 0) + (parseFloat(f.nominal) || 0);
    });

    console.log('--- Kategori Pemasukan (Global) ---');
    console.log(JSON.stringify(cats, null, 2));
}

listCategories();
