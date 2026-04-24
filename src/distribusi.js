import { supabase } from './supabase.js';

document.addEventListener('DOMContentLoaded', async () => {
    // 0. Immediate UI Wiring (Before any Async calls to ensure modal can always close)
    const modalTrip = document.getElementById('modalTrip');
    const closeModal = () => {
        if(modalTrip) modalTrip.classList.remove('active');
    };
    document.getElementById('btnCloseModal')?.addEventListener('click', closeModal);
    document.getElementById('btnCancelModal')?.addEventListener('click', closeModal);

    // 1. Check Session & Profile
    let session, profile;
    try {
        const { data } = await supabase.auth.getSession();
        session = data.session;
    } catch (e) {
        console.error("Auth Session Error:", e);
    }
    
    if (!session) {
        window.location.href = 'login.html';
        return;
    }

    try {
        const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
        profile = data;
    } catch (e) {
        console.error("Profile Fetch Error:", e);
    }
    
    if (!profile) return;

    const user = profile;
    const isAdmin = user.role === 'admin';
    const email = profile.email;
    if (email) {
        const display = document.getElementById('userEmailDisplay');
        if (display) display.textContent = email;
    }

    document.getElementById('logoutBtn')?.addEventListener('click', async () => {
        await supabase.auth.signOut();
        const masterKey = localStorage.getItem('SUPABASE_SERVICE_ROLE');
        localStorage.clear();
        if (masterKey) localStorage.setItem('SUPABASE_SERVICE_ROLE', masterKey);
        window.location.href = 'login.html';
    });

    const formatTgl = (iso) => {
        if(!iso) return '-';
        const p = iso.split('-');
        return p.length >= 3 ? `${p[2]}/${p[1]}/${p[0]}` : iso;
    };

    const GDRIVE_PROXY_URL = 'https://script.google.com/macros/s/AKfycbwVd01SmNkuoUwinekKbDAh3meqs8ZsbR-OZoCBPUcHZ3_jcBQST6p5vrSVJULt_t8/exec';

    async function compressImage(file) {
        return new Promise((resolve) => {
            const reader = new FileReader(); reader.readAsDataURL(file);
            reader.onload = (e) => {
                const img = new Image(); img.src = e.target.result;
                img.onload = () => {
                    const cv = document.createElement('canvas'); const ctx = cv.getContext('2d');
                    let w = img.width, h = img.height; const max = 800;
                    if (w > h) { if (w > max) { h *= max / w; w = max; } } else { if (h > max) { w *= max / h; h = max; } }
                    cv.width = w; cv.height = h; ctx.drawImage(img, 0, 0, w, h);
                    resolve(cv.toDataURL('image/jpeg', 0.6).split(',')[1]);
                };
            };
        });
    }

    async function uploadToGDrive(base64, folderName) {
        try {
            const resp = await fetch(GDRIVE_PROXY_URL, {
                method: 'POST',
                body: JSON.stringify({ base64, mimeType: "image/jpeg", fileName: "dist_" + Date.now(), folderName })
            });
            const res = await resp.json(); return res.success ? res.url : null;
        } catch (e) { return null; }
    }

    const getTrips = async () => { const { data } = await supabase.from('master_data').select('val').eq('key', 'TRIPS').single(); return data?.val || []; };
    const containerTrip = document.getElementById('containerTrip');
    const tableBodySelection = document.getElementById('tableBodySelection');
    
    let cachedTrips = [];
    let cachedGoats = [];
    let cachedTransactions = [];
    let currentTab = 'aktif'; // 'aktif' or 'histori'


    const loadData = async (force = false) => {
        if (!force && cachedTrips.length > 0) return { trips: cachedTrips, goats: cachedGoats, trxs: cachedTransactions };
        
        const [
            { data: rawTrips },
            { data: rawGoats },
            { data: rawTrxs }
        ] = await Promise.all([
            supabase.from('master_data').select('val').eq('key', 'TRIPS').single(),
            supabase.from('stok_kambing').select('*'),
            supabase.from('transaksi').select('*')
        ]);
        
        cachedTrips = rawTrips?.val || [];
        cachedGoats = rawGoats || [];
        cachedTransactions = rawTrxs || [];
        return { trips: cachedTrips, goats: cachedGoats, trxs: cachedTransactions };
    };

    const updateStatsDist = (trips, allGoats) => {
        const today = new Date().toISOString().split('T')[0];
        const tripToday = trips.filter(t => t.tglKirim === today).length;
        const waiting = allGoats.filter(k => k.status_transaksi === 'Terjual').length;
        const delivered = allGoats.filter(k => k.status_transaksi === 'Terdistribusi').length;

        const elTripToday = document.getElementById('statTripToday');
        const elWaitDist = document.getElementById('statWaitDist');
        const elDoneDist = document.getElementById('statDoneDist');
        
        if(elTripToday) elTripToday.textContent = `${tripToday} Trip`;
        if(elWaitDist) elWaitDist.textContent = `${waiting} Ekor`;
        if(elDoneDist) elDoneDist.textContent = `${delivered} Ekor`;
    };
    
    async function renderTrips() {
        const { trips, goats } = await loadData();
        const isSopir = profile?.role === 'sopir';
        
        // --- STUCK GOAT DETECTION (Unlinked Distribution) ---
        const goatIdsInTrips = new Set();
        trips.forEach(t => (t.items || []).forEach(i => goatIdsInTrips.add(i.goatId)));
        const stuckGoats = goats.filter(k => (k.status_transaksi === 'Terdistribusi' || k.status_fisik === 'Disembelih') && !goatIdsInTrips.has(k.id));
        
        const filteredTrips = trips.filter(t => {
            if(isSopir && (t.sopirNama||'').toLowerCase() !== (profile.full_name||'').toLowerCase()) return false;
            
            if (currentTab === 'aktif') return t.status === 'Pengiriman';
            if (currentTab === 'histori') return t.status === 'Selesai';
            return true;
        }).sort((a,b) => new Date(b.tglKirim) - new Date(a.tglKirim));

        updateStatsDist(trips, goats);

        containerTrip.innerHTML = '';

        // --- SHOW STUCK GOATS CARD IN HISTORY ---
        if (currentTab === 'histori' && stuckGoats.length > 0 && !isSopir) {
            const stuckCard = document.createElement('div');
            stuckCard.className = 'trip-card glass-panel';
            stuckCard.style.border = '1px dashed var(--danger)';
            stuckCard.innerHTML = `
                <div class="trip-header">
                    <div>
                        <div class="trip-id" style="color:var(--danger);">⚠️ Data Tersangkut</div>
                        <div class="trip-date">Ditemukan ${stuckGoats.length} ekor tanpa rekaman trip</div>
                    </div>
                </div>
                <div class="trip-items" style="max-height:150px; overflow-y:auto; margin:1rem 0;">
                    ${stuckGoats.map(k => `
                        <div class="trip-item" style="border-left-color:var(--danger);">
                            <div style="font-weight:600;">No.${k.no_tali} - ${k.warna_tali}</div>
                            <div style="font-size:0.75rem; color:var(--text-muted);">${k.status_fisik} | ${k.status_transaksi}</div>
                        </div>
                    `).join('')}
                </div>
                <div class="trip-footer">
                    <p style="font-size:0.75rem; color:var(--text-muted);">Kambing ini sudah terdistribusi tapi riwayatnya tidak tersimpan.</p>
                    <button class="btn btn-sm" onclick="window.rollbackStuckGoats()" style="background:var(--danger); color:white; border-radius:6px; font-weight:600; padding:8px 16px;">🔄 Reset Status Kambing</button>
                </div>
            `;
            containerTrip.appendChild(stuckCard);
        }

        if(!filteredTrips.length && !stuckGoats.length) {
            containerTrip.innerHTML = '<div style="text-align:center; padding:3rem; color:var(--text-muted); background:rgba(255,255,255,0.02); border-radius:15px; border:1px dashed rgba(255,255,255,0.1);">Belum ada rencana perjalanan (Trip) distribusi.</div>';
            return;
        }

        filteredTrips.forEach(t => {
            const card = document.createElement('div');
            card.className = 'trip-card glass-panel';
            const isDone = t.status === 'Selesai';
            card.innerHTML = `
                <div class="trip-header" style="border-bottom: 1px solid rgba(255,255,255,0.1);">
                    <div>
                        <div class="trip-id text-premium">${t.id} ${t.id.startsWith('SMB-') ? '<span class="badge-sembelih">🔪 Sembelih</span>' : ''}</div>
                        <div class="trip-date">${formatTgl(t.tglKirim)}</div>
                    </div>
                    <span class="badge ${isDone ? 'badge-success' : 'badge-warning'}" style="padding:4px 10px; font-size:0.75rem; border-radius:30px;">${t.status.toUpperCase()}</span>
                </div>

                <div class="trip-info" style="font-size:0.85rem; line-height:1.6;">
                    <div style="color:var(--text-main); font-weight:600;">🚚 ${t.sopirNama}</div>
                    <div style="color:var(--text-muted); font-size:0.75rem;">📋 ${t.nopol || '-'} • ${t.note || 'Tanpa catatan'}</div>
                </div>
                <div class="trip-items" style="background:rgba(255,255,255,0.01); border:1px solid rgba(255,255,255,0.05); margin-top: 1rem;">
                    ${t.items.map(i => `
                        <div class="trip-item" style="padding:10px 0; border-bottom:1px solid rgba(255,255,255,0.05);">
                            <div style="max-width:75%;">
                                <div style="font-weight:700; color:var(--primary); font-size:0.95rem; letter-spacing:0.02em;">${i.noTali}</div>
                                <div style="font-size:0.8rem; color:var(--text-main); font-weight:500; margin: 2px 0;">${i.konsumen}</div>
                                <div style="font-size:0.7rem; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; opacity:0.8;">📍 ${i.alamat}</div>
                            </div>
                            <div style="text-align:right;">
                                ${i.status === 'Terdistribusi' ? '<span style="color:var(--success); font-size:1.25rem;">✅</span>' : 
                                  `<button class="btn btn-sm btn-shimmer" onclick="window.openLaporDist('${t.id}','${i.goatId}','${i.konsumen}')" style="background:var(--primary); padding:6px 14px; font-size:0.75rem; border-radius:8px; border:none; box-shadow:0 4px 10px var(--primary-transparent);">Lapor</button>`}
                            </div>
                        </div>
                    `).join('')}
                </div>
                <div class="trip-footer" style="padding-top:0.5rem; justify-content:space-between;">
                     <button class="btn btn-sm" onclick="window.printTrip('${t.id}')" style="background:rgba(255,255,255,0.05); color:var(--text-main); border:1px solid rgba(255,255,255,0.1); border-radius:6px;">🖨️ Cetak</button>
                     <div style="display:flex; gap:8px;">
                        ${isDone && !isSopir ? `<button class="btn btn-sm" onclick="window.rollbackDistribution('${t.id}')" style="color:var(--danger); background:rgba(239, 68, 68, 0.05); border:1px solid rgba(239, 68, 68, 0.2); border-radius:6px; font-size:0.7rem;">↩️ Batalkan</button>` : ''}
                        ${!isSopir ? `<button class="btn btn-sm" onclick="window.deleteTrip('${t.id}')" style="color:var(--danger); background:transparent; border:none; opacity:0.6;">🗑️ Hapus</button>` : ''}
                     </div>
                </div>

            `;
            containerTrip.appendChild(card);
        });
    }

    const saveTrips = async (trips) => {
        const { data, error } = await supabase.from('master_data').upsert({ key: 'TRIPS', val: trips });
        if (error) {
            console.error('Save TRIPS error:', error);
            throw new Error('Gagal menyimpan data distribusi: ' + error.message);
        }
        cachedTrips = trips;
    };


    window.deleteTrip = async (id) => {
        showConfirm(`Hapus rekaman trip ${id}? Data stok tidak akan berubah. Gunakan 'Batalkan' jika ingin mengembalikan status kambing.`, async () => {
            const { trips } = await loadData();
            const filtered = trips.filter(t => t.id !== id);
            await saveTrips(filtered);
            showToast(`Trip ${id} dihapus.`);
            await loadData(true);
            renderTrips();
        });
    };

    window.rollbackDistribution = async (id) => {
        showConfirm(`Batalkan distribusi ${id}? Status kambing akan dikembalikan menjadi 'Terjual' & 'Ada'.`, async () => {
            try {
                showToast('Membatalkan distribusi...', 'info');
                const { trips } = await loadData();
                const trip = trips.find(t => t.id === id);
                if (!trip) throw new Error("Trip tidak ditemukan.");

                // 1. Rollback Stok Kambing
                for (const item of trip.items) {
                    await supabase.from('stok_kambing').update({
                        status_transaksi: 'Terjual',
                        status_fisik: 'Ada',
                        updated_at: new Date().toISOString()
                    }).eq('id', item.goatId);
                }

                // 2. Hapus Trip
                const filtered = trips.filter(t => t.id !== id);
                await saveTrips(filtered);

                showToast(`✅ Distribusi ${id} berhasil dibatalkan.`, 'success');
                await loadData(true);
                renderTrips();
            } catch (err) {
                showAlert('Gagal Rollback: ' + err.message, 'danger');
            }
        });
    };

    window.rollbackStuckGoats = async () => {
        showConfirm(`Reset status kambing yang tersangkut? Kambing akan kembali ke antrean 'Menunggu Kirim'.`, async () => {
            try {
                showToast('Mereset status kambing...', 'info');
                const { goats, trips } = await loadData();
                const goatIdsInTrips = new Set();
                trips.forEach(t => (t.items || []).forEach(i => goatIdsInTrips.add(i.goatId)));
                const stuckGoats = goats.filter(k => (k.status_transaksi === 'Terdistribusi' || k.status_fisik === 'Disembelih') && !goatIdsInTrips.has(k.id));

                const updates = stuckGoats.map(k => {
                    return supabase.from('stok_kambing').update({
                        status_transaksi: 'Terjual',
                        status_fisik: 'Ada',
                        updated_at: new Date().toISOString()
                    }).eq('id', k.id);
                });

                await Promise.all(updates);
                showToast(`✅ ${stuckGoats.length} ekor kambing berhasil direset.`, 'success');
                await loadData(true);
                renderTrips();
            } catch (err) {
                showAlert('Gagal reset: ' + err.message, 'danger');
            }
        });
    };



    window.openLaporDist = (tripId, goatId, nama) => {
        const modal = document.getElementById('modalLaporTuntas');
        document.getElementById('laporKonsumenNama').textContent = nama;
        modal._tripId = tripId; modal._goatId = goatId;
        
        // Reset modal state
        document.getElementById('inpBuktiFoto').value = '';
        document.getElementById('previewBukti').src = '';
        document.getElementById('previewBuktiContainer').style.display = 'none';
        
        modal.classList.add('active');
    };

    // Photo Preview Logic
    document.getElementById('inpBuktiFoto')?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (re) => {
                document.getElementById('previewBukti').src = re.target.result;
                document.getElementById('previewBuktiContainer').style.display = 'block';
            };
            reader.readAsDataURL(file);
        }
    });

    // Camera Integration
    document.getElementById('btnOpenCameraDist')?.addEventListener('click', () => {
        window.openCameraUI((file) => {
            const dt = new DataTransfer();
            dt.items.add(file);
            const inp = document.getElementById('inpBuktiFoto');
            if (inp) {
                inp.files = dt.files;
                inp.dispatchEvent(new Event('change'));
            }
        });
    });

    document.getElementById('btnSimpanBukti')?.addEventListener('click', async () => {
        const modal = document.getElementById('modalLaporTuntas');
        const img = document.getElementById('previewBukti');
        const btn = document.getElementById('btnSimpanBukti');
        
        if (!img.src || img.src.length < 100) return showAlert('Ambil foto bukti dulu!', 'warning');

        try {
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner"></span> Mengunggah...';
            showToast('Mengunggah bukti ke Cloud...', 'info');

            const url = await uploadToGDrive(img.src, 'DISTRIBUSI_FOTO');
            if(!url) throw new Error("Gagal mengunggah foto.");

            const { trips } = await loadData();
            const tIdx = trips.findIndex(t => t.id === modal._tripId);
            const iIdx = trips[tIdx].items.findIndex(i => i.goatId === modal._goatId);

            trips[tIdx].items[iIdx].status = 'Terdistribusi';
            trips[tIdx].items[iIdx].buktiUrl = url;
            trips[tIdx].items[iIdx].tglDistribusi = new Date().toISOString();
            
            if(trips[tIdx].items.every(xi => xi.status === 'Terdistribusi')) {
                trips[tIdx].status = 'Selesai';
            }
            
            await saveTrips(trips);

            await supabase.from('stok_kambing').update({ 
                status_transaksi: 'Terdistribusi', 
                status_fisik: 'Terdistribusi',
                updated_at: new Date().toISOString()
            }).eq('id', modal._goatId);

            // Kirim Notifikasi WA Terdistribusi
            try {
                const config = await window.getWaConfig();
                const { data: trx } = await supabase.from('transaksi').select('*, customer').contains('items', [{ goatId: modal._goatId }]).single();
                if (trx && trx.customer?.wa1) {
                    // Fetch Official Accounts
                    const { data: mdRek } = await supabase.from('master_data').select('val').eq('key', 'REKENING').single();
                    const reks = mdRek?.val || [];
                    const rekStr = reks.map(r => `${r.bank} — ${r.norek} (a.n ${r.an})`).join('\n');

                    const commonData = {
                        nama: trx.customer.nama,
                        id: trx.id,
                        tgl: new Date().toLocaleDateString('id-ID'),
                        items: trips[tIdx].items[iIdx].noTali,
                        sisa: formatRp((trx.total_deal || 0) - (trx.total_paid || 0)),
                        nama_agen: trips[tIdx].sopirNama,
                        rekening: rekStr || '-'
                    };
                    const msg = await window.parseWaTemplate(config.templateDistribusiTerkirim, commonData);
                    const res = await window.sendWa(trx.customer.wa1, msg);
                    if (!res.success) {
                        window.showToast('WA Distribusi gagal dikirim otomatis (Gateway error).', 'warning');
                    }
                }
            } catch (waErr) {
                console.warn('Opsi notifikasi WA gagal:', waErr);
            }
            
            modal.classList.remove('active');
            showToast('✅ Distribusi tuntas!', 'success');
            await loadData(true);
            renderTrips();

        } catch (err) {
            showAlert('Gagal: ' + err.message, 'danger');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Simpan & Lapor Tuntas';
        }
    });

    document.getElementById('btnBuatTrip')?.addEventListener('click', () => openTripModal(false));
    document.getElementById('btnSembelih')?.addEventListener('click', () => openTripModal(true));

    async function openTripModal(isSembelih = false) {
        const modal = document.getElementById('modalTrip');
        modal.dataset.mode = isSembelih ? 'sembelih' : 'kirim';
        
        // Update Modal Title & Button
        const title = modal.querySelector('.modal-title');
        const submitBtn = document.getElementById('btnSimpanTrip');
        if (isSembelih) {
            title.textContent = 'Proses Sembelih di Kandang';
            submitBtn.textContent = '🔪 Konfirmasi Sembelih & Tuntas';
            submitBtn.style.background = '#6366f1';
            document.getElementById('inpTripSopir').value = 'Admin Kandang (Sembelih)';
            document.getElementById('inpTripNopol').value = '-';
            document.getElementById('inpTripNote').value = 'Sembelih di Kandang atas permintaan customer.';
        } else {
            title.textContent = 'Buat Trip Distribusi Baru';
            submitBtn.textContent = 'Simpan & Aktifkan Trip';
            submitBtn.style.background = ''; // default primary
            document.getElementById('inpTripSopir').value = '';
            document.getElementById('inpTripNopol').value = '';
            document.getElementById('inpTripNote').value = '';
        }

        const containerInternal = document.getElementById('containerInternalPrice');
        if (containerInternal) containerInternal.style.display = isSembelih ? 'block' : 'none';
        const inpInternal = document.getElementById('inpInternalPrice');
        if (inpInternal) inpInternal.value = '';

        const { goats, trxs } = await loadData();
        const { data: sops } = await supabase.from('master_data').select('val').eq('key', 'SOPIR').single();
        
        const sopirsList = document.getElementById('listSopir');
        sopirsList.innerHTML = '';
        (sops?.val || []).forEach(s => { const o = document.createElement('option'); o.value = s.nama; sopirsList.appendChild(o); });

        const eligible = goats.filter(k => k.status_transaksi === 'Terjual');

        // Populate Filters
        const kabs = [...new Set(eligible.map(k => trxs.find(t => t.id === k.transaction_id)?.delivery?.alamat?.kab || ''))].filter(Boolean).sort();
        const agens = [...new Set(eligible.map(k => {
            const trx = trxs.find(t => t.id === k.transaction_id);
            return (typeof trx?.agen === 'object' ? trx?.agen?.nama : trx?.agen) || trx?.agen_nama || '';
        }))].filter(Boolean).sort();

        const selKab = document.getElementById('inpFilterKab');
        const selAgen = document.getElementById('inpFilterAgen');
        if (selKab) {
            selKab.innerHTML = '<option value="">-- Semua Kabupaten --</option>';
            kabs.forEach(k => selKab.innerHTML += `<option value="${k}">${k}</option>`);
        }
        if (selAgen) {
            selAgen.innerHTML = '<option value="">-- Semua Agen --</option>';
            agens.forEach(a => selAgen.innerHTML += `<option value="${a}">${a}</option>`);
        }

        tableBodySelection.innerHTML = '';
        
        if(eligible.length === 0) {
            tableBodySelection.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:2rem; color:var(--text-muted);">Tidak ada kambing terjual yang menunggu kirim.</td></tr>';
        }

        const renderTable = () => {
            const search = document.getElementById('inpSearchGoat')?.value.toLowerCase() || '';
            const fKab = selKab?.value || '';
            const fAgen = selAgen?.value || '';

            tableBodySelection.innerHTML = '';
            
            const filtered = eligible.filter(k => {
                const trx = trxs.find(t => t.id === k.transaction_id);
                const txt = (k.no_tali + ' ' + (trx?.customer?.nama || '') + ' ' + (trx?.delivery?.alamat?.kab || '')).toLowerCase();
                const matchSearch = txt.includes(search);
                const matchKab = !fKab || trx?.delivery?.alamat?.kab === fKab;
                const currentAgen = (typeof trx?.agen === 'object' ? trx?.agen?.nama : trx?.agen) || trx?.agen_nama || '';
                const matchAgen = !fAgen || currentAgen === fAgen;
                return matchSearch && matchKab && matchAgen;
            });

            filtered.forEach((k, idx) => {
                const trx = trxs.find(t => t.id === k.transaction_id);
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><input type="checkbox" class="goat-checkbox" data-id="${k.id}" data-notali="${k.no_tali}" data-konsumen="${trx?.customer?.nama}" data-alamat="${trx?.delivery?.alamat?.alamat || '-'}"></td>
                    <td>${idx + 1}</td>
                    <td class="sticky-col">
                        <div style="font-weight:700; color:var(--primary);">${k.no_tali}</div>
                        <div style="font-size:0.75rem; color:var(--text-muted);">${k.warna_tali || '-'}</div>
                    </td>
                    <td>${trx?.customer?.nama || '-'}</td>
                    <td>${trx?.delivery?.alamat?.kab || '-'}</td>
                    <td>${trx?.delivery?.alamat?.kec || trx?.delivery?.alamat?.desa || '-'}</td>
                    <td style="color:var(--danger); font-weight:600;">${window.formatRp((trx?.total_deal || 0) - (trx?.total_paid || 0))}</td>
                    <td>${formatTgl(trx?.delivery?.tanggal)}</td>
                `;
                tableBodySelection.appendChild(tr);
            });

            // Update Count
            document.querySelectorAll('.goat-checkbox').forEach(cb => {
                cb.addEventListener('change', () => {
                    const count = document.querySelectorAll('.goat-checkbox:checked').length;
                    const elCount = document.getElementById('summarizedTripCount');
                    if(elCount) elCount.textContent = `${count} Ekor Kambing`;
                });
            });
        };

        renderTable();
        document.getElementById('inpSearchGoat')?.addEventListener('input', renderTable);
        selKab?.addEventListener('change', renderTable);
        selAgen?.addEventListener('change', renderTable);

        document.getElementById('checkAllGoats')?.addEventListener('change', (e) => {
            const checked = e.target.checked;
            document.querySelectorAll('.goat-checkbox').forEach(cb => {
                cb.checked = checked;
                cb.dispatchEvent(new Event('change'));
            });
        });
        
        modalTrip.classList.add('active');
        document.getElementById('inpTripTgl').value = new Date().toISOString().split('T')[0];
        document.getElementById('summarizedTripCount').textContent = '0 Ekor Kambing';
    }

    document.getElementById('formTrip')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const selected = document.querySelectorAll('.goat-checkbox:checked');
        if(!selected.length) return showAlert('Pilih minimal 1 kambing!', 'warning');

        const isSembelih = document.getElementById('modalTrip').dataset.mode === 'sembelih';
        const { trips } = await loadData();
        const tripId = (isSembelih ? 'SMB-' : 'TRP-') + Date.now().toString().slice(-6);
        
        const newTrip = {
            id: tripId,
            sopirNama: document.getElementById('inpTripSopir').value,
            nopol: document.getElementById('inpTripNopol').value,
            tglKirim: document.getElementById('inpTripTgl').value,
            status: isSembelih ? 'Selesai' : 'Pengiriman',
            note: document.getElementById('inpTripNote').value,
            items: Array.from(selected).map(cb => ({
                goatId: cb.dataset.id, 
                noTali: cb.dataset.notali, 
                konsumen: cb.dataset.konsumen, 
                alamat: cb.dataset.alamat, 
                status: isSembelih ? 'Terdistribusi' : 'Pengiriman',
                tglDistribusi: isSembelih ? new Date().toISOString() : null,
                buktiUrl: isSembelih ? 'SEM_KANDANG' : null
            }))
        };
        
        try {
            trips.push(newTrip);
            showToast('Menyimpan data...', 'info');
            await saveTrips(trips);

            if (isSembelih) {
                console.log('Slaughtering goats:', selected.length);
                const internalPriceVal = window.parseNum(document.getElementById('inpInternalPrice')?.value || 0);
                
                const updates = [];
                const financeEntries = [];

                for (const item of newTrip.items) {
                    // 1. Update Goat Status
                    updates.push(supabase.from('stok_kambing').update({
                        status_transaksi: 'Terdistribusi',
                        status_fisik: 'Disembelih',
                        updated_at: new Date().toISOString()
                    }).eq('id', item.goatId));

                    // 2. Handle Internal Price Adjustment (Hidden Ledger Entry)
                    if (internalPriceVal > 0) {
                        const trx = cachedTransactions.find(t => t.id === cachedGoats.find(g => g.id === item.goatId)?.transaction_id);
                        if (trx) {
                            // Find item in trx to get deal price
                            const trxItem = (trx.items || []).find(it => it.goatId === item.goatId);
                            const dealPrice = window.parseNum(trxItem?.hargaDeal || trxItem?.harga || 0);
                            
                            const diff = dealPrice - internalPriceVal;
                            if (diff > 0) {
                                financeEntries.push({
                                    id: 'ADJ-' + Date.now().toString().slice(-6) + '-' + item.noTali,
                                    tipe: 'pengeluaran',
                                    tanggal: newTrip.tglKirim,
                                    kategori: 'Internal Transfer / Aqiqah',
                                    nominal: diff,
                                    keterangan: `Penyesuaian Harga Internal Aqiqah - No Tali ${item.noTali} (Trx ${trx.id})`,
                                    channel: 'Non-Kas (Pencatatan)',
                                    related_trx_id: trx.id,
                                    related_goat_id: item.goatId
                                });
                            }
                        }
                    }
                }
                
                if (financeEntries.length > 0) {
                    console.log('Recording internal adjustments:', financeEntries.length);
                    await supabase.from('keuangan').insert(financeEntries);
                }

                const results = await Promise.all(updates);
                const errors = results.filter(r => r.error);
                if (errors.length > 0) {
                    console.error('Update goats error:', errors);
                    throw new Error('Sebagian data kambing gagal diperbarui.');
                }
            }

            modalTrip.classList.remove('active');
            showToast(isSembelih ? `✅ ${selected.length} Kambing disembelih & tuntas!` : `Trip ${newTrip.id} diaktifkan!`, 'success');
            
            if (isSembelih) {
                currentTab = 'histori';
                btnAktif.classList.remove('active');
                btnHistori.classList.add('active');
            }
            
            await loadData(true);
            renderTrips();
        } catch (err) {
            console.error('Process error:', err);
            showAlert('Gagal: ' + err.message, 'danger');
        }
    });

    window.printTrip = async (id) => {
        const { trips } = await loadData();
        const t = trips.find(x => x.id === id);
        if(!t) return;

        const printArea = document.getElementById('printArea');
        printArea.innerHTML = `
            <div class="sj-header">
                <h2>DAARUL MAHABBAH QURBAN</h2>
                <div class="sj-title">SURAT JALAN / TRIP PENGIRIMAN</div>
            </div>
            <div class="sj-body">
                <div>
                    <strong>ID TRIP:</strong> ${t.id}<br>
                    <strong>SOPIR:</strong> ${t.sopirNama}<br>
                    <strong>NOPOL:</strong> ${t.nopol}<br>
                    <strong>TGL KIRIM:</strong> ${formatTgl(t.tglKirim)}
                </div>
                <div style="text-align:right;">
                    <strong>CATATAN:</strong><br>
                    ${t.note || '-'}
                </div>
            </div>
            <table class="sj-table">
                <thead>
                    <tr>
                        <th>NO</th>
                        <th>NO TALI</th>
                        <th>KONSUMEN</th>
                        <th>ALAMAT TUJUAN</th>
                        <th>STATUS</th>
                    </tr>
                </thead>
                <tbody>
                    ${t.items.map((i, idx) => `
                        <tr>
                            <td>${idx + 1}</td>
                            <td>${i.noTali}</td>
                            <td>${i.konsumen}</td>
                            <td>${i.alamat}</td>
                            <td>${i.status || 'Pengiriman'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            <div class="sj-footer">
                <div>
                    <div class="signature-box"></div>
                    Admin Kandang
                </div>
                <div>
                    <div class="signature-box"></div>
                    Sopir / Pengirim
                </div>
                <div>
                    <div class="signature-box"></div>
                    Penerima / Konsumen
                </div>
            </div>
        `;
        window.print();
    };

    const btnAktif = document.getElementById('tabAktif');
    const btnHistori = document.getElementById('tabHistori');

    const switchTab = (tab) => {
        currentTab = tab;
        btnAktif.classList.toggle('active', tab === 'aktif');
        btnHistori.classList.toggle('active', tab === 'histori');
        renderTrips();
    };

    btnAktif?.addEventListener('click', () => switchTab('aktif'));
    btnHistori?.addEventListener('click', () => switchTab('histori'));

    window.setupMoneyMask('inpInternalPrice');
    renderTrips();
});

