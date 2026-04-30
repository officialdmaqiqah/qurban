
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRefundAldi() {
    console.log("Fetching ALL records from 'keuangan' table...");
    
    const { data: transactions, error } = await supabase
        .from('keuangan')
        .select('*');

    if (error) {
        console.error("Error fetching keuangan:", error);
    } else {
        console.log("Total records found:", transactions?.length || 0);
        
        // Find 1jt transactions
        const refundTrx = transactions.filter(t => t.nominal == 1000000);
        console.log("\nRecords with nominal 1,000,000:");
        refundTrx.forEach(t => {
            console.log(JSON.stringify(t, null, 2));
        });

        // Find anything with "Aldi"
        const aldiTrx = transactions.filter(t => (t.keterangan || '').toLowerCase().includes('aldi'));
        console.log("\nRecords with 'Aldi' in description:");
        aldiTrx.forEach(t => {
            console.log(JSON.stringify(t, null, 2));
        });
    }
}

checkRefundAldi();
