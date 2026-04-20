
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';

const supabase = createClient(supabaseUrl, supabaseKey)

async function findByAmount() {
    console.log('Searching for transactions with nominal 9,750,000 or 8,750,000...');
    const { data: fins, error } = await supabase.from('keuangan').select('*').or('nominal.eq.9750000,nominal.eq.8750000');
    
    if (error) {
        console.error('Error:', error);
        return;
    }
    
    if (fins.length === 0) {
        console.log('No financial records found with those amounts.');
    } else {
        fins.forEach(f => {
            console.log(`ID: ${f.id} | Date: ${f.tanggal} | Nominal: ${f.nominal} | TrxID: ${f.related_trx_id} | Agen: ${f.agen_name}`);
        });
    }
}

findByAmount();
