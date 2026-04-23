import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function find6650() {
    const { data: fin } = await supabase.from('keuangan').select('*').or('nominal.eq.6650,nominal.eq.6650000'); // Check both
    
    if (fin) {
        fin.forEach(f => {
            console.log(`Found: ID ${f.id} | Channel: ${f.channel} | Kat: ${f.kategori} | Nom: ${f.nominal} | Date: ${f.tanggal}`);
        });
    }

    // Also check for 6.65 (if nominal is in thousands or something?)
    const { data: fin2 } = await supabase.from('keuangan').select('*').eq('nominal', 6.65);
    if (fin2) fin2.forEach(f => console.log(`Found small: ${f.id} | ${f.nominal}`));
}

find6650();
