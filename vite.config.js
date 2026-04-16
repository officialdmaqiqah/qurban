import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    cssMinify: false,
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
        login: resolve(__dirname, 'login.html'),
        etalase: resolve(__dirname, 'etalase.html'),
        dashboard: resolve(__dirname, 'dashboard.html'),
        kambing: resolve(__dirname, 'kambing.html'),
        kambing_masuk: resolve(__dirname, 'kambing_masuk.html'),
        kambing_terjual: resolve(__dirname, 'kambing_terjual.html'),
        keuangan: resolve(__dirname, 'keuangan.html'),
        terima_pelunasan: resolve(__dirname, 'terima_pelunasan.html'),
        pengaturan: resolve(__dirname, 'pengaturan.html'),
        hutang_supplier: resolve(__dirname, 'hutang_supplier.html'),
        komisi: resolve(__dirname, 'komisi.html'),
        distribusi: resolve(__dirname, 'distribusi.html'),
        kesehatan: resolve(__dirname, 'kesehatan.html'),
        stok_opname: resolve(__dirname, 'stok_opname.html'),
        laporan: resolve(__dirname, 'laporan.html'),
        register: resolve(__dirname, 'register.html'),
        forgot_password: resolve(__dirname, 'forgot_password.html'),
        deposit_agen: resolve(__dirname, 'deposit_agen.html')
      }
    }
  },
  server: {
    host: true,
    allowedHosts: true
  }
});
