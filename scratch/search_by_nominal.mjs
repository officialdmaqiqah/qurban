
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function searchByNominal(values) {
    console.log('--- SEARCHING BY NOMINAL VALUES IN FINANCE ---');
    const { data: allFins, error } = await supabase.from('keuangan').select('*').range(0, 5000);
    if (error) {
        console.error('Error:', error);
        return;
    }

    values.forEach(val => {
        console.log(`\nSearching for nominal ${val}...`);
        const matched = allFins.filter(f => Math.abs(parseFloat(f.nominal)) === val);
        
        console.log(`  Found: ${matched.length}`);
        matched.forEach(f => console.log(`    - ${f.id}: ${f.tanggal} | ${f.nominal} | ${f.kategori} | ${f.keterangan} | Related: ${f.related_trx_id || 'NONE'}`));
    });
}

searchByNominal([1000000, 750000, 1500000]);
