import { supabase } from './supabase.js';

document.addEventListener('DOMContentLoaded', async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
    if (!profile) return;

    const formatRp = (v) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v || 0);
    const formatTgl = (iso) => {
        if(!iso) return '-';
        const p = iso.split('T')[0].split('-');
        return p.length >= 3 ? `${p[2]}/${p[1]}/${p[0]}` : iso;
    };

    let cachedGoats = [];
    const tableBody = document.getElementById('tableBodyKeluar');
    const modalKeluar = document.getElementById('modalKeluar');
    const formSakit = document.getElementById('formSakit');
    const selectTarget = document.getElementById('inpKambingTarget');

    const loadData = async (force = false) => {
        if (!force && cachedGoats.length > 0) return cachedGoats;
        
        // Ambil semua data kambing yang:
        // 1. Sedang Sakit/Perawatan/Disembelih Darurat (Kesehatan != Sehat)
        // 2. Mati / Hilang (Fisik in Mati, Hilang)
        const { data } = await supabase.from('stok_kambing')
            .select('*')
            .or('status_kesehatan.neq.Sehat,status_fisik.in.(Mati,Hilang)')
            .not('status_transaksi', 'eq', 'Terdistribusi')
            .not('status_fisik', 'eq', 'Terdistribusi');
            
        cachedGoats = data || [];
        return cachedGoats;
    };

    const updateStats = async (data) => {
        const today = new Date().toISOString().split('T')[0];
        const thisMonth = today.substring(0, 7);
        
        const inCare = data.filter(k => (k.status_kesehatan === 'Sakit' || k.status_kesehatan === 'Perawatan') && k.status_fisik === 'Ada' && k.status_transaksi !== 'Terdistribusi').length;
        const matiMonth = data.filter(k => k.status_fisik === 'Mati' && (k.tgl_keluar || '').startsWith(thisMonth)).length;
        const recoveredMonth = data.filter(k => k.status_kesehatan === 'Sehat' && (k.updated_at || '').startsWith(thisMonth)).length;

        // Hitung Net Loss dari tabel keuangan untuk bulan ini
        const { data: finData } = await supabase.from('keuangan')
            .select('nominal, tipe, kategori, tanggal')
            .gte('tanggal', thisMonth + '-01')
            .lte('tanggal', today);

        let netLoss = 0;
        (finData || []).forEach(f => {
            if (f.kategori === 'Kerugian (Mati/Hilang)') netLoss += f.nominal;
            if (f.kategori === 'Kompensasi Supplier') netLoss -= f.nominal;
        });

        document.getElementById('statInCare').textContent = inCare + ' Ekor';
        document.getElementById('statMati').textContent = matiMonth + ' Ekor';
        document.getElementById('statRecovered').textContent = recoveredMonth + ' Ekor';
        document.getElementById('statNetLoss').textContent = formatRp(netLoss);
    };

    async function renderTable() {
        const goats = await loadData();
        if(!tableBody) return;
        
        const term = (document.getElementById('inpSearch')?.value || '').toLowerCase();
        const filter = document.getElementById('selHealthStatus')?.value || 'all';

        let filtered = goats.filter(item => {
            const st = (item.status_transaksi || '').toLowerCase().trim();
            const sf = (item.status_fisik || '').toLowerCase().trim();
            const sk = (item.status_kesehatan || '').toLowerCase().trim();

            // 1. Filter Dasar: Sembunyikan yang sudah keluar kandang (Terdistribusi/Terjual) jika sudah Sehat
            if (st.includes('distribusi') || sf.includes('distribusi') || st.includes('jual')) {
                // Kecuali jika user memang memfilter khusus yang 'mati' atau 'hilang'
                if (filter !== 'mati' && filter !== 'hilang') {
                    if (sk === 'sehat' || sk === 'ada' || sk === '') return false;
                }
            }
            
            // 2. Tambahan: Jika statusnya SEHAT dan sedang melihat "Semua Histori" atau filter lain selain "Sembuh",
            // sembunyikan jika kambing tersebut sudah tidak tersedia (sudah dibeli/keluar)
            if (sk === 'sehat' && filter !== 'sembuh') {
                if (st !== 'tersedia') return false;
            }

            const matchSearch = (item.no_tali || '').toLowerCase().includes(term) || 
                               (item.batch || '').toLowerCase().includes(term) ||
                               (item.catatan_keluar || '').toLowerCase().includes(term);
            
            let matchStatus = true;
            const itemStatus = (item.status_kesehatan || '').toLowerCase();
            const itemFisik = (item.status_fisik || '').toLowerCase();

            if (filter === 'sakit') matchStatus = (itemStatus === 'sakit' || itemStatus === 'perawatan') && itemFisik === 'ada';
            else if (filter === 'mati') matchStatus = (itemFisik === 'mati' || itemStatus === 'disembelih');
            else if (filter === 'sembuh') matchStatus = (itemStatus === 'sehat');
            else if (filter === 'hilang') matchStatus = (itemFisik === 'hilang');
            
            return matchSearch && matchStatus;
        }).sort((a,b) => new Date(b.updated_at || b.tgl_keluar || 0) - new Date(a.updated_at || a.tgl_keluar || 0));

        tableBody.innerHTML = '';
        updateStats(goats);
        
        if (filtered.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:2rem; color:var(--text-muted);">Tidak ada histori kesehatan ditemukan.</td></tr>`;
            return;
        }

        filtered.forEach((item) => {
            const tr = document.createElement('tr');
            let badgeClass = 'badge-warning';
            if (item.status_fisik === 'Mati' || item.status_kesehatan === 'Mati') badgeClass = 'badge-danger';
            else if (item.status_kesehatan === 'Sehat') badgeClass = 'badge-success';
            else if (item.status_fisik === 'Hilang') badgeClass = 'badge-warning';

            tr.innerHTML = `
                <td class="sticky-col">
                    <div style="font-weight:700; color:var(--primary); font-size:1.1rem;">${item.no_tali}</div>
                    <div style="font-size:0.75rem; color:var(--text-muted);">${item.warna_tali || '-'}</div>
                </td>
                <td>
                    <span class="badge" style="background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1);">Batch ${item.batch}</span>
                    <div style="font-size:0.7rem; color:var(--text-muted); margin-top:4px;">${item.supplier || '-'}</div>
                </td>
                <td style="font-weight:600;">${formatTgl(item.tgl_keluar || item.updated_at)}</td>
                <td style="padding-right: 1.5rem;">
                     <span class="badge ${badgeClass}">${(item.status_kesehatan || item.status_fisik || 'Sakit').toUpperCase()}</span>
                     <div style="font-size:0.8rem; margin-top:4px; color:var(--text-muted); line-height:1.3;">${item.catatan_keluar || '-'}</div>
                </td>
                <td>
                    <div style="display:flex; gap:4px; align-items:center;">
                        ${(item.status_fisik === 'Mati' || item.status_kesehatan === 'Disembelih' || item.status_fisik === 'Hilang') ? `
                            <button class="btn btn-sm" onclick="window.editLossRecord('${item.id}')" style="padding:4px; background:rgba(var(--primary-rgb), 0.1); border:1px solid rgba(var(--primary-rgb), 0.2);" title="Edit Catatan & Kompensasi">✏️</button>
                            <button class="btn btn-sm" onclick="window.rollbackStatus('${item.id}', '${item.no_tali}')" style="padding:4px; background:rgba(var(--danger-rgb),0.1); border:1px solid rgba(var(--danger-rgb),0.2);" title="Batalkan / Restore">↩️</button>
                        ` : `
                            <select class="form-control" onchange="window.updateHealth(this, '${item.id}')" style="font-size:0.75rem; background:rgba(16, 185, 129, 0.1); border-color:var(--primary); padding:2px 5px; height:auto;">
                                <option value="">-- Tindakan --</option>
                                <option value="Sehat">✅ Sudah Sembuh</option>
                                <option value="Mati">💀 Mati / Afkir</option>
                                <option value="Disembelih">🔪 Disembelih Darurat</option>
                            </select>
                        `}
                    </div>
                </td>
            `;
            tableBody.appendChild(tr);
        });
    }

    window.updateHealth = async (sel, id) => {
        const val = sel.value; if(!val) return;
        const currentGoat = cachedGoats.find(g => g.id === id);
        if(!currentGoat) return;

        window.showConfirm(`Update status <b>${currentGoat.no_tali}</b> menjadi <b>${val}</b>?`, async () => {
            const upDate = new Date().toISOString();
            const updates = { status_kesehatan: val, updated_at: upDate };

            if(val === 'Mati' || val === 'Disembelih') {
                 window.showInput("Catatan Tindakan (Opsional):", "", (note) => {
                    window.showInput(`Nominal Kompensasi Supplier (Rp) - ${val}:`, "0", async (kompStr) => {
                        const kompensasi = window.parseNum(kompStr);
                        updates.status_fisik = 'Mati';
                        updates.status_transaksi = val;
                        updates.tgl_keluar = upDate.split('T')[0];
                        updates.catatan_keluar = note;

                        await supabase.from('stok_kambing').update(updates).eq('id', id);
                        
                        // Keuangan Kerugian
                        const { error: errLoss } = await supabase.from('keuangan').insert([{
                            id: 'LOSS-'+Date.now(), tipe: 'pengeluaran', tanggal: updates.tgl_keluar,
                            kategori: 'Kerugian (Mati/Hilang)', nominal: currentGoat.harga_nota, 
                            keterangan: `Kerugian ${val} No Tali ${currentGoat.no_tali}`, channel: 'Non-Kas', related_goat_id: id
                        }]);

                        if (errLoss) {
                            console.error("Loss entry failed:", errLoss);
                            window.showAlert("⚠️ Gagal mencatat kerugian ke keuangan: " + errLoss.message, "danger");
                        }
                        
                        if(kompensasi > 0) {
                            const { error: errKomp } = await supabase.from('keuangan').insert([{
                                id: 'KOMP-'+Date.now(), tipe: 'pemasukan', tanggal: updates.tgl_keluar,
                                kategori: 'Kompensasi Supplier', nominal: kompensasi,
                                keterangan: `Kompensasi ${val} No Tali ${currentGoat.no_tali}`, channel: 'Non-Kas', related_goat_id: id,
                                supplier: currentGoat.supplier, batch: currentGoat.batch
                            }]);
                            if (errKomp) {
                                console.error("Compensation entry failed:", errKomp);
                                window.showAlert("⚠️ Gagal mencatat kompensasi ke keuangan: " + errKomp.message, "danger");
                            }
                        }
                        window.showToast('Data diperbarui!', 'success');
                        await loadData(true);
                        renderTable();
                    }, null, "Kompensasi");
                 }, null, "Catatan");
            } else {
                // Sembuh
                const history = currentGoat.status_history || [];
                history.push({
                    date: upDate,
                    user: profile.email || 'system',
                    action: 'Recovered (Sehat)',
                    old_status: currentGoat.status_kesehatan
                });

                updates.status_kesehatan = 'Sehat';
                updates.status_fisik = 'Ada';
                
                // Smart Recovery: If already sold, stay sold.
                if (currentGoat.transaction_id) {
                    updates.status_transaksi = 'Terjual';
                    // Do NOT nullify transaction_id!
                } else {
                    updates.status_transaksi = 'Tersedia';
                    updates.transaction_id = null;
                }
                
                updates.status_history = history;

                await supabase.from('stok_kambing').update(updates).eq('id', id);
                window.showToast('Kambing kembali Sehat!', 'success');
                await loadData(true);
                renderTable();
            }
        }, () => { sel.value = ""; });
    };

    window.editLossRecord = async (id) => {
        const goat = cachedGoats.find(g => g.id === id);
        if(!goat) return;

        const { data: finKomp } = await supabase.from('keuangan')
            .select('*').eq('related_goat_id', id).eq('kategori', 'Kompensasi Supplier').maybeSingle();

        window.showInput("Edit Catatan:", goat.catatan_keluar || '', (newNote) => {
            window.showInput("Edit Kompensasi (Rp):", finKomp ? finKomp.nominal : 0, async (newKompStr) => {
                const newKomp = window.parseNum(newKompStr);
                await supabase.from('stok_kambing').update({ catatan_keluar: newNote }).eq('id', id);
                
                if (newKomp > 0) {
                    if (finKomp) {
                        await supabase.from('keuangan').update({ nominal: newKomp }).eq('id', finKomp.id);
                    } else {
                        await supabase.from('keuangan').insert([{
                            id: 'KOMP-'+Date.now(), tipe: 'pemasukan', tanggal: goat.tgl_keluar || new Date().toISOString().split('T')[0],
                            kategori: 'Kompensasi Supplier', nominal: newKomp, related_goat_id: id,
                            supplier: goat.supplier, batch: goat.batch
                        }]);
                    }
                } else if (finKomp) {
                    await supabase.from('keuangan').delete().eq('id', finKomp.id);
                }
                window.showToast('Berhasil diperbarui!', 'success');
                await loadData(true);
                renderTable();
            });
        });
    };

    window.rollbackStatus = async (id, noTali) => {
        window.showConfirm(`Kembalikan <b>${noTali}</b> ke status Sakit?<br><small>Menghapus data kerugian terkait.</small>`, async () => {
            const history = currentGoat.status_history || [];
            history.push({
                date: new Date().toISOString(),
                user: profile.email || 'system',
                action: 'Rollback to Sakit',
                old_status: currentGoat.status_kesehatan
            });

            const updates = {
                status_kesehatan: 'Sakit', 
                status_fisik: 'Ada', 
                status_history: history,
                tgl_keluar: null, 
                catatan_keluar: null,
                updated_at: new Date().toISOString()
            };

            // Smart Recovery in Rollback
            if (currentGoat.transaction_id) {
                updates.status_transaksi = 'Terjual';
            } else {
                updates.status_transaksi = 'Tersedia';
                updates.transaction_id = null;
            }

            await supabase.from('stok_kambing').update(updates).eq('id', id);

            await supabase.from('keuangan').delete().eq('related_goat_id', id).in('kategori', ['Kerugian (Mati/Hilang)', 'Kompensasi Supplier']);
            
            window.showToast('Status dibatalkan!', 'success');
            await loadData(true);
            renderTable();
        }, null, 'Restore Status', 'Ya, Restore', 'btn-danger');
    };

    document.getElementById('btnTambahSakit')?.addEventListener('click', async () => {
        const { data: eligible } = await supabase.from('stok_kambing').select('*').eq('status_fisik', 'Ada');
        const list = document.getElementById('listKambingTarget');
        list.innerHTML = '';
        if (eligible) {
            eligible.forEach(k => {
                const o = document.createElement('option');
                const warna = k.warna_tali || 'Tanpa Warna';
                const label = `No ${k.no_tali} [${warna}] | Batch ${k.batch} | ${k.status_transaksi}`;
                o.value = label;
                o.textContent = label;
                list.appendChild(o);
            });
        }
        modalKeluar.classList.add('active');
    });

    formSakit?.addEventListener('submit', async (e) => {
        e.preventDefault();
        // Logika Ekstra Robust untuk mengambil data kambing yang spesifik
        const rawVal = selectTarget.value.trim();
        
        // Parsing Format: "No 14 [Orange] | Batch BT006 | Tersedia"
        let noTali = '';
        let warna = '';
        let batch = '';

        if (rawVal.includes('|')) {
            const parts = rawVal.split('|');
            // Part 1: "No 14 [Orange] "
            const p1 = parts[0].trim();
            noTali = p1.replace(/^No\s+/i, '').split('[')[0].trim();
            const wMatch = p1.match(/\[(.*?)\]/);
            warna = wMatch ? wMatch[1].trim() : '';
            
            // Part 2: " Batch BT006 "
            batch = parts[1].replace(/Batch/i, '').trim();
        } else {
            // Fallback: Jika diinput manual angka saja
            noTali = rawVal.replace(/^No\s+/i, '').split(' ')[0].split('[')[0].trim();
        }
        
        console.log("Mencari Kambing Spesifik:", { noTali, warna, batch });

        // 1. Cari kambing yang 'Ada' dengan kriteria spesifik
        let query = supabase.from('stok_kambing').select('*').ilike('no_tali', noTali).eq('status_fisik', 'Ada');
        if (warna) query = query.eq('warna_tali', warna);
        if (batch) query = query.eq('batch', batch);

        const { data: goats, error } = await query.limit(1);

        const goat = (goats && goats.length > 0) ? goats[0] : null;

        // 2. Jika tidak ketemu, coba cari tanpa filter 'Ada' untuk diagnosa
        if (!goat) {
            let diagQuery = supabase.from('stok_kambing').select('id, no_tali, status_fisik').ilike('no_tali', noTali);
            if (warna) diagQuery = diagQuery.eq('warna_tali', warna);
            const { data: checkAny } = await diagQuery.limit(1);
            
            if (checkAny && checkAny.length > 0) {
                return window.showAlert(`Kambing <b>${noTali} ${warna}</b> ditemukan, tapi statusnya <b>${checkAny[0].status_fisik}</b>.`, 'warning');
            }
            return window.showAlert(`Kambing <b>${noTali} ${warna}</b> tidak ditemukan.`, 'danger');
        }

        const note = document.getElementById('inpCatatan').value;
        const tgl = document.getElementById('inpTglKeluar').value || new Date().toISOString().split('T')[0];
        const sttInp = document.getElementById('inpTargetStatus').value;

        const updates = { updated_at: new Date().toISOString(), catatan_keluar: note, tgl_keluar: tgl };
        
        if (['Mati', 'Disembelih', 'Hilang'].includes(sttInp)) {
            // Sudden death/loss
            updates.status_kesehatan = sttInp;
            updates.status_fisik = sttInp === 'Hilang' ? 'Hilang' : 'Mati';
            updates.status_transaksi = sttInp;
            
            await supabase.from('stok_kambing').update(updates).eq('id', goat.id);
            await supabase.from('keuangan').insert([{
                id: 'LOSS-'+Date.now(), tipe: 'pengeluaran', tanggal: tgl,
                kategori: 'Kerugian (Mati/Hilang)', nominal: goat.harga_nota, 
                keterangan: `Kerugian ${sttInp} No Tali ${goat.no_tali}`, channel: 'Non-Kas', related_goat_id: goat.id
            }]);
        } else {
            // Sick/Treating
            updates.status_kesehatan = sttInp;
            await supabase.from('stok_kambing').update(updates).eq('id', goat.id);
        }

        window.showToast('Data berhasil disimpan!', 'success');
        modalKeluar.classList.remove('active');
        await loadData(true);
        renderTable();
    });

    document.getElementById('btnCloseModal')?.addEventListener('click', () => modalKeluar.classList.remove('active'));
    document.getElementById('btnCancelModal')?.addEventListener('click', () => modalKeluar.classList.remove('active'));
    document.getElementById('inpSearch')?.addEventListener('input', renderTable);
    document.getElementById('selHealthStatus')?.addEventListener('change', renderTable);

    const today = new Date().toISOString().split('T')[0];
    document.getElementById('inpTglKeluar').value = today;

    renderTable();
});
