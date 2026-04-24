import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTrx() {
    const { data: trxs } = await supabase.from('transaksi').select('*');
    if (!trxs) {
        console.log('No transactions found or error.');
        return;
    }

    console.log('Total Transactions:', trxs.length);
    
    const years = {};
    let withAddedCost = 0;
    let withAdminFee = 0;
    let totalAddedCost = 0;
    let totalAdminFee = 0;

    trxs.forEach(t => {
        const dt = new Date(t.tgl_trx || t.tglTrx);
        const year = dt.getFullYear();
        years[year] = (years[year] || 0) + 1;

        if (t.added_cost) {
            withAddedCost++;
            totalAddedCost += parseFloat(t.added_cost);
            console.log(`TRX ${t.id} has added_cost: ${t.added_cost}`);
        }
        if (t.admin_fee) {
            withAdminFee++;
            totalAdminFee += parseFloat(t.admin_fee);
            console.log(`TRX ${t.id} has admin_fee: ${t.admin_fee}`);
        }
    });

    console.log('Year Distribution:', years);
    console.log('Transactions with added_cost:', withAddedCost, 'Total:', totalAddedCost);
    console.log('Transactions with admin_fee:', withAdminFee, 'Total:', totalAdminFee);
}

checkTrx();
