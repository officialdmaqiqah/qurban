import { createClient } from '@supabase/supabase-js';

// KONFIGURASI: Masukkan 'service_role' key Anda di sini untuk bisa mereset password user lain secara administratif.
// JANGAN berikan key ini kepada siapapun selain Admin.
const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const serviceRoleKey = 'MASUKKAN_SERVICE_ROLE_KEY_DI_SINI'; 

if (serviceRoleKey === 'MASUKKAN_SERVICE_ROLE_KEY_DI_SINI') {
    console.error('❌ ERROR: Anda belum memasukkan serviceRoleKey.');
    console.log('Silakan ambil "service_role" key dari Dashboard Supabase -> Project Settings -> API.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function resetBanaPassword() {
  const userId = 'f68373bb-9cc7-49ec-838e-a6640ea00dec'; // ID Arsanul Bana
  const newPassword = 'BanaBaru123';

  console.log(`Mereset password untuk Arsanul Bana (ID: ${userId})...`);

  const { data, error } = await supabase.auth.admin.updateUserById(
    userId,
    { password: newPassword }
  );

  if (error) {
    console.error('❌ GAGAL:', error.message);
  } else {
    console.log('✅ BERHASIL! Password Bana telah diubah menjadi:', newPassword);
    console.log('Bana sekarang bisa login menggunakan username "Bana123" dan password tersebut.');
  }
}

resetBanaPassword();
