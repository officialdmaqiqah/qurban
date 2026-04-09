import { supabase } from './supabase.js';

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Check Session & Profile
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return; // layout.js handles redirect

    const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
    if (!profile) return;

    const email = profile.email;
    if (email) document.getElementById('userEmailDisplay').textContent = email;


    const formatRp = (v) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v || 0);
    const formatTgl = (iso) => {
        if(!iso) return '-';
        const p = iso.split('-');
        return p.length >= 3 ? `${p[2]}/${p[1]}/${p[0]}` : iso;
    };

    let cachedGoats = [];

    const loadData = async (force = false) => {
        if (!force && cachedGoats.length > 0) return cachedGoats;
        
        const { data: ghosts } = await supabase.from('stok_kambing')
            .select('*')
            .in('status_fisik', ['Mati', 'Hilang']);
            
        cachedGoats = ghosts || [];
        return cachedGoats;
    };

    const updateStats = (data) => {
        const today = new Date().toISOString().split('T')[0];
        const month = today.substring(0, 7);
        
        const total = data.length;
        const hariIni = data.filter(k => (k.tgl_keluar || '').startsWith(today)).length;
        
        // Kompensasi ambil dari tabel keuangan (Bisa dipindah ke query terpisah jika data sangat besar)
        // Namun untuk kemudahan, kita asumsikan data statik dulu atau hitung dari field jika ada
        // Di sini kita hitung dari data kambing jika kita simpan field kompensasi di sana, 
        // tapi di skema lama kompensasi ada di tabel keuangan. 
        // Untuk sekarang kita biarkan total kompensasi dihitung nanti atau pakai dummy dulu jika belum ada field-nya di kambing.
        
        document.getElementById('statTotalMati').textContent = total;
        document.getElementById('statMatiHariIni').textContent = hariIni;
        // document.getElementById('statTotalKompensasi').textContent = formatRp(totalKomp);
    };

    async function renderTable() {
        const data = await loadData();
        if(!tableBody) return;
        
        const term = (document.getElementById('inpSearch')?.value || '').toLowerCase();
        const range = document.getElementById('selTimeRange')?.value || 'all';
        const today = new Date().toISOString().split('T')[0];
        const thisMonth = today.substring(0, 7);

        let filtered = data.filter(k => {
            const matchSearch = (k.no_tali || '').toLowerCase().includes(term) || 
                                (k.batch || '').toLowerCase().includes(term) ||
                                (k.supplier || '').toLowerCase().includes(term);
            
            let matchRange = true;
            if (range === 'today') matchRange = (k.tgl_keluar || '').startsWith(today);
            else if (range === 'month') matchRange = (k.tgl_keluar || '').startsWith(thisMonth);
            
            return matchSearch && matchRange;
        }).sort((a,b) => new Date(b.tgl_keluar) - new Date(a.tgl_keluar));

        tableBody.innerHTML = '';
        updateStats(data);
        
        if (filtered.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:2rem; color:var(--text-muted);">Tidak ada data kematian ditemukan.</td></tr>`;
            return;
        }

        filtered.forEach((item) => {
            const tr = document.createElement('tr');
            const statusText = (item.status_kesehatan || item.status_fisik || 'Mati').toUpperCase();
            tr.innerHTML = `
                <td class="sticky-col">
                    <div style="font-weight:700; color:var(--danger); font-size:1.1rem;">${item.no_tali}</div>
                    <div style="font-size:0.75rem; color:var(--text-muted);">${item.warna_tali || '-'}</div>
                </td>
                <td><span class="badge" style="background:rgba(255,255,255,0.05); color:var(--text-main); border:1px solid rgba(255,255,255,0.1);">Batch ${item.batch}</span></td>
                <td>${item.supplier || '-'}</td>
                <td style="font-weight:600;">${formatTgl(item.tgl_keluar)}</td>
                <td>
                    <span class="badge ${item.status_fisik === 'Mati' ? 'badge-danger' : 'badge-warning'}">${statusText}</span>
                    <div style="font-size:0.8rem; margin-top:4px; color:var(--text-muted); line-height:1.3;">${item.catatan_keluar || '-'}</div>
                </td>
                <td>
                    <button class="btn btn-sm btn-danger" style="padding:4px 8px; font-size:0.7rem;" onclick="window.rollbackMati('${item.id}')">🗑️ Batal</button>
                </td>
            `;
            tableBody.appendChild(tr);
        });
    }

    window.rollbackMati = async (id) => {
        showConfirm('Kembalikan status kambing menjadi sehat/tersedia?', async () => {
             await supabase.from('stok_kambing').update({ 
                status_kesehatan: 'Sehat', 
                status_fisik: 'Ada', 
                status_transaksi: 'Tersedia', 
                tgl_keluar: null, 
                catatan_keluar: null,
                updated_at: new Date().toISOString()
             }).eq('id', id);
             
             await supabase.from('keuangan').delete().eq('related_goat_id', id).in('kategori', ['Kerugian (Mati/Hilang)', 'Kompensasi Supplier']);
             
             await loadData(true);
             renderTable();
             showToast('Status berhasil dibatalkan dan kambing dikembalikan ke stok.');
        });
    };

    document.getElementById('btnTambahMati')?.addEventListener('click', async () => {
        const { data: eligible } = await supabase.from('stok_kambing').select('*').eq('status_fisik', 'Ada');
        const list = document.getElementById('listKambingTarget');
        list.innerHTML = '';
        if (eligible) {
            eligible.forEach(k => {
                const o = document.createElement('option'); o.value = k.no_tali;
                o.textContent = `No ${k.no_tali} | Batch ${k.batch} | ${k.status_transaksi}`;
                list.appendChild(o);
            });
        }
        modalKeluar.classList.add('active');
    });

    // Close Modal Listeners
    const closeModal = () => modalKeluar.classList.remove('active');
    document.getElementById('btnCloseModal')?.addEventListener('click', closeModal);
    document.getElementById('btnCancelModal')?.addEventListener('click', closeModal);

    document.getElementById('formMati')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const noTali = selectTarget.value;
        const note = document.getElementById('inpCatatan').value;
        const tgl = document.getElementById('inpTglKeluar').value || new Date().toISOString().split('T')[0];
        const stt = document.getElementById('inpTargetStatus').value;
        const kompensasi = parseFloat(document.getElementById('inpKompensasi').value) || 0;

        const { data: goat } = await supabase.from('stok_kambing').select('*').eq('no_tali', noTali).eq('status_fisik', 'Ada').single();
        if(!goat) return showAlert('Kambing tidak ditemukan atau sudah tidak aktif!', 'warning');

        if(goat.status_transaksi === 'Terjual') {
            const conf = await new Promise(res => {
                window.showConfirm('⚠️ Kambing ini SUDAH TERJUAL! Jika Anda melanjutkan, Anda harus segera menghubungi konsumen. Lanjutkan?', () => res(true), () => res(false), 'Peringatan Penjualan', 'Ya, Lanjutkan', 'btn-danger');
            });
            if (!conf) return;
        }

        const updates = { 
            tgl_keluar: tgl, 
            catatan_keluar: note,
            updated_at: new Date().toISOString()
        };
        
        if(stt === 'mati' || stt === 'disembelih') {
            updates.status_kesehatan = stt === 'mati' ? 'Mati' : 'Disembelih';
            updates.status_fisik = 'Mati';
            updates.status_transaksi = updates.status_kesehatan;
        } else {
            updates.status_fisik = 'Hilang';
            updates.status_transaksi = 'Hilang';
        }

        await supabase.from('stok_kambing').update(updates).eq('id', goat.id);
        
        // Loss entry
        const { error: errLoss } = await supabase.from('keuangan').insert([{
            id: 'LOSS-'+Date.now(), tipe: 'pengeluaran', tanggal: tgl,
            kategori: 'Kerugian (Mati/Hilang)', nominal: goat.harga_nota, 
            keterangan: `Kerugian ${stt.toUpperCase()} No Tali ${goat.no_tali}`, channel: 'Non-Kas', related_goat_id: goat.id
        }]);

        if (errLoss) {
            console.error("Loss entry failed:", errLoss);
            window.showAlert("⚠️ Gagal mencatat kerugian ke keuangan: " + errLoss.message, "danger");
        }

        if(kompensasi > 0) {
            const { error: errKomp } = await supabase.from('keuangan').insert([{
                id: 'KOMP-'+Date.now(), tipe: 'pemasukan', tanggal: tgl,
                kategori: 'Kompensasi Supplier', nominal: kompensasi, 
                keterangan: `Kompensasi ${stt.toUpperCase()} No Tali ${goat.no_tali}`, channel: 'Non-Kas', related_goat_id: goat.id,
                supplier: goat.supplier, batch: goat.batch
            }]);
            if (errKomp) {
                console.error("Compensation entry failed:", errKomp);
                window.showAlert("⚠️ Gagal mencatat kompensasi ke keuangan: " + errKomp.message, "danger");
            }
        }

        modalKeluar.classList.remove('active');
        await loadData(true);
        renderTable();
        showToast('Kematian kambing berhasil dicatat.');
    });

    document.getElementById('inpSearch')?.addEventListener('input', renderTable);
    document.getElementById('selTimeRange')?.addEventListener('change', renderTable);

    renderTable();
});
