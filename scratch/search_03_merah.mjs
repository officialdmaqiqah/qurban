import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function searchByStrings() {
    console.log('Searching for any transaction containing "03" and "Merah" in items...');
    
    const { data: trxs, error } = await supabase
        .from('transaksi')
        .select('*');

    if (error) {
        console.error(error);
        return;
    }

    const matched = trxs.filter(t => {
        const itemsStr = JSON.stringify(t.items || '').toLowerCase();
        return itemsStr.includes('03') && itemsStr.includes('merah');
    });

    if (matched.length === 0) {
        console.log('No matches found.');
    } else {
        console.log(`Found ${matched.length} potential matches:`);
        matched.forEach(t => {
            console.log(`- TRX ID: ${t.id}, Customer: ${t.customer?.nama}, Items: ${JSON.stringify(t.items)}`);
        });
    }
}

searchByStrings();
