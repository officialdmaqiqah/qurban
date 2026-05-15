
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function findGoat24() {
    const { data: goats, error } = await supabase.from('stok_kambing').select('*').ilike('no_tali', '%24%');
    if (error) {
        console.error(error);
        return;
    }
    console.log(`Found ${goats.length} goats matching %24%.`);
    goats.forEach(g => {
        console.log(`ID: ${g.id}, No: ${g.no_tali}, Batch: ${g.batch}, Kesehatan: ${g.status_kesehatan}, Fisik: ${g.status_fisik}, Trx: ${g.status_transaksi}`);
    });
}

findGoat24();
