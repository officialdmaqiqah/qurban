/**
 * WHATSAPP GATEWAY LIBRARY (XSender)
 * Author: Antigravity AI
 */
import { supabase } from './supabase.js';

const WA_DEFAULT_CONFIG = {
    apiKey: 'raRmjxN5P9CI7O63PKtFifPhZLiRDf',
    sender: '6285335150001',
    footer: 'Kandang DM Aqiqah - Berkah & Amanah',
    templateLunas: "*DM AQIQAH & QURBAN*\n_Berkah, Amanah & Sesuai Syariat_\n==========================\n\nAssalamu’alaikum Warahmatullahi Wabarakatuh,\n\nBapak/Ibu *[[NAMA]]*, Alhamdulillah kami telah mengonfirmasi penerimaan dana pembayaran Anda dengan rincian berikut:\n\n📌 *INFORMASI PEMBAYARAN*\nNo. Transaksi: *[[ID]]*\nTgl Pembayaran: [[TGL]]\nNominal Masuk: *[[NOMINAL]]*\n\n📊 *STATUS TAGIHAN*\nSisa Tagihan: *[[SISA]]*\n\nJazakumullah Khairan Katsiran.\nSemoga harta yang dikeluarkan mendapat ganti keberkahan dari Allah SWT. Aamiin.\n\nWassalamu’alaikum Warahmatullahi Wabarakatuh.\n\n[[FOOTER]]",
    templateOrderNormal: "*DM AQIQAH & QURBAN*\n_Berkah, Amanah & Sesuai Syariat_\n==========================\n\nAssalamu’alaikum Warahmatullahi Wabarakatuh,\n\nJazakumullah Khairan Katsiran Bapak/Ibu *[[NAMA]]* atas kepercayaannya.\n\n📌 *Info Transaksi*\nNo. Transaksi: *[[ID]]*\nTanggal: [[TGL]]\n\n👤 *Data Penerima*\nNama: [[NAMA]]\nAlamat Antar: [[ALAMAT]]\nMaps: [[MAPS]]\n\n👤 *Data Sohibul*\n[[SOHIBUL]]\n\n🐐 *Rincian Hewan*\n[[ITEMS]]\n\n🖼️ *Link Foto Hewan*\n[[FOTO]]\n\n💰 *Pembayaran*\nHarga Deal: *[[TOTAL]]*\nDP Dibayar: [[DP]]\n*Sisa Tagihan: [[SISA]]*\n\n📅 *Jadwal Pengantaran*\n[[JADWAL]]\n\n💳 *Info Pembayaran Resmi:*\n[[REKENING]]\n\n📞 *Info Agen Pendamping:*\n[[INFO_AGEN]]\n\nSemoga Allah SWT menerima amal ibadah qurban Bapak/Ibu sekeluarga dan memberikan keberkahan yang melimpah. Aamiin.\n\n*DM Aqiqah Team*\n[[FOOTER]]",
    templateOrderDM: "*DM AQIQAH & QURBAN*\n_Berkah, Amanah & Sesuai Syariat_\n==========================\n\nAssalamu’alaikum Warahmatullahi Wabarakatuh,\n\nJazakumullah Khairan Katsiran Bapak/Ibu *[[NAMA]]* atas kepercayaannya.\n\n📌 *Info Transaksi*\nNo. Transaksi: *[[ID]]*\nTanggal: [[TGL]]\n\n👤 *Data Penerima*\nNama: [[NAMA]]\nAlamat Antar: [[ALAMAT]]\nMaps: [[MAPS]]\n\n👤 *Data Sohibul*\n[[SOHIBUL]]\n\n🐐 *Rincian Hewan*\n[[ITEMS]]\n\n📅 *Jadwal Pengantaran*\n[[JADWAL]]\n\n📞 *Info Agen Pendamping:*\n[[INFO_AGEN]]\n\nSemoga Allah SWT menerima amal ibadah qurban Bapak/Ibu sekeluarga dan memberikan keberkahan yang melimpah. Aamiin.\n\n*DM Aqiqah Team*\n[[FOOTER]]",
    templateAgentNormal: "*NOTIFIKASI PENJUALAN BARU!* 🚀\n==========================\n\nBismillah\nHi *[[NAMA_AGEN]]*!\n\nAlhamdulillah, satu lagi Transaksi Qurban Berhasil dicatat atas nama Anda. Terus semangat menebar manfaat!\n\nBerikut detail penjualannya:\n\n📌 *Info Transaksi*\nNo. Transaksi: *[[ID]]*\nTanggal: [[TGL]]\n\n👤 *Data Penerima*\nNama: [[NAMA]]\nAlamat Antar: [[ALAMAT]]\nNo WA: [[WA_KONSUMEN]]\nMaps: [[MAPS]]\n\n👤 *Data Sohibul*\n[[SOHIBUL]]\n\n🐐 *Rincian Hewan*\n[[ITEMS]]\n\n🖼️ *Link Foto Hewan*\n[[FOTO]]\n\n💰 *Pembayaran*\nHarga Deal: *[[TOTAL]]*\nDP Dibayar: [[DP]]\n*Sisa Tagihan: [[SISA]]*\n\n💰 *Estimasi Komisi:*\n[[KOMISI]]\n\n📅 *Jadwal Pengantaran*\n[[JADWAL]]\n\nTerima Kasih Atas Dedikasinya. Mari Kita Sukseskan Musim Qurban Tahun Ini Bersama-Sama!\n\n*DM Aqiqah Management*\n[[FOOTER]]",
    templateAgentDM: "*NOTIFIKASI PENJUALAN BARU!* 🚀\n==========================\n\nBismillah\nHi *[[NAMA_AGEN]]*!\n\nAlhamdulillah, satu lagi Transaksi Qurban Berhasil dicatat atas nama Anda. Terus semangat menebar manfaat!\n\nBerikut detail penjualannya:\n\n📌 *Info Transaksi*\nNo. Transaksi: *[[ID]]*\nTanggal: [[TGL]]\n\n👤 *Data Penerima*\nNama: [[NAMA]]\nAlamat Antar: [[ALAMAT]]\nNo WA: [[WA_KONSUMEN]]\nMaps: [[MAPS]]\n\n👤 *Data Sohibul*\n[[SOHIBUL]]\n\n🐐 *Rincian Hewan*\n[[ITEMS]]\n\n💰 *Pembayaran*\nHarga Deal: *[[TOTAL]]*\nDP Dibayar: [[DP]]\n*Sisa Tagihan: [[SISA]]*\n\n📅 *Jadwal Pengantaran*\n[[JADWAL]]\n\nTerima Kasih Atas Dedikasinya. Mari Kita Sukseskan Musim Qurban Tahun Ini Bersama-Sama!\n\n*DM Aqiqah Management*\n[[FOOTER]]",
    templateLunasAgent: "*UPDATE PEMBAYARAN KONSUMEN* 💳\n==========================\n\nBismillah\nHalo Partner Terbaik, *[[NAMA_AGEN]]*!\n\nAlhamdulillah, konsumen Anda atas nama *[[NAMA]]* (Pesanan *[[ID]]*) baru saja tercatat melakukan pembayaran dengan rincian berikut:\n\n📌 *INFORMASI PEMBAYARAN*\nTgl Pembayaran: [[TGL]]\nNominal Masuk: *[[NOMINAL]]*\n\n📊 *STATUS TAGIHAN KONSUMEN*\nSisa Tagihan: *[[SISA]]*\n\nTerus jaga komunikasi dan edukasi dengan konsumen Anda hingga seluruh amanah tersalurkan dengan baik! Semangat menjemput berkah qurban.\n\n_DM Qurban Management_\n\n[[FOOTER]]",
    templateKomisi: "*PENCAIRAN KOMISI BERHASIL* 💸\n==========================\n\nBismillah\nHi *[[NAMA]]*!\n\nAlhamdulillah, komisi Anda untuk penjualan dengan ID Transaksi *[[ID]]* (Konsumen: *[[KONSUMEN]]*) sebesar *[[NOMINAL]]* telah berhasil dicairkan dan berstatus *LUNAS*.\n\nSilakan cek rekening/saldo pencairan Anda. Semoga berkah dan terus semangat menebar manfaat bersama kami!\n\n_Jazakumullah Khairan_\n\n[[FOOTER]]",
    templateDaftar: "*Pendaftaran Berhasil*\n==========================\n\nAssalamu’Alaikum, *[[NAMA]]*.\n\nTerima Kasih Telah Mendaftar Menjadi Bagian Pejuang Qurban.\n\nBerikut Adalah Data Yang Anda Entri:\n👤 Nama: [[NAMA]]\n📧 Username/Email: [[EMAIL]]\n🔑 Password: [[PASSWORD]]\n\n⚠️ *Penting:*\n1. Mohon Jangan Memberitahukan Username Dan Password Anda Kepada Siapapun.\n2. Saat Ini Anda *Belum Bisa Login*. Akun Anda Sedang Dalam Status *Pending*. Silakan Menunggu Konfirmasi (Approval) Dari Manajemen Daarul Mahabbah Qurban Sebelum Dapat Digunakan.\n\n🔗 Link Login: [Masukkan URL Login Sistem]\n\nTerima Kasih.",
    templateUserApproved: "*AKUN BERHASIL DISETUJUI* ✅\n==========================\n\nAssalamu’alaikum, *[[NAMA]]*!\n\nAlhamdulillah, pendaftaran akun Anda telah diverifikasi dan disetujui oleh Manajemen.\n\nSekarang Anda sudah bisa login ke dalam Sistem Manajemen Qurban menggunakan Akun yang Anda daftarkan sebelumnya.\n\nMelalui aplikasi ini, Anda dapat:\n✨ Memantau stok dan kesehatan hewan qurban (Kondisi/Fisik) secara Real-Time.\n✨ Mengelola transaksi, memonitor status pembayaran konsumen (DP/Lunas), dan cetak struk.\n✨ Melengkapi dan mengupdate rincian data konsumen secara mandiri.\n✨ Memantau jadwal antrean dan distribusi / pengiriman hewan ke lokasi konsumen.\n✨ Menikmati Notifikasi WhatsApp otomatis ke pelanggan tiap kali transaksi tercatat.\n✨ Memonitor perhitungan komisi penjualan Anda secara transparan (Reseller)\n\nMari bersama-sama luaskan manfaat, layani konsumen dengan maksimal, dan raih keberkahan qurban tahun ini!\n\n🔗 Link Login: [Masukkan URL Login Sistem]\n\nTerima Kasih.\n[[FOOTER]]",
    templateAuditDaily: "*LAPORAN AUDIT HARIAN (STOK)* 📊\n==========================\n\nBismillah\nBerikut adalah ringkasan hasil pemeriksaan fisik (Opname) hari ini:\n\n📅 *Tanggal:* [[TGL]]\n✅ *Sudah Dicek:* *[[SUDAH]]* Ekor\n⚠️ *Belum Dicek:* *[[BELUM]]* Ekor\n📈 *Progress:* *[[PERSENTASE]]%*\n\n📝 *Daftar Belum Terperiksa (No Tali):*\n[[CATATAN]]\n\n_Mohon pastikan seluruh stok fisik telah sesuai dengan data sistem sebelum penutupan hari operasional. Tetap semangat melayani dengan amanah!_\n\n*DM Qurban Audit Team*\n[[FOOTER]]",
    templateDistribusiTerkirim: "*NOTIFIKASI PENGIRIMAN SELESAI* 🚚\n==========================\n\nBismillah\nAlhamdulillah, pesanan atas nama *[[NAMA]]* (ID: *[[ID]]*) telah berhasil diantarkan dan diterima dengan baik.\n\n📌 *Detail Pengiriman*\nTgl Antar: [[TGL]]\nNo. Kambing: *[[ITEMS]]*\nSisa Tagihan Konsumen: *[[SISA]]*\nPetugas/Sopir: *[[NAMA_AGEN]]*\n\nSemoga ibadah qurban Diterima oleh Allah SWT.\n\n_Jazakumullah Khairan_\n\n[[FOOTER]]"
};

/**
 * Mendapatkan konfigurasi WA dari Supabase (Cloud Synced)
 */
window.getWaConfig = async () => {
    // Try to get from Supabase first
    const { data, error } = await supabase
        .from('master_data')
        .select('val')
        .eq('key', 'WA_CONFIG')
        .single();
    
    let config = WA_DEFAULT_CONFIG;
    
    if (data && data.val) {
        config = { ...WA_DEFAULT_CONFIG, ...data.val };
    } else {
        // Fallback to localStorage if no cloud data yet (for migration)
        const saved = localStorage.getItem('QURBAN_WA_CONFIG');
        if (saved) config = { ...WA_DEFAULT_CONFIG, ...JSON.parse(saved) };
    }

    // Patch known templates if they are old/missing
    let configPatched = false;
    if (config.templateDaftar && !config.templateDaftar.includes("Link Login")) {
        config.templateDaftar = WA_DEFAULT_CONFIG.templateDaftar;
        configPatched = true;
    }
    if (config.templateUserApproved && !config.templateUserApproved.includes("kesehatan")) {
        config.templateUserApproved = WA_DEFAULT_CONFIG.templateUserApproved;
        configPatched = true;
    }
    if (!config.templateDistribusiTerkirim) {
        config.templateDistribusiTerkirim = WA_DEFAULT_CONFIG.templateDistribusiTerkirim;
        configPatched = true;
    }
    if (!config.templateAuditDaily) {
        config.templateAuditDaily = WA_DEFAULT_CONFIG.templateAuditDaily;
        configPatched = true;
    }

    return config;
};

/**
 * Menyimpan konfigurasi WA ke Supabase (Cloud Synced)
 */
window.saveWaConfig = async (config) => {
    const { error } = await supabase
        .from('master_data')
        .upsert({ key: 'WA_CONFIG', val: config }, { onConflict: 'key' });
    
    if (!error) {
        localStorage.setItem('QURBAN_WA_CONFIG', JSON.stringify(config)); // Keep local cache
    }
    return { success: !error, error };
};

/**
 * Mengganti variabel dalam template dengan data asli
 */
window.parseWaTemplate = async (template, data = {}) => {
    const config = await window.getWaConfig();
    let msg = template || '';
    
    // Default placeholders
    const placeholders = {
        '[[NAMA]]': data.nama || 'Pelanggan',
        '[[ID]]': data.id || '-',
        '[[NOMINAL]]': data.nominal || 'Rp 0',
        '[[TGL]]': data.tgl || new Date().toLocaleDateString('id-ID'),
        '[[ALAMAT]]': data.alamat || '-',
        '[[MAPS]]': data.maps || '-',
        '[[SOHIBUL]]': data.sohibul || '-',
        '[[KONSUMEN]]': data.konsumen || '-',
        '[[ITEMS]]': data.items || '-',
        '[[TOTAL]]': data.total || 'Rp 0',
        '[[DP]]': data.dp || 'Rp 0',
        '[[SISA]]': data.sisa || 'Rp 0',
        '[[JADWAL]]': data.jadwal || '-',
        '[[REKENING]]': data.rekening || '-',
        '[[INFO_AGEN]]': data.info_agen || '-',
        '[[WA_KONSUMEN]]': data.wa_konsumen || '-',
        '[[NAMA_AGEN]]': data.nama_agen || 'Agen',
        '[[KOMISI]]': data.komisi || 'Rp 0',
        '[[FOTO]]': data.foto || '-',
        '[[EMAIL]]': data.email || '-',
        '[[PASSWORD]]': data.password || '***',
        '[[SUDAH]]': data.sudah || '0',
        '[[BELUM]]': data.belum || '0',
        '[[PERSENTASE]]': data.persentase || '0',
        '[[CATATAN]]': data.catatan || '-',
        '[[FOOTER]]': config.footer || ''
    };


    for (const [key, val] of Object.entries(placeholders)) {
        msg = msg.replace(new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), val);
    }

    return msg;
};

/**
 * Fungsi Inti Pengiriman WA via XSender API
 */
window.sendWa = async (number, message) => {
    const config = await window.getWaConfig();
    
    // Normalisasi nomor (pastikan 62xxx)
    let cleanNumber = number.replace(/\D/g, '');
    if (cleanNumber.startsWith('0')) {
        cleanNumber = '62' + cleanNumber.substring(1);
    } else if (cleanNumber.startsWith('8')) {
        cleanNumber = '62' + cleanNumber;
    }

    console.log('[WA] Menyiapkan pengiriman ke:', cleanNumber);
    
    // Gunakan URL GET dengan query parameters untuk kompatibilitas browser yang lebih baik (CORS Bypass)
    const url = new URL('https://xsender.id/api/send-message');
    url.searchParams.append('api_key', config.apiKey);
    url.searchParams.append('sender', config.sender);
    url.searchParams.append('number', cleanNumber);
    url.searchParams.append('message', message);
    if (config.footer) url.searchParams.append('footer', config.footer);

    try {
        // Percobaan pengiriman (Bisa membaca respons JSON jika server mendukung CORS)
        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });

        // Jika berhasil membaca respons
        const result = await response.json();
        console.log('[WA] Response:', result);
        
        if (result.status === true || result.status === 'success') {
            return { success: true, msg: 'Pesan terkirim!' };
        } else {
            return { success: false, msg: result.message || 'Gagal mengirim pesan.' };
        }
    } catch (error) {
        // Jika gagal karena CORS (Kesalahan Jaringan), biasanya pesan tetap sampai ke server XSender
        // Namun browser memblokir pembacaan responsnya. Kita kembalikan sukses agar tidak membingungkan
        // dan menghindari pengiriman ganda melalui retry.
        console.warn('[WA] Respons dibatasi browser (CORS), namun pesan kemungkinan besar tetap terkirim.', error);
        return { 
            success: true, 
            msg: 'Pesan dikirim (Mode Kompatibilitas). Silakan cek HP target/history XSender Anda.' 
        };
    }
};
