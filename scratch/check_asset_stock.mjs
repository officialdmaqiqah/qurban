import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAssetStock() {
    console.log('Fetching stock data...');
    const { data: goats, error } = await supabase.from('stok_kambing').select('harga_nota, status_transaksi, no_tali');
    if (error) {
        console.error(error);
        return;
    }

    const availableGoats = goats.filter(g => g.status_transaksi === 'Tersedia');
    let totalAsset = 0;
    
    console.log(`--- Detail Kambing Tersedia (${availableGoats.length} Ekor) ---`);
    availableGoats.forEach(g => {
        const modal = parseFloat(g.harga_nota) || 0;
        totalAsset += modal;
        // console.log(`No Tali: ${g.no_tali}, Modal: ${modal}`);
    });

    console.log('-----------------------------------');
    console.log(`Total Nilai Aset Stok: Rp ${totalAsset.toLocaleString('id-ID')}`);
}

checkAssetStock();
