import { supabase } from './supabase.js';

async function init() {
    console.log('%c >> DISTRIBUSI SYSTEM: v1.1 << ', 'background: #222; color: #bada55; font-weight: bold;');
    
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
        const { data, error } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
        if (error) throw error;
        profile = data;
    } catch (e) {
        console.warn("Profile Fetch Failed (403?), using fallback from localStorage:", e.message);
        // Fallback: Try to reconstruct from what we know
        profile = { 
            full_name: localStorage.getItem('QURBAN_USER_NAME') || 'Yahya',
            role: localStorage.getItem('QURBAN_USER_ROLE') || 'admin',
            id: session.user.id
        };
    }
    
    if (!profile) return;

    const user = profile;
    const isAdmin = user.role === 'admin';
    const isSopir = user.role === 'sopir';
    const email = profile.email;
    if (email) {
        const display = document.getElementById('userEmailDisplay');
        if (display) display.textContent = email;
    }

    // --- ROLE BASED UI FILTERING (PROTECTION) ---
    if (isSopir) {
        document.getElementById('btnBuatTrip')?.remove();
        document.getElementById('btnSembelih')?.remove();
        document.getElementById('btnSyncTrips')?.remove();
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



    const getTrips = async () => { const { data } = await supabase.from('master_data').select('val').eq('key', 'TRIPS').single(); return data?.val || []; };
    const containerTrip = document.getElementById('containerTrip');
    const tableBodySelection = document.getElementById('tableBodySelection');
    
    let cachedTrips = [];
    let cachedGoats = [];
    let cachedTransactions = [];
    let currentTab = 'aktif'; // 'aktif' or 'histori'


    const loadData = async (force = false) => {
        if (!force && cachedTrips.length > 0) return { trips: cachedTrips, goats: cachedGoats, trxs: cachedTransactions };
        
        // Individual fetch to prevent 403 on one from killing all
        const fetchTrips = supabase.from('master_data').select('val').eq('key', 'TRIPS').single();
        const fetchGoats = supabase.from('stok_kambing').select('*');
        const fetchTrxs = supabase.from('transaksi').select('*');
        const fetchAgens = supabase.from('master_data').select('val').eq('key', 'AGENS').single();

        const [rTrips, rGoats, rTrxs, rAgens] = await Promise.allSettled([fetchTrips, fetchGoats, fetchTrxs, fetchAgens]);

        cachedTrips = rTrips.status === 'fulfilled' ? rTrips.value.data?.val || [] : [];
        cachedGoats = rGoats.status === 'fulfilled' ? rGoats.value.data || [] : [];
        cachedTransactions = rTrxs.status === 'fulfilled' ? rTrxs.value.data || [] : [];
        window._cachedAgens = rAgens.status === 'fulfilled' ? rAgens.value.data?.val || [] : [];

        if (rTrxs.status === 'rejected' || (rTrxs.value && rTrxs.value.error)) {
            console.warn('[Data Warn] Gagal ambil Transaksi (RLS Restriction Active)');
        }

        return { trips: cachedTrips, goats: cachedGoats, trxs: cachedTransactions };
    };

    // Auto-Patch for Admin: Menambal data WA/TRX ID yang hilang di Trip lama
    window.patchMissingTripData = async () => {
        const isSopirRole = (window.profile?.role || '').toLowerCase() === 'sopir' || (localStorage.getItem('QURBAN_USER_ROLE') === 'sopir');
        if (isSopirRole) return; 
        
        console.log('[Admin Patch] Memulai pemindaian data Trip...');
        const { trips, trxs } = await loadData(true); // Force refresh
        let changed = false;
        let patchCount = 0;
        
        trips.forEach(t => {
            t.items.forEach(i => {
                const gId = i.goatId || i.id; // Support both old and new keys
                if (!gId) return;

                if (!i.customerWa || !i.transactionId || !i.goatId || !i.agenWa) {
                    const trx = trxs.find(tx => tx.items && tx.items.some(it => (it.goatId || it.id) === gId));
                    if (trx) {
                        i.customerWa = trx.customer?.wa1 || '';
                        i.transactionId = trx.id;
                        i.goatId = gId; // Pastikan key goatId seragam
                        
                        // Temukan nomor WA Agen
                        const matchedAgen = (window._cachedAgens || []).find(a => a.nama === trx.agen?.nama || a.id === trx.agen?.id);
                        i.agenWa = matchedAgen?.wa || '';
                        i.agenNama = trx.agen?.nama || '';
                        
                        changed = true;
                    }
                }
            });
        });

        if (changed) {
            console.log(`[Admin Patch] Menambal ${patchCount} data. Mengupdate ke Cloud...`);
            await saveTrips(trips);
            if (window.showToast) window.showToast(`Berhasil menambal ${patchCount} data WA Trip!`, 'success');
            renderTrips();
        } else {
            console.log('[Admin Patch] Semua data Trip sudah sinkron.');
        }
    };
    setTimeout(window.patchMissingTripData, 3500);

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
        const role = (profile?.role || '').toLowerCase();
        const isSopir = role === 'sopir';
        const isYahya = (profile?.full_name || '').toLowerCase().includes('yahya');
        const showAdminTools = !isSopir || isYahya;

        console.log('[Role Debug] User:', profile?.full_name, '| Role:', profile?.role, '| ShowTools:', showAdminTools);
        
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
                <div class="trip-header" style="border-bottom: 1px solid rgba(255,255,255,0.1); display: flex; justify-content: space-between; align-items: flex-start;">
                    <div style="flex: 1;">
                        <div class="trip-id text-premium">${t.id} ${t.id.startsWith('SMB-') ? '<span class="badge-sembelih">🔪 Sembelih</span>' : ''}</div>
                        <div class="trip-date">${formatTgl(t.tglKirim)}</div>
                        ${showAdminTools ? `<div class="patch-zone" style="margin-top: 6px;"><button class="btn btn-sm" onclick="window.patchMissingTripData()" style="background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2); color:var(--primary); font-size:0.6rem; padding: 4px 12px; border-radius: 6px; font-weight:700;">🩺 Patch WA</button></div>` : ''}
                    </div>
                    <span class="badge ${isDone ? 'badge-success' : 'badge-warning'}" style="padding:4px 10px; font-size:0.75rem; border-radius:30px;">${t.status.toUpperCase()}</span>
                </div>

                <div class="trip-info" style="font-size:0.85rem; line-height:1.6;">
                    <div style="color:var(--text-main); font-weight:600;">🚚 ${t.sopirNama}</div>
                    <div style="color:var(--text-muted); font-size:0.75rem;">📋 ${t.nopol || '-'} • ${t.note || 'Tanpa catatan'}</div>
                </div>
                <div class="trip-items" style="background:rgba(255,255,255,0.01); border:1px solid rgba(255,255,255,0.05); margin-top: 1rem;">
                    ${t.items.map(i => {
                        const isItemDone = i.status === 'Terdistribusi';
                        const currentGoatId = i.goatId || i.id;
                        const g = cachedGoats.find(x => x.id === currentGoatId);
                        const warnaTali = i.warnaTali || g?.warna_tali || '-';
                        return `
                        <div class="trip-item" style="padding:10px 0; border-bottom:1px solid rgba(255,255,255,0.05);">
                            <div style="max-width:70%;">
                                <div style="display:flex; align-items:center; gap:8px;">
                                    <span class="trip-goat-notali" onclick="window.viewGoatPhoto('${currentGoatId}', '${i.noTali}')" style="font-weight:700; color:var(--primary); font-size:0.95rem; letter-spacing:0.02em; cursor:pointer; text-decoration:underline; display:inline-flex; align-items:center; gap:4px;" title="Lihat Foto Fisik Sebelum Pengiriman">
                                        🐐 No. ${i.noTali}
                                    </span>
                                    <span class="badge-tali" style="font-size:0.7rem; padding:2px 8px; border-radius:4px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:var(--text-main);">
                                        🪢 Tali: ${warnaTali}
                                    </span>
                                </div>
                                <div style="font-size:0.8rem; color:var(--text-main); font-weight:500; margin: 2px 0;">${i.konsumen}</div>
                                <div style="font-size:0.7rem; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; opacity:0.8;">📍 ${i.alamat}</div>
                            </div>
                            <div style="text-align:right; display:flex; align-items:center; gap:8px; justify-content:flex-end;">
                                ${isItemDone ? `
                                    <div style="display:flex; align-items:center; gap:6px;">
                                        ${i.buktiUrl ? `
                                            <button class="btn btn-sm" onclick="window.viewPhoto('${i.buktiUrl}')" style="width:30px; height:30px; border-radius:4px; padding:0; overflow:hidden; border:1px solid rgba(255,255,255,0.1); cursor:pointer; display:flex; align-items:center; justify-content:center;" title="Lihat Bukti Pengantaran">
                                                <img src="${window.getDirectDriveLink(i.buktiUrl)}" style="width:100%; height:100%; object-fit:cover;">
                                            </button>
                                        ` : ''}
                                        <span style="color:var(--success); font-size:1.1rem;">✅</span>
                                        <button class="btn btn-sm" onclick="window.rollbackItemDist('${t.id}','${currentGoatId}')" style="color:var(--text-muted); background:transparent; border:none; padding:4px; cursor:pointer; font-size:0.9rem;" title="Reset / Batal Tuntas">↩️</button>
                                    </div>
                                ` : `
                                    ${showAdminTools ? `<button class="btn btn-sm" onclick="window.removeItemFromTrip('${t.id}','${currentGoatId}')" style="color:var(--danger); background:transparent; border:none; padding:4px; opacity:0.6; cursor:pointer; font-size:0.9rem;" title="Keluarkan dari Trip">❌</button>` : ''}
                                    <button class="btn btn-sm btn-shimmer" onclick="window.openLaporDist('${t.id}','${currentGoatId}','${i.konsumen}')" style="background:var(--primary); padding:6px 14px; font-size:0.75rem; border-radius:8px; border:none; box-shadow:0 4px 10px var(--primary-transparent);">📷</button>
                                `}
                            </div>
                        </div>
                    `;}).join('')}
                </div>
                <div class="trip-footer" style="padding-top:0.5rem; justify-content:space-between;">
                     <button class="btn btn-sm" onclick="window.printTrip('${t.id}')" style="background:rgba(255,255,255,0.05); color:var(--text-main); border:1px solid rgba(255,255,255,0.1); border-radius:6px;">🖨️</button>
                     <div style="display:flex; gap:8px;">
                        ${showAdminTools ? `
                            <button class="btn btn-sm" onclick="window.rollbackDistribution('${t.id}')" style="color:var(--danger); background:rgba(239, 68, 68, 0.05); border:1px solid rgba(239, 68, 68, 0.2); border-radius:6px; font-size:0.7rem;" title="Batalkan Semua & Kembalikan ke Antrean">↩️ Batal Trip</button>
                            <button class="btn btn-sm" onclick="window.deleteTrip('${t.id}')" style="color:var(--danger); background:transparent; border:none; opacity:0.6;" title="Hapus Rekaman">🗑️</button>
                        ` : ''}
                     </div>
                </div>

            `;
            containerTrip.appendChild(card);
        });
    }

    const saveTrips = async (trips) => {
        // Manually provide an ID to avoid null constraint if the DB default fails
        const { data, error } = await supabase.from('master_data').upsert({ 
            id: 'trip-record-master', // Static ID for the TRIPS record is fine since key is unique 'TRIPS'
            key: 'TRIPS', 
            val: trips 
        }, { onConflict: 'key' });
        
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

    window.rollbackItemDist = async (tripId, goatId) => {
        showConfirm(`Batalkan status tuntas untuk kambing ini? Foto bukti akan dihapus dan Anda bisa melapor ulang.`, async () => {
            try {
                showToast('Mereset status item...', 'info');
                const { trips } = await loadData();
                const tIdx = trips.findIndex(t => t.id === tripId);
                if (tIdx === -1) return;
                const iIdx = trips[tIdx].items.findIndex(i => i.goatId === goatId);
                if (iIdx === -1) return;

                // 1. Reset Trip Item
                trips[tIdx].items[iIdx].status = 'Pengiriman';
                trips[tIdx].items[iIdx].buktiUrl = null;
                trips[tIdx].items[iIdx].tglDistribusi = null;
                
                // 2. If trip was "Selesai", set it back to "Pengiriman"
                if (trips[tIdx].status === 'Selesai') {
                    trips[tIdx].status = 'Pengiriman';
                }

                // 3. Save Trip
                await saveTrips(trips);

                // 4. Update Goat Status in DB
                await supabase.from('stok_kambing').update({ 
                    status_transaksi: 'Terjual', 
                    status_fisik: 'Ada',
                    updated_at: new Date().toISOString()
                }).eq('id', goatId);

                showToast('✅ Berhasil direset. Silakan lapor ulang.', 'success');
                await loadData(true);
                renderTrips();
            } catch (err) {
                showAlert('Gagal reset: ' + err.message, 'danger');
            }
        });
    };

    window.removeItemFromTrip = async (tripId, goatId) => {
        showConfirm(`Keluarkan kambing ini dari trip? Status akan kembali menjadi 'Menunggu Kirim'.`, async () => {
            try {
                showToast('Mengeluarkan item...', 'info');
                const { trips } = await loadData();
                const tIdx = trips.findIndex(t => t.id === tripId);
                if (tIdx === -1) return;
                
                // Remove item from trip
                trips[tIdx].items = trips[tIdx].items.filter(i => i.goatId !== goatId);
                
                // If trip becomes empty, delete it
                let finalTrips = trips;
                if (trips[tIdx].items.length === 0) {
                    finalTrips = trips.filter(t => t.id !== tripId);
                } else if (trips[tIdx].status === 'Selesai' && trips[tIdx].items.every(i => i.status === 'Terdistribusi')) {
                    // Stay Selesai
                } else if (trips[tIdx].status === 'Selesai') {
                    trips[tIdx].status = 'Pengiriman';
                }

                await saveTrips(finalTrips);

                // Update Goat Status in DB
                await supabase.from('stok_kambing').update({ 
                    status_transaksi: 'Terjual', 
                    status_fisik: 'Ada',
                    updated_at: new Date().toISOString()
                }).eq('id', goatId);

                showToast('✅ Kambing berhasil dikeluarkan dari trip.');
                await loadData(true);
                renderTrips();
            } catch (err) {
                showAlert('Gagal: ' + err.message, 'danger');
            }
        });
    };



    window.viewGoatPhoto = (goatId, noTali) => {
        const g = cachedGoats.find(x => x.id === goatId);
        const url = g?.foto_fisik || g?.foto_nota_url;
        if (!url) {
            return window.showToast(`Foto fisik kambing No. ${noTali} belum diunggah.`, 'warning');
        }
        window.viewPhoto(url);
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
        
        const fileInput = document.getElementById('inpBuktiFoto');
        if (!fileInput.files || fileInput.files.length === 0) return showAlert('Ambil foto bukti dulu!', 'warning');

        try {
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner"></span> Mengunggah...';
            const file = document.getElementById('inpBuktiFoto').files[0];
            const url = await window.processImageUpload(file, 'DISTRIBUSI_FOTO', 'dist_' + Date.now() + '.jpg');
            if(!url) return; // processImageUpload already shows alert on failure

            const { trips, goats } = await loadData();
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

                    console.log('[WA Debug] Memulai proses notifikasi untuk GoatID:', modal._goatId);
                    try {
                
                    const currentTrips = (await loadData()).trips;
                    const trip = currentTrips.find(t => t.id === modal._tripId);
                    const item = trip?.items.find(i => i.goatId === modal._goatId);

                    // 1. Cari Transaction ID dari data kambing (yang sudah di-load di memori)
                    const goatRec = goats.find(g => g.id === modal._goatId);
                    const trxIdFromGoat = item?.transactionId || goatRec?.transaction_id;
                    console.log('[WA Debug] TRX ID dari item/goat record:', trxIdFromGoat);

                    let trx = null;
                    if (trxIdFromGoat) {
                        const { data, error } = await supabase.from('transaksi').select('*').eq('id', trxIdFromGoat).maybeSingle();
                        if (data) trx = data;
                        if (error) console.warn('[WA Debug] Error fetch by ID:', error.message);
                    }

                    // 2. Jika belum ketemu, coba cari via contains (Metode Lama)
                    if (!trx) {
                        console.log('[WA Debug] Mencoba cari via contains...');
                        const { data, error } = await supabase.from('transaksi').select('*').contains('items', [{ goatId: modal._goatId }]).maybeSingle();
                        if (data) trx = data;
                        if (error) console.warn('[WA Debug] Error fetch by contains:', error.message);
                    }

                    // 3. FALLBACK TERAKHIR: Gunakan data yang tertempel di Trip Item (Paling Ampuh untuk Sopir)
                    if (!trx && item?.customerWa) {
                        console.log('[WA Debug] Menggunakan data dari Trip Item (Bypass lookup)...');
                        trx = {
                            id: item.transactionId || '-',
                            customer: { nama: item.konsumen, wa1: item.customerWa },
                            total_deal: 0, 
                            total_paid: 0,
                            is_partial: true 
                        };
                    }

                    if (trx) {
                        console.log('[WA Debug] Transaksi siap digunakan:', trx.id);
                        const config = await window.getWaConfig();
                        const templateKonsumen = config.templateDistribusiTerkirim;
                        const templateAgen = config.templateDistribusiTerkirimAgen || config.templateDistribusiTerkirim;
                        
                        // Fetch Official Accounts
                        const { data: mdRek } = await supabase.from('master_data').select('val').eq('key', 'REKENING').single();
                        const reks = mdRek?.val || [];
                        const rekStr = reks.filter(r => !(r.bank || '').toLowerCase().includes('bsi')).map(r => `${r.bank} — ${r.norek} (a.n ${r.an})`).join('\n');

                        const warnaTali = item?.warnaTali || goatRec?.warna_tali || '-';
                        const noTali = item?.noTali || goatRec?.no_tali || '-';
                        const itemsFormatted = `No. Kambing/Tali: ${noTali} (Tali: ${warnaTali})`;

                        let alamatFormatted = '-';
                        if (trx?.delivery?.alamat) {
                            if (typeof trx.delivery.alamat === 'object') {
                                alamatFormatted = trx.delivery.alamat.alamat || '-';
                            } else {
                                alamatFormatted = trx.delivery.alamat;
                            }
                        }
                        if (alamatFormatted === '-' && item?.alamat) {
                            alamatFormatted = item.alamat;
                        }

                        const commonData = {
                            judul: "*NOTIFIKASI PENGIRIMAN* 🚚",
                            nama: trx.customer?.nama || item?.konsumen || '-',
                            id: trx.id,
                            tgl: new Date().toLocaleDateString('id-ID'),
                            items: itemsFormatted,
                            alamat: alamatFormatted,
                            sisa: trx.is_partial ? '*(Silakan cek nota/kontak agen)*' : formatRp((trx.total_deal || 0) - (trx.total_paid || 0)),
                            nama_agen: trip?.sopirNama || '-',
                            rekening: rekStr || '-',
                            foto: url || '-',
                            bukti: url || '-'
                        };

                        let sentToCust = false;
                        let sentToAgen = false;

                        // 1. Notif ke Konsumen
                        if (trx.customer?.wa1) {
                            const msg = await window.parseWaTemplate(templateKonsumen, commonData);
                            const res = await window.sendWa(trx.customer.wa1, msg);
                            if (res.success) {
                                sentToCust = true;
                                console.log('[WA Debug] Sukses kirim ke Konsumen');
                            } else {
                                console.warn('[WA Debug] Gagal kirim ke Konsumen:', res.msg);
                                if (window.showConfirm) {
                                    window.showConfirm(`WA Konsumen Gagal: ${res.msg}\n\nKirim manual lewat WA Web/App?`, () => {
                                        window.open(res.link, '_blank');
                                    }, null, 'WA Otomatis Gagal', 'Kirim Manual', 'btn-primary');
                                }
                            }
                        } else {
                            console.log('[WA Debug] WA Konsumen kosong, skip.');
                        }

                        // 2. Notif ke Agen
                        const aWa = item?.agenWa || '';
                        const aNama = item?.agenNama || (typeof trx?.agen === 'object' ? trx?.agen?.nama : trx?.agen) || '';

                        if (aWa) {
                            console.log('[WA Debug] Menyiapkan WA Agen (Embed):', aNama, aWa);
                            const msgAgen = await window.parseWaTemplate(templateAgen, { 
                                ...commonData, 
                                judul: "*NOTIFIKASI PENGIRIMAN (AGEN)*",
                                nama_agen: aNama
                            });
                            const resA = await window.sendWa(aWa, msgAgen);
                            if (resA.success) {
                                sentToAgen = true;
                                console.log('[WA Debug] Sukses kirim ke Agen (via Embed)');
                            }
                        } else if (trx?.agen) {
                            console.log('[WA Debug] Mencoba WA Agen via Transaksi...');
                            const { data: mdAgen } = await supabase.from('master_data').select('val').eq('key', 'AGENS').single();
                            const agenList = mdAgen?.val || [];
                            const tAgenNama = (typeof trx.agen === 'object' ? trx.agen.nama : trx.agen);
                            const matchedAgen = agenList.find(a => a.nama === tAgenNama || a.id === trx.agen.id);
                            if (matchedAgen && matchedAgen.wa) {
                                const msgAgen = await window.parseWaTemplate(templateAgen, { 
                                    ...commonData, 
                                    judul: "*NOTIFIKASI PENGIRIMAN (AGEN)*" 
                                });
                                const resA = await window.sendWa(matchedAgen.wa, msgAgen);
                                if (resA.success) {
                                    sentToAgen = true;
                                    console.log('[WA Debug] Sukses kirim ke Agen (via Trx)');
                                }
                            }
                        }

                        if (!sentToCust && !sentToAgen) {
                            window.showToast('Foto tersimpan. WA dilewati (nomor tidak tersedia).', 'info');
                        } else {
                            window.showToast('✅ Laporan Tuntas & WA Terkirim!', 'success');
                        }
                    } else {
                        console.warn('[WA Debug] Transaksi tidak ditemukan untuk GoatID:', modal._goatId);
                        window.showToast('Foto tersimpan. (Data transaksi pelengkap WA tidak ditemukan)', 'info');
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
        const { data: driverAccounts } = await supabase.from('profiles').select('full_name').eq('role', 'sopir');
        
        // Combine master data drivers and registered driver accounts
        const driverNames = new Set();
        (sops?.val || []).forEach(s => { if(s.nama) driverNames.add(s.nama.trim()); });
        (driverAccounts || []).forEach(p => { if(p.full_name) driverNames.add(p.full_name.trim()); });

        const sopirsList = document.getElementById('listSopir');
        if (sopirsList) {
            sopirsList.innerHTML = '';
            Array.from(driverNames).sort().forEach(name => {
                const o = document.createElement('option');
                o.value = name;
                sopirsList.appendChild(o);
            });
        }

        // Populate Channels for Internal Transfer
        const [reNew, reOld, finData] = await Promise.all([
            supabase.from('master_data').select('val').eq('key', 'REKENING').single(),
            supabase.from('master_data').select('val').eq('key', 'BANK_ACCOUNTS').single(),
            supabase.from('keuangan').select('channel')
        ]);
        
        const reks = (reNew?.data?.val && reNew.data.val.length > 0) ? reNew.data : (reOld?.data || null);
        const existingChannels = [...new Set((finData?.data || []).map(f => f.channel).filter(c => c && !c.toLowerCase().includes('non-kas')))];
        
        const chanSelect = document.getElementById('inpInternalChannel');
        if (chanSelect) {
            chanSelect.innerHTML = '<option value="Non-Kas (Pencatatan)">Non-Kas (Hanya Catatan Laba)</option>';
            chanSelect.innerHTML += '<option value="Tunai">Tunai / Cash</option>';
            
            // Add from Master Data
            const bankList = reks?.val || [];
            const added = new Set(['Tunai', 'Non-Kas (Pencatatan)']);
            
            bankList.forEach(r => {
                const opt = document.createElement('option');
                opt.value = r.bank;
                opt.textContent = `Bank ${r.bank} (${r.norek})`;
                chanSelect.appendChild(opt);
                added.add(r.bank);
            });

            // Add from existing transactions if not already in master
            existingChannels.forEach(c => {
                if (!added.has(c)) {
                    const opt = document.createElement('option');
                    opt.value = c;
                    opt.textContent = c;
                    chanSelect.appendChild(opt);
                    added.add(c);
                }
            });
        }

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
                const agenName = (typeof trx?.agen === 'object' ? trx?.agen?.nama : trx?.agen) || trx?.agen_nama || '';
                const matchedAgen = (window._cachedAgens || []).find(a => a.nama === agenName);
                const agenWa = matchedAgen?.wa || '';

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><input type="checkbox" class="goat-checkbox" data-id="${k.id}" data-notali="${k.no_tali}" data-warna="${k.warna_tali || '-'}" data-konsumen="${trx?.customer?.nama}" data-alamat="${trx?.delivery?.alamat?.alamat || '-'}" data-wa="${trx?.customer?.wa1 || ''}" data-trxid="${k.transaction_id || ''}" data-agenwa="${agenWa}" data-agennama="${agenName}"></td>
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
        const { trips, goats, trxs } = await loadData();
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
                warnaTali: cb.dataset.warna || '-',
                konsumen: cb.dataset.konsumen, 
                alamat: cb.dataset.alamat,
                customerWa: cb.dataset.wa,
                transactionId: cb.dataset.trxid,
                agenWa: cb.dataset.agenwa,
                agenNama: cb.dataset.agennama,
                status: isSembelih ? 'Terdistribusi' : 'Pengiriman',
                tglDistribusi: isSembelih ? new Date().toISOString() : null,
                buktiUrl: isSembelih ? 'SEM_KANDANG' : null
            }))
        };
        
        try {
            trips.push(newTrip);
            showToast('Menyimpan data...', 'info');
            await saveTrips(trips);

            // If NOT sembelih, notify driver with complete trip details
            if (!isSembelih) {
                try {
                    const chosenSopirName = newTrip.sopirNama;
                    let sopirWa = '';
                    if (chosenSopirName) {
                        const { data: sops } = await supabase.from('master_data').select('val').eq('key', 'SOPIR').single();
                        const listSopir = sops?.val || [];
                        const sopirObj = listSopir.find(s => s.nama?.trim().toLowerCase() === chosenSopirName.toLowerCase());
                        sopirWa = sopirObj?.wa || '';
                        
                        if (!sopirWa) {
                            const { data: profs } = await supabase.from('profiles').select('*').eq('role', 'sopir');
                            const matchedProf = profs?.find(p => p.full_name?.trim().toLowerCase() === chosenSopirName.toLowerCase());
                            sopirWa = matchedProf?.wa || '';
                        }
                    }

                    if (sopirWa) {
                        console.log('[WA Driver] Sopir found:', chosenSopirName, 'WA:', sopirWa);
                        
                        // Compile detailed information for each item in the trip
                        const tripItemsWithDetails = newTrip.items.map(item => {
                            const goatRec = goats.find(g => g.id === item.goatId);
                            const trxId = item.transactionId || goatRec?.transaction_id;
                            const trx = trxs.find(t => t.id === trxId);
                            
                            const customerName = trx?.customer?.nama || item.konsumen || '-';
                            
                            // Build clear full address
                            let rawAlamat = '-';
                            if (trx?.delivery?.alamat) {
                                if (typeof trx.delivery.alamat === 'object') {
                                    rawAlamat = trx.delivery.alamat.alamat || '-';
                                } else {
                                    rawAlamat = trx.delivery.alamat;
                                }
                            }
                            if (rawAlamat === '-' && item.alamat) {
                                rawAlamat = item.alamat;
                            }
                            if (rawAlamat === '-' && trx?.customer?.alamat) {
                                const ad = trx.customer.alamat;
                                rawAlamat = [ad.jalan, ad.desa, ad.kec, ad.kab].filter(Boolean).join(', ') || '-';
                            }
                            
                            const wa1 = trx?.customer?.wa1 || item.customerWa || '-';
                            const wa2 = trx?.customer?.wa2 || '-';
                            const mapsLink = trx?.customer?.alamat?.maps || trx?.delivery?.alamat?.maps || '-';
                            const fotoKambing = goatRec?.foto_fisik || '-';
                            const noteKeterangan = trx?.notes || '-';
                            
                            return {
                                konsumen: customerName,
                                alamat: rawAlamat,
                                wa1: wa1,
                                wa2: wa2,
                                maps: mapsLink,
                                noTali: item.noTali,
                                warnaTali: item.warnaTali || goatRec?.warna_tali || '-',
                                fotoFisik: fotoKambing,
                                note: noteKeterangan
                            };
                        });

                        // Helper to divide into safe chunk messages
                        const buildWaMessages = (tripId, sopirNama, nopol, tglKirim, items) => {
                            const header = `*DAFTAR DISTRIBUSI KAMBING*\n==========================\n*ID TRIP:* ${tripId}\n*Sopir:* ${sopirNama}\n*Nopol:* ${nopol || '-'}\n*Tgl Kirim:* ${new Date(tglKirim).toLocaleDateString('id-ID')}\n==========================\n\n`;
                            
                            let messages = [];
                            let currentMsg = header;
                            
                            items.forEach((item, index) => {
                                const itemStr = `Nama Konsumen : ${item.konsumen}\n` +
                                                `Alamat antar : ${item.alamat}\n` +
                                                `No WA 1 : ${item.wa1}\n` +
                                                `No WA 2 : ${item.wa2}\n` +
                                                `Google Maps : ${item.maps}\n` +
                                                `No Kambing /Tali : ${item.noTali} (Tali: ${item.warnaTali})\n` +
                                                `Link Foto Kambing : ${item.fotoFisik}\n` +
                                                `Keterangan : ${item.note}\n\n`;
                                                
                                if (currentMsg.length + itemStr.length > 3500) {
                                    messages.push(currentMsg.trim());
                                    currentMsg = `*DAFTAR DISTRIBUSI KAMBING (Sambungan)*\n==========================\n*ID TRIP:* ${tripId}\n==========================\n\n` + itemStr;
                                } else {
                                    currentMsg += itemStr;
                                }
                            });
                            
                            if (currentMsg && currentMsg !== header) {
                                messages.push(currentMsg.trim());
                            }
                            
                            return messages;
                        };

                        const waMsgs = buildWaMessages(newTrip.id, newTrip.sopirNama, newTrip.nopol, newTrip.tglKirim, tripItemsWithDetails);
                        
                        // Send messages sequentially
                        for (let i = 0; i < waMsgs.length; i++) {
                            console.log(`[WA Driver] Sending message ${i+1}/${waMsgs.length} to driver...`);
                            const res = await window.sendWa(sopirWa, waMsgs[i]);
                            if (res.success) {
                                console.log(`[WA Driver] Message ${i+1} sent successfully.`);
                            } else {
                                console.warn(`[WA Driver] Message ${i+1} failed:`, res.msg);
                                if (window.showConfirm) {
                                    window.showConfirm(`Gagal mengirim daftar trip ke Sopir via WA Otomatis: ${res.msg}\n\nKirim manual lewat WA Web/App?`, () => {
                                        window.open(res.link, '_blank');
                                    }, null, 'WA Sopir Gagal', 'Kirim Manual', 'btn-primary');
                                }
                            }
                        }
                    } else {
                        console.warn('[WA Driver] Driver WA not found or empty, skipping driver notification.');
                    }
                } catch (waErr) {
                    console.error('[WA Driver] Error while preparing driver notification:', waErr);
                }
            }

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
                        const trx = cachedTransactions.find(t => t.id === item.transactionId);
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
                                    channel: document.getElementById('inpInternalChannel')?.value || 'Non-Kas (Pencatatan)',
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
                    ${t.items.map((i, idx) => {
                        const currentGoatId = i.goatId || i.id;
                        const g = cachedGoats.find(x => x.id === currentGoatId);
                        const warnaTali = i.warnaTali || g?.warna_tali || '-';
                        return `
                        <tr>
                            <td>${idx + 1}</td>
                            <td>${i.noTali} (${warnaTali})</td>
                            <td>${i.konsumen}</td>
                            <td>${i.alamat}</td>
                            <td>${i.status || 'Pengiriman'}</td>
                        </tr>
                    `;}).join('')}
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

    document.getElementById('btnSyncTrips')?.addEventListener('click', async () => {
        showConfirm('Sinkronkan seluruh data Trip Selesai/Sembelih dengan Master Stock Kambing? Fitur ini akan memaksa kambing di dalam trip menjadi status Terdistribusi/Disembelih.', async () => {
            try {
                showToast('Mensinkronkan...', 'info');
                const { trips } = await loadData();
                let updated = 0;
                const updates = [];
                for(const t of trips) {
                    if (t.status === 'Selesai') {
                        const isSembelih = t.items.some(i => i.buktiUrl === 'SEM_KANDANG');
                        for(const item of t.items) {
                            if (isSembelih || item.status === 'Terdistribusi') {
                                updates.push(supabase.from('stok_kambing').update({
                                    status_transaksi: 'Terdistribusi',
                                    status_fisik: isSembelih ? 'Disembelih' : 'Terdistribusi',
                                    updated_at: new Date().toISOString()
                                }).eq('id', item.goatId));
                                updated++;
                            }
                        }
                    }
                }
                
                if (updates.length > 0) {
                    await Promise.all(updates);
                    showToast(`Berhasil mensinkronkan ${updated} data kambing.`, 'success');
                } else {
                    showToast('Tidak ada data kambing yang perlu disinkronisasi.', 'info');
                }
                
                setTimeout(() => window.location.reload(), 1500);
            } catch (err) {
                showAlert('Gagal sinkron: ' + err.message, 'danger');
            }
        }, null, 'Sync Stok', 'Ya, Sinkron Sekarang', 'btn-warning');
    });

    window.setupMoneyMask('inpInternalPrice');
    renderTrips();
}

init();

