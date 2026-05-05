import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';

async function checkInvestment() {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Search for 'Modal' or 'Investor' in keuangan
    const { data: modalRecords, error } = await supabase
        .from('keuangan')
        .select('*')
        .or('kategori.ilike.%modal%,keterangan.ilike.%investor%,keterangan.ilike.%modal%');

    if (error) {
        console.error("Error fetching data:", error);
        return;
    }

    console.log("=== Investment/Modal Records ===");
    console.log(JSON.stringify(modalRecords, null, 2));

    // Calculate total modal
    const totalModal = modalRecords?.reduce((sum, r) => sum + (r.tipe === 'pemasukan' ? r.nominal : -r.nominal), 0) || 0;
    console.log(`\nTotal Current Modal: Rp ${totalModal.toLocaleString('id-ID')}`);
}

checkInvestment();
