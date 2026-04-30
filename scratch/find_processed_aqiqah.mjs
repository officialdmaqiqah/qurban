import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function findAndFix() {
    console.log('Searching for recent Internal Transfer / Aqiqah records with Non-Kas...');
    const { data: fin, error } = await supabase
        .from('keuangan')
        .select('*')
        .eq('kategori', 'Internal Transfer / Aqiqah')
        .eq('channel', 'Non-Kas (Pencatatan)')
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) {
        console.error('Error fetching:', error);
        return;
    }

    if (!fin || fin.length === 0) {
        console.log('No records found to fix.');
        return;
    }

    console.log('Found records:');
    fin.forEach(f => {
        console.log(`ID: ${f.id}, Tgl: ${f.tanggal}, Nom: ${f.nominal}, Ket: ${f.keterangan}`);
    });
}

findAndFix();
