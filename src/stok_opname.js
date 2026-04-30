import { supabase } from './supabase.js';

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Check Session & Profile
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return; // layout.js handles redirect

    const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
    if (!profile) return;

    const email = profile.email;
    if(email) document.getElementById('userEmailDisplay').textContent = email;

    const formatTgl = (iso) => {
        if(!iso) return '-';
        const p = iso.split('-');
        return p.length >= 3 ? `${p[2]}/${p[1]}/${p[0]}` : iso;
    };

    let cachedGoats = [];
    let cachedLocations = [];

    const loadData = async (force = false) => {
        if (!force && cachedGoats.length > 0) return { goats: cachedGoats, locations: cachedLocations, profile };
        const [
            { data: goats },
            { data: loks }
        ] = await Promise.all([
            supabase.from('stok_kambing').select('*').eq('status_fisik', 'Ada'),
            supabase.from('master_data').select('val').eq('key', 'LOKASI').single()
        ]);
        cachedGoats = goats || [];
        cachedLocations = loks?.val || [];
        return { goats: cachedGoats, locations: cachedLocations, profile };
    };

    const tableBody = document.getElementById('tableBodyOpname');
    const searchInput = document.getElementById('searchInput');

    async function updateAuditLog(goat, newLoc, action = 'Audit Lokasi') {
        const history = goat.status_history || [];
        history.push({
            date: new Date().toISOString(),
            user: email,
            action: action,
            old_loc: goat.lokasi,
            new_loc: newLoc
        });
        return history;
    }

    async function renderTable() {
        const { goats, locations } = await loadData();
        if(!tableBody) return;
        tableBody.innerHTML = '';
        
        const term = (searchInput.value || '').toLowerCase();
        let filtered = goats.filter(k => 
            (k.no_tali || '').toLowerCase().includes(term) || 
            (k.batch || '').toLowerCase().includes(term)
        ).sort((a,b) => parseInt(a.no_tali) - parseInt(b.no_tali));

        // Stats calculation
        const todayStr = new Date().toISOString().split('T')[0];
        const checkedCount = goats.filter(k => (k.updated_at || '').startsWith(todayStr)).length;

        document.getElementById('countTersedia').textContent = goats.length;
        document.getElementById('countChecked').textContent = checkedCount;
        document.getElementById('countUnchecked').textContent = goats.length - checkedCount;

        filtered.forEach(item => {
            const isChecked = (item.updated_at || '').startsWith(todayStr);
            const tr = document.createElement('tr');
            if(isChecked) tr.style.background = 'rgba(16, 185, 129, 0.08)';
            
            tr.innerHTML = `
                <td class="sticky-col">
                    <div style="font-weight:700; color:var(--primary); font-size:1.1rem;">${item.no_tali}</div>
                    <div style="font-size:0.75rem; color:var(--text-muted);">${item.warna_tali || '-'}</div>
                </td>
                <td>${item.batch}</td>
                <td>${formatTgl(item.tgl_masuk)}</td>
                <td>${item.sex || '-'}</td>
                <td>
                    <select class="form-control select-opname" data-id="${item.id}" style="font-size:0.85rem; ${isChecked?'border-color:var(--success)':''}">
                        <option value="">Belum diset</option>
                        ${locations.map(l => `<option value="${l.nama}" ${l.nama === item.lokasi ? 'selected' : ''}>${l.nama}</option>`).join('')}
                    </select>
                </td>
                <td>
                    <div style="display:flex; gap:5px; align-items:center;">
                        <span class="badge" style="background:rgba(255,255,255,0.1); color:var(--text-main);">${item.status_transaksi}</span>
                        ${isChecked ? '✅' : '<button class="btn btn-sm btn-verify-single" data-id="${item.id}">Check</button>'}
                        <button class="btn btn-sm btn-delete-action btn-quick-dead" data-id="${item.id}">💀 Mati/Hilang</button>
                    </div>
                </td>
            `;
            tableBody.appendChild(tr);
        });

        // Event Listeners for inline actions
        document.querySelectorAll('.select-opname').forEach(sel => {
            sel.addEventListener('change', async (e) => {
                const id = e.target.dataset.id;
                const loc = e.target.value;
                const goat = goats.find(g => g.id === id);
                const newHistory = await updateAuditLog(goat, loc, 'Audit Lokasi');
                
                // Update Cache
                const updatedGoat = { ...goat, lokasi: loc, updated_at: new Date().toISOString(), status_history: newHistory };
                const idx = cachedGoats.findIndex(g => g.id === id);
                if(idx !== -1) cachedGoats[idx] = updatedGoat;

                await supabase.from('stok_kambing').update({ 
                    lokasi: loc, 
                    updated_at: updatedGoat.updated_at,
                    status_history: newHistory
                }).eq('id', id);
                
                renderTable();
                showToast('Lokasi diperbarui & Audit Log tersimpan');
            });
        });

        document.querySelectorAll('.btn-verify-single').forEach(btn => {
            btn.onclick = async (e) => {
                const id = e.target.dataset.id;
                const goat = goats.find(g => g.id === id);
                const newHistory = await updateAuditLog(goat, goat.lokasi, 'Verifikasi Fisik');
                const updatedGoat = { ...goat, updated_at: new Date().toISOString(), status_history: newHistory };
                const idx = cachedGoats.findIndex(g => g.id === id);
                if(idx !== -1) cachedGoats[idx] = updatedGoat;

                await supabase.from('stok_kambing').update({ 
                    updated_at: updatedGoat.updated_at,
                    status_history: newHistory
                }).eq('id', id);
                renderTable();
                showToast('Kambing diverifikasi');
            };
        });

        document.querySelectorAll('.btn-quick-dead').forEach(btn => {
            btn.onclick = async (e) => {
                const id = e.target.dataset.id;
                showConfirm('Tandai sebagai Mati/Hilang?', async () => {
                    const h = goat.status_history || [];
                    const upDate = new Date().toISOString();
                    h.push({ date: upDate, user: email, action: 'Mark Dead from Opname' });
                    
                    // Update Cache
                    const idx = cachedGoats.findIndex(g => g.id === id);
                    if(idx !== -1) {
                        cachedGoats[idx] = { ...goat, status_kesehatan: 'Mati', status_fisik: 'Mati', status_history: h, updated_at: upDate };
                    }

                    await supabase.from('stok_kambing').update({ 
                        status_kesehatan: 'Mati', 
                        status_fisik: 'Mati',
                        status_history: h,
                        updated_at: upDate
                    }).eq('id', id);
                    renderTable();
                    showToast('Status diperbarui');
                });
            };
        });
    }

    // Bulk Verify Logic
    document.getElementById('btnVerifyBulk')?.addEventListener('click', async () => {
        const { goats } = await loadData();
        const term = (searchInput.value || '').toLowerCase();
        let filtered = goats.filter(k => 
            (k.no_tali || '').toLowerCase().includes(term) || 
            (k.batch || '').toLowerCase().includes(term)
        );

        if(!filtered.length) return;
        
        showConfirm(`Verifikasi ${filtered.length} kambing sekaligus?`, async () => {
            showToast('Memproses verifikasi massal...', 'info');
            for(const item of filtered) {
                const h = item.status_history || [];
                const upDate = new Date().toISOString();
                h.push({ date: upDate, user: email, action: 'Verifikasi Massal' });
                
                // Update Cache
                const idx = cachedGoats.findIndex(g => g.id === item.id);
                if(idx !== -1) cachedGoats[idx] = { ...item, updated_at: upDate, status_history: h };

                await supabase.from('stok_kambing').update({ 
                    updated_at: upDate,
                    status_history: h
                }).eq('id', item.id);
            }
            renderTable();
            showToast('Verifikasi massal selesai!');
        });
    });

    // Send Daily Audit Report WA
    document.getElementById('btnSendReportWA')?.addEventListener('click', async () => {
        const { goats, profile } = await loadData();
        const todayStr = new Date().toISOString().split('T')[0];
        
        const total = goats.length;
        const checkedGoats = goats.filter(k => (k.updated_at || '').startsWith(todayStr));
        const uncheckedGoats = goats.filter(k => !(k.updated_at || '').startsWith(todayStr));
        
        const sudah = checkedGoats.length;
        const belum = uncheckedGoats.length;
        const persen = total > 0 ? Math.round((sudah / total) * 100) : 0;
        
        // Ambil 15 sample no tali yang belum dicek
        const sampleUnchecked = uncheckedGoats.slice(0, 15).map(k => k.no_tali).join(', ');
        const catatan = belum > 15 ? `${sampleUnchecked}, ... (+${belum - 15} lainnya)` : (sampleUnchecked || 'Semua Selesai! ✅');

        const config = await window.getWaConfig();
        const reportData = {
            tgl: new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
            sudah: sudah.toString(),
            belum: belum.toString(),
            persentase: persen.toString(),
            catatan: catatan
        };

        const msg = await window.parseWaTemplate(config.templateAuditDaily, reportData);
        
        // Kirim ke nomor Admin (dari profile atau prompt jika tidak ada)
        let adminNumber = profile?.phone || '';
        if (!adminNumber) {
            adminNumber = prompt("Masukkan No WhatsApp Admin untuk menerima laporan:", "08...");
            if (!adminNumber) return;
        }

        showToast('🚀 Mengirim Laporan Audit ke WhatsApp...', 'info');
        const res = await window.sendWa(adminNumber, msg);
        
        if (res.success) {
            showToast('✅ Laporan Audit Berhasil Terkirim!', 'success');
        } else {
            window.showConfirm(`WA Laporan Gagal: ${res.msg}\n\nIngin kirim manual?`, () => {
                window.open(res.link, '_blank');
            }, null, 'WA Gateway Masalah', 'Kirim Manual', 'btn-primary');
        }
    });

    searchInput.addEventListener('input', renderTable);


    document.getElementById('btnExportCsv')?.addEventListener('click', async () => {
        const { goats } = await loadData();
        const { data: trxs } = await supabase.from('transaksi').select('*');
        
        let headers = ['No Tali', 'Batch', 'Warna Tali', 'Lokasi Sistem', 'Lokasi Fisik (Cek)', 'Status', 'Sohibul', 'Agen'];
        let csv = headers.join(',') + '\n';
        
        goats.forEach(i => {
            const trx = (trxs || []).find(t => t.id === i.transaction_id);
            csv += [
                i.no_tali, i.batch, i.warna_tali, 
                `"${i.lokasi || '-'}"`, '""', // Space for pen check
                i.status_transaksi, 
                `"${trx?.customer?.nama || '-'}"`,
                `"${trx?.agen?.nama || '-'}"`
            ].join(',') + '\n';
        });

        const blob = new Blob([csv], { type: 'text/csv' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `Stok_Opname_${Date.now()}.csv`;
        link.click();
    });

    renderTable();
});
