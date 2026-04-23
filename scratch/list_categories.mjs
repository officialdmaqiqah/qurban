
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function listCategories() {
    const { data, error } = await supabase.from('keuangan').select('kategori');
    if (error) {
        console.error(error);
        return;
    }
    const cats = [...new Set(data.map(d => d.kategori))];
    console.log("Unique Categories:", cats);
}

listCategories();
