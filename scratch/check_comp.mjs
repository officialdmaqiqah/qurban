
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';

const supabase = createClient(supabaseUrl, supabaseKey);



async function check() {
    const { data: finance, error } = await supabase.from('keuangan').select('*');
    if (error) {
        console.error('Error fetching finance:', error);
        return;
    }
    console.log('Total finance records:', finance.length);
    
    const categories = [...new Set(finance.map(f => f.kategori))];
    console.log('Unique categories:', categories);
    
    finance.forEach(f => {
        if (f.nominal > 0) {
            console.log(`- ${f.kategori}: ${f.nominal} (Supplier: ${f.supplier})`);
        }
    });

    const { data: goats } = await supabase.from('stok_kambing').select('*');
    console.log('Total goats records:', goats ? goats.length : 0);
    if (goats) {
        const totalTags = goats.reduce((acc, k) => acc + (parseFloat(k.harga_nota) || 0), 0);
        console.log('Total Harga Nota (Debt):', totalTags);
    }
}

check();
