import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function findAny03() {
    const { data: trxs, error } = await supabase.from('transaksi').select('*');
    if (error) {
        console.error(error);
        return;
    }

    console.log(`Total transactions checked: ${trxs.length}`);
    
    const results = [];
    trxs.forEach(t => {
        const items = t.items || [];
        items.forEach(it => {
            // Check various properties for "03"
            const noTali = String(it.noTali || it.no_tali || '').toLowerCase();
            const tag = String(it.tag || '').toLowerCase();
            if (noTali.includes('03') || noTali === '3' || tag.includes('03')) {
                results.push({
                    trxId: t.id,
                    customer: t.customer?.nama,
                    goat: it
                });
            }
        });
    });

    if (results.length === 0) {
        console.log('No transaction item found with tag "03".');
    } else {
        console.log(`Found ${results.length} matches:`);
        results.forEach(r => {
            console.log(`- TRX: ${r.trxId}, Cust: ${r.customer}, Goat: ${JSON.stringify(r.goat)}`);
        });
    }
}

findAny03();
