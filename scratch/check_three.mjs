
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkThree() {
    const targets = [
        { id: 'TRX00031', name: 'Isfiansah' },
        { id: 'TRX00030', name: 'Riska' },
        { id: 'TRX00023', name: 'Rozi Aqiqah' }
    ];

    console.log('Fetching all finance records...');
    const { data: fins } = await supabase.from('keuangan').select('*').range(0, 5000);
    
    if (!fins || fins.length === 0) {
        console.log('No finance records found (maybe RLS).');
        return;
    }

    targets.forEach(t => {
        console.log(`\n--- ${t.id} (${t.name}) ---`);
        const byId = fins.filter(f => (f.keterangan || '').toUpperCase().includes(t.id.toUpperCase()));
        const byName = fins.filter(f => (f.keterangan || '').toUpperCase().includes(t.name.toUpperCase()));
        
        console.log(`  Matches by ID: ${byId.length}`);
        byId.forEach(f => console.log(`    - ${f.id} | ${f.nominal} | ${f.keterangan}`));
        
        console.log(`  Matches by Name: ${byName.length}`);
        byName.forEach(f => console.log(`    - ${f.id} | ${f.nominal} | ${f.keterangan}`));
    });
}

checkThree();
