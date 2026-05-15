
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function searchByCustomer(names) {
    console.log('--- SEARCHING BY CUSTOMER NAMES IN FINANCE ---');
    const { data: allFins, error } = await supabase.from('keuangan').select('*').range(0, 5000);
    if (error) {
        console.error('Error:', error);
        return;
    }

    names.forEach(name => {
        console.log(`\nSearching for "${name}"...`);
        const matched = allFins.filter(f => {
            const desc = (f.keterangan || '').toLowerCase();
            return desc.includes(name.toLowerCase());
        });
        
        console.log(`  Found: ${matched.length}`);
        matched.forEach(f => console.log(`    - ${f.id}: ${f.tanggal} | ${f.nominal} | ${f.keterangan} | Related TRX: ${f.related_trx_id || 'NONE'}`));
    });
}

searchByCustomer(['Isfiansah', 'Riska', 'Rozi Aqiqah']);
