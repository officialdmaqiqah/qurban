import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkImpact() {
    console.log('Checking impact of renaming Bedun to Daarul Mahabbah Aqiqah...');
    
    // Check goats
    const { data: goats } = await supabase.from('stok_kambing').select('id, no_tali, batch, supplier').eq('supplier', 'Bedun');
    console.log(`\nGoats with supplier 'Bedun': ${goats?.length || 0}`);
    goats?.forEach(g => console.log(` - ${g.batch} (${g.no_tali})`));

    // Check finance records
    const { data: payments } = await supabase.from('keuangan').select('id, tanggal, nominal, keterangan, supplier, batch').eq('supplier', 'Bedun');
    console.log(`\nFinance records with supplier 'Bedun': ${payments?.length || 0}`);
    payments?.forEach(p => console.log(` - ${p.tanggal}: ${p.nominal} (${p.keterangan}) [Batch: ${p.batch}]`));

    if ((payments?.length || 0) > 0) {
        console.log('\nWARNING: If you rename the supplier on the goats but not on these finance records, the "Hutang Supplier" calculation will be incorrect.');
    }
}

checkImpact();
