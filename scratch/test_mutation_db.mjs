
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';

const supabase = createClient(supabaseUrl, supabaseKey)

async function testMutation() {
    const tgl = new Date().toISOString().split('T')[0];
    const mutasiId = 'FIN-MUT-' + Date.now().toString().slice(-6); // Changed to FIN-
    
    const payloadMutasi = [
        {
            id: mutasiId + '-O', tipe: 'pengeluaran', tanggal: tgl,
            kategori: 'Mutasi Antar Rekening', nominal: 1000, keterangan: 'Test Mutation Out',
            channel: 'Tunai / Cash'
        },
        {
            id: mutasiId + '-I', tipe: 'pemasukan', tanggal: tgl,
            kategori: 'Mutasi Antar Rekening', nominal: 1000, keterangan: 'Test Mutation In',
            channel: 'Kas Operasional'
        }
    ];
    
    console.log('Inserting payload:', JSON.stringify(payloadMutasi, null, 2));
    const { data, error } = await supabase.from('keuangan').insert(payloadMutasi);
    
    if (error) {
        console.error('Error during insert:', error);
    } else {
        console.log('Success!', data);
    }
}

testMutation();
