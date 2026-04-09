import { createClient } from '@supabase/supabase-js';
const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check14m() {
    console.log('Searching for 14,000,000 in keuangan...');
    const { data: fin, error: finError } = await supabase
        .from('keuangan')
        .select('*')
        .eq('nominal', 14000000);
    
    if (finError) console.error('Error fin:', finError);
    else console.log('Found in keuangan:', fin);

    console.log('Searching for any transaction with 14,000,000 in nominal column...');
    const { data: allFin, error: allError } = await supabase
        .from('keuangan')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
    
    console.log('Recent 20 transactions:', allFin?.map(f => `${f.id} | ${f.nominal} | ${f.kategori} | ${f.supplier} | ${f.keterangan}`));

    const { data: suppliers } = await supabase.from('master_data').select('*').eq('key', 'SUPPLIERS').single();
    console.log('Available Suppliers:', suppliers?.val?.map(s => s.nama));
}

check14m();
