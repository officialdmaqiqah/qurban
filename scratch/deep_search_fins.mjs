
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function deepSearch(ids) {
    console.log('--- DEEP SEARCHING FINANCE RECORDS ---');
    const { data: allFins, error } = await supabase.from('keuangan').select('*').range(0, 5000);
    if (error) {
        console.error('Error fetching keuangan:', error);
        return;
    }

    ids.forEach(id => {
        console.log(`\nSearching for ${id}...`);
        const linked = allFins.filter(f => f.related_trx_id === id);
        const mentioned = allFins.filter(f => (f.keterangan || '').toUpperCase().includes(id.toUpperCase()) && f.related_trx_id !== id);
        
        console.log(`  Directly Linked: ${linked.length}`);
        linked.forEach(f => console.log(`    - [LINKED] ${f.id}: ${f.tanggal} | ${f.nominal} | ${f.keterangan}`));
        
        console.log(`  Mentioned in Keterangan (Unlinked): ${mentioned.length}`);
        mentioned.forEach(f => console.log(`    - [MENTION] ${f.id}: ${f.tanggal} | ${f.nominal} | ${f.keterangan}`));
    });
}

deepSearch(['TRX00031', 'TRX00030', 'TRX00023']);
