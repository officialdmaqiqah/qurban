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

    const loadGoats = async (force = false) => {
        if (!force && cachedGoats.length > 0) return cachedGoats;
        const { data } = await supabase.from('stok_kambing').select('*').neq('status_kesehatan', 'Sehat');
        cachedGoats = data || [];
        return cachedGoats;
    };

    const updateStats = (data) => {
        const inCare = data.filter(k => k.status_kesehatan === 'Sakit' || k.status_kesehatan === 'Perawatan').length;
        const urgent = data.filter(k => (k.catatan_keluar || '').toLowerCase().includes('urgent') || (k.catatan_keluar || '').toLowerCase().includes('parah')).length;
        
        const today = new Date().toISOString().split('T')[0];
        const thisMonth = today.substring(0, 7);
        // Recovered is tricky because they are removed from this list (status becomes 'Sehat'). 
        // For now, we show 0 or fetch from audit logs if needed. 
        // But let's show a placeholder or count based on a recent 'updated_at' where status was changed to Sehat.
        
        document.getElementById('statInCare').textContent = inCare;
        document.getElementById('statUrgent').textContent = urgent;
    };

    const tableBody = document.getElementById('tableBodyKeluar');
    const modalKeluar = document.getElementById('modalKeluar');
    const selectTarget = document.getElementById('inpKambingTarget');
    
    async function renderTable() {
        const goats = await loadGoats();
        if(!tableBody) return;

        const term = (document.getElementById('inpSearch')?.value || '').toLowerCase();
        const healthFilter = document.getElementById('selHealthStatus')?.value || 'all';

        let filtered = goats.filter(k => {
            const matchSearch = (k.no_tali || '').toLowerCase().includes(term) || 
                                (k.batch || '').toLowerCase().includes(term) ||
                                (k.catatan_keluar || '').toLowerCase().includes(term);
            
            let matchStatus = true;
            if (healthFilter === 'sakit') matchStatus = (k.status_kesehatan === 'Sakit' || k.status_kesehatan === 'Perawatan');
            else if (healthFilter === 'sembuh') matchStatus = k.status_kesehatan === 'Sehat'; // Should not be in this list though
            
            return matchSearch && matchStatus;
        }).sort((a,b) => new Date(b.updated_at || b.tgl_keluar) - new Date(a.updated_at || a.tgl_keluar));

        tableBody.innerHTML = '';
        updateStats(goats);
        
        if (filtered.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:2rem; color:var(--text-muted);">Tidak ada data kesehatan ditemukan.</td></tr>`;
            return;
        }

        filtered.forEach((item) => {
            const tr = document.createElement('tr');
            const badge = item.status_kesehatan === 'Mati' ? 'badge-danger' : 'badge-warning';
            tr.innerHTML = `
                <td class="sticky-col">
                    <div style="font-weight:700; color:var(--warning); font-size:1.1rem;">${item.no_tali}</div>
                    <div style="font-size:0.75rem; color:var(--text-muted);">${item.warna_tali || '-'}</div>
                </td>
                <td><span class="badge" style="background:rgba(255,255,255,0.05); color:var(--text-main); border:1px solid rgba(255,255,255,0.1);">Batch ${item.batch}</span></td>
                <td style="font-weight:600;">${formatTgl(item.tgl_keluar)}</td>
                <td>
                    <span class="badge ${badge}">${(item.status_kesehatan || 'Sakit').toUpperCase()}</span>
                    <div style="font-size:0.8rem; margin-top:4px; color:var(--text-muted); line-height:1.3;">${item.catatan_keluar || '-'}</div>
                </td>
                <td>
                    <select class="form-control" onchange="window.updateHealth(this, '${item.id}')" style="font-size:0.75rem; background:rgba(16, 185, 129, 0.1); border-color:var(--primary);">
                        <option value="">-- Tindakan --</option>
                        <option value="Sehat">✅ Sudah Sembuh</option>
                        <option value="Mati">💀 Mati / Afkir</option>
                        <option value="Disembelih">🔪 Disembelih Darurat</option>
                    </select>
                </td>
            `;
            tableBody.appendChild(tr);
        });
    }

    window.updateHealth = async (sel, id) => {
        const val = sel.value; if(!val) return;
        const currentGoat = cachedGoats.find(g => g.id === id);

        showConfirm(`Update status ${currentGoat.no_tali} menjadi ${val}?`, async () => {
            const upDate = new Date().toISOString();
            const updates = { status_kesehatan: val, updated_at: upDate };

            if(val === 'Mati' || val === 'Disembelih') {
                 const comp = prompt("Komentar: Masukkan nominal kompensasi supplier (Rp) - Opsional:", "0");
                 const kompensasi = parseFloat(comp) || 0;
                 
                 updates.status_fisik = 'Mati';
                 updates.status_transaksi = val;
                 updates.tgl_keluar = upDate.split('T')[0];

                 await supabase.from('stok_kambing').update(updates).eq('id', id);
                 
                 // Record loss
                 await supabase.from('keuangan').insert([{
                     id: 'LOSS-'+Date.now(), tipe: 'pengeluaran', tanggal: updates.tgl_keluar,
                     kategori: 'Kerugian (Mati/Hilang)', nominal: currentGoat.harga_nota, 
                     keterangan: `Kerugian ${val} No Tali ${currentGoat.no_tali} (Eks Sakit)`, channel: 'Non-Kas', related_goat_id: id
                 }]);
                 
                 if(kompensasi > 0) {
                     await supabase.from('keuangan').insert([{
                         id: 'KOMP-'+Date.now(), tipe: 'pemasukan', tanggal: updates.tgl_keluar,
                         kategori: 'Kompensasi Supplier', nominal: kompensasi,
                         keterangan: `Kompensasi ${val} No Tali ${currentGoat.no_tali}`, channel: 'Non-Kas', related_goat_id: id,
                         supplier: currentGoat.supplier, batch: currentGoat.batch
                     }]);
                 }
            } else {
                // Sembuh
                updates.status_kesehatan = 'Sehat';
                updates.tgl_keluar = null;
                updates.catatan_keluar = null;
                await supabase.from('stok_kambing').update(updates).eq('id', id);
            }

            showToast(`Status ${currentGoat.no_tali} diperbarui!`);
            await loadGoats(true);
            renderTable();
        });
        sel.value = "";
    };

    document.getElementById('btnTambahSakit')?.addEventListener('click', async () => {
        const { data: eligible } = await supabase.from('stok_kambing').select('*').eq('status_kesehatan', 'Sehat').eq('status_fisik', 'Ada');
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

    const modalKomp = document.getElementById('modalKompensasi');
    const closeKomp = () => modalKomp?.classList.remove('active');
    document.getElementById('btnCloseKomp')?.addEventListener('click', closeKomp);
    document.getElementById('btnSkipKomp')?.addEventListener('click', closeKomp);

    document.getElementById('formSakit')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const noTali = selectTarget.value;
        const note = document.getElementById('inpCatatan').value;
        const tgl = document.getElementById('inpTglKeluar').value || new Date().toISOString().split('T')[0];
        const stt = document.getElementById('inpTargetStatus').value;

        const { data: goat } = await supabase.from('stok_kambing').select('*').eq('no_tali', noTali).eq('status_fisik', 'Ada').single();
        if(!goat) return showAlert('Kambing tidak ditemukan atau sedang tidak tersedia!', 'warning');

        if(goat.status_transaksi === 'Terjual') {
            const conf = await confirm('⚠️ Kambing ini SUDAH TERJUAL! Jika sakit parah, harap segera hubungi konsumen. Lanjutkan?');
            if (!conf) return;
        }

        await supabase.from('stok_kambing').update({ 
            status_kesehatan: stt, 
            tgl_keluar: tgl, 
            catatan_keluar: note,
            updated_at: new Date().toISOString()
        }).eq('id', goat.id);

        modalKeluar.classList.remove('active');
        await loadGoats(true);
        renderTable();
        showToast(`Kambing No ${noTali} masuk daftar penanganan kesehatan.`);
    });

    document.getElementById('inpSearch')?.addEventListener('input', renderTable);
    document.getElementById('selHealthStatus')?.addEventListener('change', renderTable);

    renderTable();
});
