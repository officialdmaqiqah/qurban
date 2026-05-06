import { supabase } from './supabase.js';

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Check Session & Profile
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return; // layout.js handles redirect

    const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
    if (!profile) return;

    const email = profile.email;
    if (email) document.getElementById('userEmailDisplay').textContent = email;

    const userRole = (profile.role || 'staff').toLowerCase().trim();
    const userEmail = (profile.email || '').toLowerCase();
    const userName = (profile.full_name || '').toLowerCase();
    const userId = profile.id;
    const isYahya = ['15a3372c-87ae-4f0b-8d3b-fc11ccc2b0e1', '7cba5bb4-6a49-4cf9-8006-1a3e88c51ece'].includes(userId);
    const isAdmin = ['admin', 'office', 'staf', 'operator'].includes(userRole) || isYahya;
    const isAgen = userRole === 'agen' && !isYahya;

    window.isRestricted = function(perm) {
        if (isAdmin) return false;
        
        const isMarketing = ['marketing_dm', 'marketing_ext', 'marketing_kandang'].includes(userRole);
        const isResellerSelf = userRole === 'reseller';

        if (isAgen || isMarketing || isResellerSelf) {
            if (perm === 'hideSupplierInfo') return true;
            if (perm === 'hideHargaNota') return true;
            if (perm === 'hideProfit') return true;
            if (perm === 'hideHargaKandang') return true;
            if (perm === 'noExportMaster') return true;
            if (perm === 'readonlyMaster') return true; // Melarang edit/hapus master
            if (perm === 'hideWeight') {
                const roleNorm = userRole.replace(/_/g, ' ');
                const jenisNorm = (profile.permissions?.jenis_agen || '').toLowerCase().trim().replace(/_/g, ' ');

                // Hide for specific roles
                if (roleNorm === 'marketing dm' || roleNorm === 'reseller') return true;
                
                // Hide for 'agen' role with specific types
                if (roleNorm === 'agen') {
                   return jenisNorm === 'marketing dm' || jenisNorm === 'reseller';
                }
            }
        }
        return false;
    };
    const isRestricted = window.isRestricted;

    document.getElementById('logoutBtn')?.addEventListener('click', async () => {
        await supabase.auth.signOut();
        window.location.href = 'login.html';
    });

    const getDb = async () => {
        const { data, error } = await supabase
            .from('stok_kambing')
            .select('*');
        return data || [];
    };
    
    const getSuppliers = async () => {
        const { data } = await supabase.from('master_data').select('val').eq('key', 'SUPPLIERS').single();
        return data?.val || [];
    };

    const getLokasi = async () => {
        const { data } = await supabase.from('master_data').select('val').eq('key', 'LOKASI').single();
        return data?.val || [];
    };
    
    
    const tableBody = document.getElementById('tableBodyKambing');
    const modalKambing = document.getElementById('modalKambing');
    const formKambing = document.getElementById('formKambing');
    const inpLokasi = document.getElementById('inpLokasi');

    let currentSort = { column: 'no_tali', direction: 'asc' };


    const formatTgl = (iso) => {
        if(!iso) return '-';
        const p = iso.split('-');
        if(p.length >= 3) return `${p[2]}/${p[1]}/${p[0]}`;
        return iso;
    };


    function getStatusBadge(type, status) {
        if (!status) return '-';
        let color = '#ccc';
        let bg = 'rgba(255,255,255,0.05)';
        let text = status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();

        if (type === 'transaksi') {
            if (status === 'Tersedia') { color = 'var(--success)'; bg = 'rgba(34, 197, 94, 0.1)'; }
            else { color = '#3b82f6'; bg = 'rgba(59, 130, 246, 0.1)'; }
        } else if (type === 'kesehatan') {
            if (status === 'Sehat') { color = 'var(--success)'; bg = 'rgba(34, 197, 94, 0.1)'; }
            else if (status === 'Sakit') { color = '#f59e0b'; bg = 'rgba(245, 158, 11, 0.1)'; }
            else { color = '#ef4444'; bg = 'rgba(239, 68, 68, 0.1)'; }
        } else if (type === 'fisik') {
            if (status === 'Ada') { color = 'var(--success)'; bg = 'rgba(34, 197, 94, 0.1)'; }
            else if (status === 'Terdistribusi') { color = '#9333ea'; bg = 'rgba(147, 51, 234, 0.1)'; }
            else if (status === 'Mati') { color = '#ef4444'; bg = 'rgba(239, 68, 68, 0.1)'; }
            else { color = '#64748b'; bg = 'rgba(100, 116, 139, 0.1)'; }
        }
        return `<span class="badge" style="background:${bg}; color:${color}; border: 1px solid ${color}">${text}</span>`;
    }

    function getSexBadge(sex) {
        if (!sex) return '-';
        const isMale = sex.toLowerCase() === 'jantan';
        const color = isMale ? '#3b82f6' : '#ec4899';
        const bg = isMale ? 'rgba(59, 130, 246, 0.1)' : 'rgba(236, 72, 153, 0.1)';
        const icon = isMale ? '♂' : '♀';
        return `<span class="badge" style="background:${bg}; color:${color}; border: 1px solid ${color}; font-weight:700;">${icon} ${sex}</span>`;
    }

    const inpSearch = document.getElementById('inpSearch');
    const selStatusTransaksi = document.getElementById('selStatusTransaksi');
    const selStatusKesehatan = document.getElementById('selStatusKesehatan');
    const selStatusFisik = document.getElementById('selStatusFisik');
    const selSex = document.getElementById('selSex');
    const inpMinHarga = document.getElementById('inpMinHarga');
    const inpMaxHarga = document.getElementById('inpMaxHarga');

    async function renderTable() {
        let kambingData = await getDb();
        const { data: allTrxs } = await supabase.from('transaksi').select('*');
        const { data: activeEditReqs } = await supabase.from('edit_requests').select('*').eq('status', 'pending');

        tableBody.innerHTML = '';
        
        let filtered = [...kambingData];
        const search = (inpSearch.value || '').toLowerCase();
        const minHarga = window.parseNum(inpMinHarga.value);
        const maxHarga = window.parseNum(inpMaxHarga.value) || Infinity;
        
        const fTrans = selStatusTransaksi.value;
        const fKes = selStatusKesehatan.value;
        const fFis = selStatusFisik.value;
        const fSex = selSex?.value;

        if(search) {
            const isShortNumber = /^\d+$/.test(search) && search.length <= 3;
            filtered = filtered.filter(k => {
                const s = search.toLowerCase();
                const matchNoTali = String(k.no_tali || '').toLowerCase().includes(s);
                const matchBatch = (k.batch || '').toLowerCase().includes(s);
                
                if (isShortNumber) {
                    return matchNoTali;
                }

                const matchWarna = (k.warna_tali || '').toLowerCase().includes(s);
                const matchSupplier = (k.supplier || '').toLowerCase().includes(s);
                const matchLokasi = (k.lokasi || '').toLowerCase().includes(s);
                const matchSex = (k.sex || '').toLowerCase().includes(s);
                return matchNoTali || matchWarna || matchSupplier || matchLokasi || matchSex || matchBatch;
            });
        }

        if(minHarga > 0) filtered = filtered.filter(k => k.harga_kandang >= minHarga);
        if(maxHarga < Infinity && maxHarga > 0) filtered = filtered.filter(k => k.harga_kandang <= maxHarga);
        
        if(fTrans) filtered = filtered.filter(k => k.status_transaksi === fTrans);
        if(fKes) filtered = filtered.filter(k => k.status_kesehatan === fKes);
        if(fFis) filtered = filtered.filter(k => k.status_fisik === fFis);
        if(fSex) filtered = filtered.filter(k => k.sex === fSex);

        filtered.sort((a, b) => {
            let valA = a[currentSort.column];
            let valB = b[currentSort.column];

            if (['harga_kandang', 'harga_nota', 'saving', 'profit', 'berat', 'no_tali'].includes(currentSort.column)) {
                valA = parseFloat(valA) || 0;
                valB = parseFloat(valB) || 0;
            } else if (currentSort.column === 'tgl_masuk') {
                valA = new Date(valA || 0).getTime();
                valB = new Date(valB || 0).getTime();
            } else {
                valA = (valA || '').toString().toLowerCase();
                valB = (valB || '').toString().toLowerCase();
            }

            if (valA < valB) return currentSort.direction === 'asc' ? -1 : 1;
            if (valA > valB) return currentSort.direction === 'asc' ? 1 : -1;
            return 0;
        });

        // Store for Export
        window.lastFilteredKambingData = filtered;


        const isReseller = (profile.jenis_agen || '').toLowerCase().includes('reseller');

        filtered.forEach(item => {
            const hasPending = (activeEditReqs || []).find(r => r.status === 'pending' && (r.goat_id === item.id || r.trx_id === item.transaction_id));
            const pendingBadge = hasPending 
                ? `<span class="badge" style="background:rgba(245,158,11,0.1); color:#f59e0b; border:1px solid rgba(245,158,11,0.2); font-size:0.6rem; display:block; margin-top:2px; width:max-content; padding:0.1rem 0.3rem !important;">Menunggu Persetujuan</span>` 
                : '';
            const tr = document.createElement('tr');
            let displayBatch = (item.batch || '').replace('BT-', 'BT');

            let statusBayarBadge = `<span style="color:var(--text-muted)">-</span>`;
            if (item.status_transaksi === 'Terjual' || item.status_transaksi === 'Terdistribusi') {
                const trx = (allTrxs || []).find(t => t.id === item.transaction_id);
                if (trx) {
                    const isPaid = (trx.total_paid || 0) >= (trx.total_deal || 0);
                    statusBayarBadge = isPaid 
                        ? `<span class="badge" style="background:rgba(16,185,129,0.1); color:#10b981; border:1px solid rgba(16,185,129,0.2);">Lunas</span>` 
                        : `<span class="badge" style="background:rgba(245,158,11,0.1); color:#f59e0b; border:1px solid rgba(245,158,11,0.2);">Belum Lunas</span>`;
                }
            }

            const isReadonly = isRestricted('readonlyMaster');
            const canEditForce = item.status_transaksi === 'Tersedia' || isAdmin;
            const isRestrictedSupplier = isRestricted('hideSupplierInfo');

            tr.innerHTML = `
                <td style="font-weight:600; display:none;">${displayBatch}</td>
                <td style="white-space:nowrap; display:none;">${formatTgl(item.tgl_masuk)}</td>
                <td class="sticky-col">
                    <div style="font-weight:600;">${item.no_tali}</div>
                    <div style="font-size:0.7rem; color:var(--text-muted); font-weight:400; margin-top:2px;">${item.warna_tali || '-'}</div>
                </td>
                <td>${getSexBadge(item.sex)}</td>
                <td><span class="badge" style="background:rgba(255,255,255,0.1);">${item.lokasi || '-'}</span></td>
                <td style="font-weight:600; color:var(--primary); display: ${isRestricted('hideWeight') ? 'none' : ''}">${item.berat ? item.berat + ' kg' : '-'}</td>
                ${isReseller ? '' : `<td style="font-weight:bold; color:var(--success);">${formatRp(item.harga_kandang)}</td>`}
                <td>${getStatusBadge('transaksi', item.status_transaksi)}${pendingBadge}</td>
                <td>${getStatusBadge('kesehatan', item.status_kesehatan)}</td>
                <td>${getStatusBadge('fisik', item.status_fisik)}</td>
                <td>${statusBayarBadge}</td>
                <td style="text-align:center; vertical-align:middle;">
                    ${(item.foto_thumb || item.foto_fisik || item.foto_nota_url) 
                        ? `<button class="btn btn-sm btn-view-photo" data-url="${window.getDirectDriveLink(item.foto_fisik || item.foto_nota_url)}" data-notali="${item.no_tali}" data-warna="${item.warna_tali || '-'}" title="Klik untuk Perbesar" style="width:32px; height:32px; border-radius:50%; padding:0; overflow:hidden; border:2px solid var(--primary-transparent); background:rgba(255,255,255,0.05);">
                             <img src="${window.getDirectDriveLink(item.foto_thumb || item.foto_fisik || item.foto_nota_url)}" style="width:100%; height:100%; object-fit:cover;">
                           </button>`
                        : `<span style="opacity:0.1; font-size:1rem;" title="Tanpa foto">🚫</span>`
                    }
                </td>
                <td>
                    <div class="action-btns">
                        <button class="btn-edit-action" data-id="${item.id}" title="Edit Data">✏️</button>
                        ${isAdmin ? `<button class="btn-delete-action" data-id="${item.id}" title="Hapus Data">🗑️</button>` : ''}
                    </div>
                </td>
            `;

            const headSupp = document.querySelector('th[data-column="supplier"]');
            if (headSupp) headSupp.style.display = isRestrictedSupplier ? 'none' : '';
            
            const headHarga = document.querySelector('th[data-column="harga_kandang"]');
            if (headHarga) headHarga.style.display = isReseller ? 'none' : '';

            const headBerat = document.querySelector('th[data-column="berat"]');
            if (headBerat) headBerat.style.display = isRestricted('hideWeight') ? 'none' : '';

            tableBody.appendChild(tr);
        });

        if (window.enforceGlobalReadonly) window.enforceGlobalReadonly();

        document.querySelectorAll('.btn-edit-action').forEach(btn => {
            btn.addEventListener('click', (e) => openModal(e.currentTarget.dataset.id || e.target.dataset.id));
        });
        document.querySelectorAll('.btn-delete-action').forEach(btn => {
            btn.addEventListener('click', (e) => handleDelete(e.currentTarget.dataset.id || e.target.dataset.id));
        });

        document.querySelectorAll('.btn-view-photo').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation(); 
                const url = e.currentTarget.getAttribute('data-url');
                const noTali = e.currentTarget.getAttribute('data-notali') || 'foto';
                const modal = document.getElementById('photoLightbox');
                const img = document.getElementById('lightboxImg');
                const loader = document.getElementById('lightboxLoading');
                const btnDownload = document.getElementById('btnDownloadLightbox');
                
                if(modal && img) {
                    img.style.display = 'none'; 
                    if(loader) {
                        loader.style.display = 'block';
                        loader.textContent = 'Memuat Foto...';
                        loader.style.color = 'white';
                    }
                    img.src = url;
                    modal.style.display = 'flex';

                    // Get metadata from button
                    const warnaTali = e.currentTarget.getAttribute('data-warna') || '-';

                    // Setup Download Button
                    if (btnDownload) {
                        btnDownload.onclick = async (ev) => {
                            ev.stopPropagation();
                            try {
                                const originalText = btnDownload.innerHTML;
                                btnDownload.innerHTML = '⏳ Menyiapkan...';
                                btnDownload.style.opacity = '0.7';
                                btnDownload.style.pointerEvents = 'none';
                                
                                const tempImg = new Image();
                                tempImg.crossOrigin = "anonymous"; 
                                tempImg.src = url;
                                await new Promise((res, rej) => { tempImg.onload = res; tempImg.onerror = rej; });

                                const canvas = document.createElement('canvas');
                                const ctx = canvas.getContext('2d');
                                canvas.width = tempImg.naturalWidth;
                                canvas.height = tempImg.naturalHeight;
                                ctx.drawImage(tempImg, 0, 0);

                                // --- DRAW OVERLAY ---
                                const fontSize = Math.round(canvas.width * 0.035); // Responsive font size
                                const barHeight = fontSize * 2.2;
                                ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
                                ctx.fillRect(0, canvas.height - barHeight, canvas.width, barHeight);

                                ctx.fillStyle = 'white';
                                ctx.font = `bold ${fontSize}px Inter, sans-serif`;
                                ctx.textAlign = 'center';
                                ctx.textBaseline = 'middle';
                                ctx.fillText(`No Tali : ${noTali} | Warna : ${warnaTali}`, canvas.width / 2, canvas.height - (barHeight / 2));
                                
                                const a = document.createElement('a');
                                a.href = canvas.toDataURL('image/jpeg', 0.95);
                                a.download = `kambing_${noTali}.jpg`;
                                a.click();
                                
                                if(window.showToast) window.showToast('Foto Berhasil Diunduh!');
                                btnDownload.innerHTML = originalText;
                            } catch (error) {
                                console.error('Download failed:', error);
                                window.open(url, '_blank');
                            } finally {
                                btnDownload.style.opacity = '1';
                                btnDownload.style.pointerEvents = 'auto';
                            }
                        };
                    }

                    img.onerror = () => {
                        if(loader) {
                            loader.innerHTML = `Gagal memuat foto.<br><span style="font-size:0.7rem; color:white; font-style:normal;">Pastikan file di Google Drive sudah diset ke <b>"Anyone with the link can view"</b>.</span>`;
                            loader.style.color = '#ef4444';
                        }
                    };
                }
            });
        });
    }

    const inpFotoFisik = document.getElementById('inpFotoFisik');
    const previewFotoFisik = document.getElementById('previewFotoFisik');

    if(inpFotoFisik) {
        inpFotoFisik.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if(file) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    previewFotoFisik.innerHTML = `<img src="${ev.target.result}" style="width:100%; height:100%; object-fit:cover;">`;
                };
                reader.readAsDataURL(file);
            }
        });
    }
    
    const btnOpenCamera = document.getElementById('btnOpenCamera');
    if(btnOpenCamera) {
        btnOpenCamera.onclick = () => {
            window.openCameraUI((file) => {
                const dt = new DataTransfer();
                dt.items.add(file);
                if(inpFotoFisik) {
                    inpFotoFisik.files = dt.files;
                    inpFotoFisik.dispatchEvent(new Event('change'));
                }
            });
        };
    }

    let isPhotoRemoved = false;
    const btnRemovePhoto = document.getElementById('btnRemovePhoto');
    if(btnRemovePhoto) {
        btnRemovePhoto.addEventListener('click', () => {
            isPhotoRemoved = true;
            if(previewFotoFisik) {
                previewFotoFisik.innerHTML = `<span style="font-size: 0.8rem; color: var(--text-muted);">Hapus...</span>`;
            }
            btnRemovePhoto.style.display = 'none';
        });
    }

    async function openModal(id) {
        const { data: item } = await supabase.from('stok_kambing').select('*').eq('id', id).single();
        if(!item) return;

        isPhotoRemoved = false;
        if(btnRemovePhoto) btnRemovePhoto.style.display = 'none';
        
        if(inpFotoFisik) inpFotoFisik.value = '';
        if(previewFotoFisik) {
            const previewUrl = item.foto_thumb || item.foto_fisik;
            if(previewUrl) {
                previewFotoFisik.innerHTML = `
                    <div style="position:relative; width:100%; height:100%;">
                        <img src="${previewUrl}" style="width:100%; height:100%; object-fit:cover;">
                        <button type="button" id="btnDownloadFromEdit" style="position:absolute; bottom:2px; right:2px; background:var(--primary); color:white; border:none; border-radius:4px; padding:4px 6px; font-size:0.65rem; cursor:pointer; opacity:0.9;" title="Download Foto">📥 Unduh</button>
                    </div>
                `;
                if(btnRemovePhoto) btnRemovePhoto.style.display = 'inline-block';
                
                document.getElementById('btnDownloadFromEdit').onclick = async (e) => {
                   e.stopPropagation();
                   const btn = e.currentTarget;
                   try {
                       btn.textContent = '⏳';
                       const tImg = new Image(); tImg.crossOrigin = 'anonymous'; tImg.src = previewUrl;
                       await new Promise((res, rej) => { tImg.onload = res; tImg.onerror = rej; });
                       const cv = document.createElement('canvas'); cv.width = tImg.naturalWidth; cv.height = tImg.naturalHeight;
                       cv.getContext('2d').drawImage(tImg, 0, 0);
                       const a = document.createElement('a'); a.href = cv.toDataURL('image/jpeg', 0.9); a.download = `kambing_${item.no_tali}.jpg`; a.click();
                       if(window.showToast) window.showToast('Berhasil Diunduh!');
                   } catch (err) { window.open(previewUrl, '_blank'); }
                   finally { btn.textContent = '📥 Unduh'; }
                };
            } else {
                previewFotoFisik.innerHTML = `<span style="font-size: 0.8rem; color: var(--text-muted);">No Pic</span>`;
            }
        }

        const btnExport = document.getElementById('btnExportCsv');
        if(btnExport) btnExport.style.display = isRestricted('noExportMaster') ? 'none' : 'block';

        const isDistributed = (item.status_transaksi || '').toLowerCase() === 'terdistribusi' || (item.status_fisik || '').toLowerCase() === 'terdistribusi';
        const isSold = (item.status_transaksi || '').toLowerCase() === 'terjual' || isDistributed;

        const modalBody = document.querySelector('#modalKambing .modal-body');
        
        if (isAgen && isSold) {
            const { data: trx } = await supabase.from('transaksi').select('*').eq('id', item.transaction_id).single();
            const itemInTrx = trx ? trx.items.find(it => it.goatId === item.id) : null;
            
            document.getElementById('modalTitle').textContent = `Ajukan Perubahan Data Konsumen (BT-${item.no_tali})`;
            modalBody.innerHTML = `
                <div style="background:rgba(59,130,246,0.1); padding:1rem; border-radius:8px; border:1px solid rgba(59,130,246,0.2); margin-bottom:1.5rem;">
                    <p style="font-size:0.85rem; color:var(--primary); margin:0;">💡 <b>Mode Edit Agen:</b> Anda hanya dapat mengubah data konsumen. Perubahan teknis kambing (No Tali, Harga, dll) sudah terkunci. Permintaan Anda akan dikirim ke Admin untuk disetujui.</p>
                    <div class="form-group">
                        <label class="form-label" for="inpLokasi">Lokasi Kandang (Opsional)</label>
                        <select id="inpLokasi" class="form-control">
                            <option value="">Belum diset</option>
                        </select>
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Nama Konsumen</label>
                    <input type="text" id="reqCustNama" class="form-control" value="${trx?.customer?.nama || ''}">
                </div>
                <div class="form-group" style="margin-top:1rem;">
                    <label class="form-label">Sohibul Qurban</label>
                    <input type="text" id="reqSohibul" class="form-control" value="${itemInTrx?.namaSohibul || ''}">
                </div>
                <div class="form-group" style="margin-top:1rem;">
                    <label class="form-label">WhatsApp Konsumen</label>
                    <input type="text" id="reqCustWa" class="form-control" value="${trx?.customer?.wa1 || ''}">
                </div>
                <div class="form-group" style="margin-top:1rem;">
                    <label class="form-label">Alamat Pengiriman (Ringkasan)</label>
                    <textarea id="reqCustAlamat" class="form-control" rows="3">${trx?.delivery?.alamat?.jalan || ''}, ${trx?.delivery?.alamat?.desa || ''}, Kec. ${trx?.delivery?.alamat?.kec || ''}</textarea>
                </div>
                <input type="hidden" id="isAgentEditRequest" value="true">
                <input type="hidden" id="currentTrxId" value="${trx?.id || ''}">
            `;
            document.getElementById('btnSaveModal').textContent = '🚀 Kirim Permintaan Edit';
            document.getElementById('btnSaveModal').style.display = 'block';
            const btnSaveWA = document.getElementById('btnSaveModalWA');
            if(btnSaveWA) btnSaveWA.style.display = 'none';
        } else {
            document.getElementById('btnSaveModal').textContent = 'Simpan Perubahan';
            document.getElementById('modalTitle').textContent = 'Edit Master Stock';
            document.getElementById('kambingIdOriginal').value = item.id;
            document.getElementById('inpBatch').value = item.batch;
            document.getElementById('inpTgl').value = item.tgl_masuk;
            document.getElementById('inpSupplier').value = item.supplier;
            document.getElementById('inpNoTali').value = item.no_tali;
            document.getElementById('inpWarnaTali').value = item.warna_tali;
            document.getElementById('inpSex').value = item.sex;
            if(inpLokasi) inpLokasi.value = item.lokasi || '';
            const inpB = document.getElementById('inpBerat');
            if(inpB) {
                 inpB.value = item.berat || '';
                 const bGroup = inpB.closest('.form-group');
                 if(bGroup) bGroup.style.display = isRestricted('hideWeight') ? 'none' : 'block';
            }
            document.getElementById('inpHargaNota').value = item.harga_nota;
            document.getElementById('inpSaving').value = item.saving;
            document.getElementById('inpProfit').value = item.profit;
            
            const inpHK = document.getElementById('inpHargaKandang');
            if (inpHK) inpHK.value = item.harga_kandang;

            const hKandangGroup = inpHK?.closest('.form-group');
            if (hKandangGroup) hKandangGroup.style.display = isRestricted('hideHargaKandang') ? 'none' : 'block';

            if((isDistributed || isRestricted('readonlyMaster')) && !isAdmin) {
                document.getElementById('btnSaveModal').style.display = 'none';
                const btnReset = document.getElementById('btnResetDistribusi');
                if(btnReset) {
                    if(isDistributed && isAdmin) {
                        btnReset.style.display = 'block';
                        btnReset.onclick = async () => {
                             showConfirm(`Apakah Anda yakin ingin membatalkan status distribusi BT-${item.no_tali} dan mengembalikannya ke status TERJUAL (Kuning)?`, async () => {
                                 if(window.pushStatusSnapshot) window.pushStatusSnapshot(item);
                                 const { error } = await supabase
                                     .from('stok_kambing')
                                     .update({ status_transaksi: 'Terjual', status_fisik: 'Ada' })
                                     .eq('id', item.id);
                                 if (!error) {
                                     await renderTable();
                                     modalKambing.classList.remove('active');
                                     showToast(`Status BT-${item.no_tali} berhasil dikembalikan ke TERJUAL.`, 'success');
                                 }
                             }, null, 'Reset Status Distribusi', 'Ya, Lanjutkan', 'btn-primary');
                        };
                    } else {
                        btnReset.style.display = 'none';
                    }
                }
            } else {
                document.getElementById('btnSaveModal').style.display = 'block';
                if(document.getElementById('btnResetDistribusi')) document.getElementById('btnResetDistribusi').style.display = 'none';
            }

            const restrictedNota = isRestricted('hideHargaNota');
            const restrictedProfit = isRestricted('hideProfit');
            const restrictedSupp = isRestricted('hideSupplierInfo');

            const suppGroup = document.getElementById('inpSupplier')?.closest('.form-group');
            if(suppGroup) suppGroup.style.display = restrictedSupp ? 'none' : 'block';
            
            const groupRahasia = document.querySelector('#modalKambing .modal-body > div:last-child');
            if (groupRahasia) {
                const fields = groupRahasia.querySelectorAll('.form-group');
                if (fields.length >= 3) {
                    fields[0].style.display = restrictedNota ? 'none' : 'block';
                    fields[1].style.display = restrictedProfit ? 'none' : 'block';
                    fields[2].style.display = restrictedProfit ? 'none' : 'block';
                }
                if (restrictedNota && restrictedProfit) groupRahasia.style.display = 'none';
                else groupRahasia.style.display = 'block';
            }
        }

        modalKambing.classList.add('active');
    }

    // --- LOGIKA SINKRONISASI HARGA KANDANG & PROFIT (PINDAH KE SINI AGAR AKTIF REALTIME) ---
    const inpHN = document.getElementById('inpHargaNota');
    const inpSV = document.getElementById('inpSaving');
    const inpPF = document.getElementById('inpProfit');
    const inpHK = document.getElementById('inpHargaKandang');

    inpHN?.addEventListener('input', syncToKandang);
    inpSV?.addEventListener('input', syncToKandang);
    inpPF?.addEventListener('input', syncToKandang);
    inpHK?.addEventListener('input', syncToProfit);

    // Inisialisasi Masker Uang Otomatis
    window.setupMoneyMask(inpHN);
    window.setupMoneyMask(inpSV);
    window.setupMoneyMask(inpPF);
    window.setupMoneyMask(inpHK);
    window.setupMoneyMask('inpMinHarga');
    window.setupMoneyMask('inpMaxHarga');

    function syncToKandang() {
        const nota = window.parseNum(inpHN.value);
        const saving = window.parseNum(inpSV.value);
        const profit = window.parseNum(inpPF.value);
        if (inpHK) inpHK.value = window.formatNum(nota + saving + profit);
    }

    function syncToProfit() {
        const nota = window.parseNum(inpHN.value);
        const saving = window.parseNum(inpSV.value);
        const kandang = window.parseNum(inpHK.value);
        if (inpPF) inpPF.value = window.formatNum(kandang - nota - saving);
    }

    formKambing.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const id = document.getElementById('kambingIdOriginal').value;
        const isAgentRequest = document.getElementById('isAgentEditRequest')?.value === 'true';

        if (isAgentRequest) {
            const { data: goat } = await supabase.from('stok_kambing').select('*').eq('id', id).single();
            if (!goat) return;

            const trxId = document.getElementById('currentTrxId').value;
            const { data: trx } = await supabase.from('transaksi').select('*').eq('id', trxId).single();
            if (!trx) return showAlert("Data transaksi tidak ditemukan.", "danger");

            const itemInTrx = trx.items.find(it => it.goatId === goat.id);

            const newReq = {
                requester_id: profile.id,
                trx_id: trx.id,
                goat_id: goat.id,
                agen_name: profile.full_name || 'Agen',
                requester_email: email,
                old_data: {
                    customer: { ...trx.customer },
                    sohibul: itemInTrx?.namaSohibul || ''
                },
                new_data: {
                    customer: {
                        nama: document.getElementById('reqCustNama').value,
                        wa1: document.getElementById('reqCustWa').value,
                        alamat: { ...trx.customer.alamat, jalan: document.getElementById('reqCustAlamat').value }
                    },
                    sohibul: document.getElementById('reqSohibul').value
                },
                status: 'pending'
            };


            const { error: reqErr } = await supabase.from('edit_requests').insert(newReq);
            if (reqErr) {
                showAlert('Gagal mengirim permintaan: ' + reqErr.message, 'danger');
                return;
            }
        window.showToast('🚀 Permintaan edit berhasil dikirim ke Admin!', 'success');
        modalKambing.classList.remove('active');
        return;
    }

    const nota = window.parseNum(inpHN.value);
    const saving = window.parseNum(inpSV.value);
    const profit = window.parseNum(inpPF.value);

        const { data: dbItem } = await supabase.from('stok_kambing').select('*').eq('id', id).single();
        if (dbItem) {
            let photoUrl = dbItem.foto_fisik || null;
            let thumbUrl = dbItem.foto_thumb || null;
            if(inpFotoFisik && inpFotoFisik.files.length > 0) {
                const uploadedUrl = await window.processImageUpload(inpFotoFisik.files[0], 'FOTO_MASTER_KAMBING', 'kambing_' + Date.now() + '.jpg');
                if (uploadedUrl) {
                    photoUrl = uploadedUrl;
                    thumbUrl = uploadedUrl;
                } else {
                    // Fail upload, stop save to let user retry
                    return;
                }
            } else if (isPhotoRemoved) {
                photoUrl = null;
                thumbUrl = null;
            }

            const updatedData = {
                batch: document.getElementById('inpBatch').value,
                tgl_masuk: document.getElementById('inpTgl').value,
                no_tali: document.getElementById('inpNoTali').value,
                warna_tali: document.getElementById('inpWarnaTali').value,
                sex: document.getElementById('inpSex').value,
                harga_nota: nota,
                saving: saving,
                profit: profit,
                harga_kandang: nota + saving + profit,
                foto_fisik: photoUrl,
                foto_thumb: thumbUrl,
                lokasi: inpLokasi ? inpLokasi.value : dbItem.lokasi,
                berat: document.getElementById('inpBerat') ? parseFloat(document.getElementById('inpBerat').value) : dbItem.berat
            };
            
            const { error: upErr } = await supabase.from('stok_kambing').update(updatedData).eq('id', id);

            if (!upErr) {
                await renderTable();
                modalKambing.classList.remove('active');
                showToast('Data berhasil diperbarui ke Cloud', 'success');
            } else {
                showAlert('Gagal menyimpan: ' + upErr.message, 'danger');
            }
        }
    });

    async function handleDelete(id) {
        const { data: item } = await supabase.from('stok_kambing').select('*').eq('id', id).single();
        if(item && (item.status_transaksi === 'Terjual' || item.status_transaksi === 'Terdistribusi')) {
             showAlert("Data kambing yang telah TERJUAL atau TERDISTRIBUSI tidak dapat dihapus!", 'danger');
             return;
        }
        
        showConfirm('Apakah Anda yakin ingin menghapus selamanya data kambing ini? Tindakan ini tidak dapat dibatalkan.', async () => {
            const { error } = await supabase.from('stok_kambing').delete().eq('id', id);
            if (!error) {
                await renderTable();
                showToast('Data kambing berhasil dihapus dari Cloud', 'success');
            }
        }, null, 'Hapus Data', 'Ya, Konfirmasi', 'btn-danger');
    }

    const initPage = async () => {
        const suppliers = await getSuppliers();
        const selSupp = document.getElementById('inpSupplier');
        if (selSupp) {
            selSupp.innerHTML = '';
            suppliers.forEach(s => {
                const opt = document.createElement('option');
                opt.value = s.nama; opt.textContent = s.nama;
                selSupp.appendChild(opt);
            });
        }

        const locations = await getLokasi();
        if(inpLokasi) {
            inpLokasi.innerHTML = '<option value="">Belum diset</option>';
            locations.forEach(l => {
                const opt = document.createElement('option');
                opt.value = l.nama; opt.textContent = l.nama;
                inpLokasi.appendChild(opt);
            });
        }

        await renderTable();
    };

    // Initial Load
    initPage();

    [inpSearch, selStatusTransaksi, selStatusKesehatan, selStatusFisik, selSex, inpMinHarga, inpMaxHarga].forEach(el => {
        if(el) el.addEventListener('change', renderTable);
        if(el === inpSearch || el === inpMinHarga || el === inpMaxHarga) el.addEventListener('input', renderTable);
    });

    const updateSortIcons = () => {
        document.querySelectorAll('.sort-header').forEach(h => {
            const baseText = h.textContent.replace(' 🔼', '').replace(' 🔽', '').replace(' ↕️', '');
            if (h.dataset.column === currentSort.column) {
                h.textContent = baseText + (currentSort.direction === 'asc' ? ' 🔼' : ' 🔽');
            } else {
                h.textContent = baseText + ' ↕️';
            }
        });
    };

    document.querySelectorAll('.sort-header').forEach(header => {
        header.addEventListener('click', () => {
            const col = header.dataset.column;
            if (currentSort.column === col) {
                currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
            } else {
                currentSort.column = col;
                currentSort.direction = 'asc';
            }
            updateSortIcons();
            renderTable();
        });
    });

    updateSortIcons();

    const btnCloseModal = document.getElementById('btnCloseModal');
    const btnCancelModal = document.getElementById('btnCancelModal');

    if(btnCloseModal) {
        btnCloseModal.addEventListener('click', () => {
            modalKambing.classList.remove('active');
        });
    }
    if(btnCancelModal) {
        btnCancelModal.addEventListener('click', () => {
            modalKambing.classList.remove('active');
        });
    }

    // Filter Panel Toggle
    const btnToggleFilter = document.getElementById('btnToggleFilter');
    const filterPanel = document.getElementById('filterPanel');
    const filterArrow = document.getElementById('filterArrow');
    if (btnToggleFilter && filterPanel) {
        btnToggleFilter.addEventListener('click', () => {
            const isOpen = filterPanel.style.display !== 'none';
            filterPanel.style.display = isOpen ? 'none' : 'flex';
            if (filterArrow) filterArrow.style.transform = isOpen ? '' : 'rotate(180deg)';
        });
    }

    const btnExport = document.getElementById('btnExportCsv');
    if(btnExport) {
        btnExport.style.display = isRestricted('noExportMaster') ? 'none' : 'block';

        btnExport.addEventListener('click', async () => {
            try {
                // Use the exactly same data that is currently displayed in the table
                let outData = window.lastFilteredKambingData;
                
                // Fallback if not yet rendered or empty
                if (!outData || outData.length === 0) {
                    const db = await getDb();
                    outData = [...db];
                    
                    const search = (inpSearch?.value || '').toLowerCase().trim();
                    const minHarga = window.parseNum(inpMinHarga?.value || 0);
                    const maxHarga = window.parseNum(inpMaxHarga?.value || 0) || Infinity;
                    const fT = selStatusTransaksi?.value;
                    const fK = selStatusKesehatan?.value;
                    const fF = selStatusFisik?.value;

                    if(search) {
                        const isShortNumber = /^\d+$/.test(search) && search.length <= 3;
                        outData = outData.filter(k => {
                            const s = search.toLowerCase();
                            const matchNoTali = (k.no_tali || '').toLowerCase().includes(s);
                            const matchBatch = (k.batch || '').toLowerCase().includes(s);
                            const matchID = (k.id || '').toLowerCase().includes(s);
                            
                            if (isShortNumber) {
                                return matchNoTali || matchBatch || matchID;
                            }

                            const matchWarna = (k.warna_tali || '').toLowerCase().includes(s);
                            const matchSupplier = (k.supplier || '').toLowerCase().includes(s);
                            const matchLokasi = (k.lokasi || '').toLowerCase().includes(s);
                            const matchSex = (k.sex || '').toLowerCase().includes(s);
                            return matchNoTali || matchWarna || matchSupplier || matchLokasi || matchSex || matchID || matchBatch;
                        });
                    }
                    if(minHarga > 0) outData = outData.filter(k => k.harga_kandang >= minHarga);
                    if(maxHarga < Infinity && maxHarga > 0) outData = outData.filter(k => k.harga_kandang <= maxHarga);
                    if(fT) outData = outData.filter(k => k.status_transaksi === fT);
                    if(fK) outData = outData.filter(k => k.status_kesehatan === fK);
                    if(fF) outData = outData.filter(k => k.status_fisik === fF);
                }

                if (!outData || outData.length === 0) {
                    return showAlert("Tidak ada data untuk diekspor dengan filter saat ini.", "warning");
                }

                showToast(`Menyiapkan ekspor ${outData.length} data...`, 'info');

                const { data: trxs, error: trxErr } = await supabase.from('transaksi').select('*');
                if (trxErr) throw new Error("Gagal mengambil data transaksi: " + trxErr.message);

                let exportArray = [];
                outData.forEach(k => {
                    let statBayar = '-';
                    let trxInfo = {
                        'ID Transaksi': '-', 'Tgl Transaksi': '-', 'Agen': '-', 'Tipe Agen': '-',
                        'Nama Konsumen': '-', 'Sohibul Qurban': '-', 'WA Konsumen 1': '-', 'WA Konsumen 2': '-', 
                        'Alamat Pengiriman': '-', 'Tipe Pengiriman': '-', 'Tgl Pengiriman': '-',
                        'Harga Deal (Kambing Ini)': 0, 'Total Dibayar (Per Ekor)': 0,
                        'Sisa Tagihan (Per Ekor)': 0, 'Kelebihan Bayar (Per Ekor)': 0, 'Komisi Agen (Per Ekor)': 0, 'Status Komisi': '-'
                    };
                    let profitNetRow = 0;
                    
                    if (k.status_transaksi === 'Terjual' || k.status_transaksi === 'Terdistribusi') {
                        const t = (trxs || []).find(x => x.id === k.transaction_id);
                        if (t) {
                            statBayar = ((t.total_paid || 0) >= (t.total_deal || 0)) ? 'Lunas' : 'Belum Lunas';
                            const tItems = Array.isArray(t.items) ? t.items : [];
                            const itemIndex = tItems.findIndex(i => i.goatId === k.id);
                            
                            if (itemIndex !== -1) {
                                const itemInTrx = tItems[itemIndex];
                                const ad = t.delivery?.alamat || {};
                                const sisa = (t.total_deal || 0) - (t.total_paid || 0);
                                
                                const hDeal = parseFloat(itemInTrx?.hargaDeal || 0);
                                const hNota = parseFloat(k.harga_nota || 0);
                                const hSaving = parseFloat(k.saving || 0);
                                const komVal = (t.komisi && t.komisi.berhak) ? parseFloat(t.komisi.nominal || 0) : 0;
                                const nItems = tItems.length || 1;
                                const komPerEkor = komVal / nItems;
                                
                                profitNetRow = hDeal - hNota - hSaving - komPerEkor;
                                
                                trxInfo = {
                                    'ID Transaksi': t.id,
                                    'Tgl Transaksi': formatTgl(t.tgl_trx),
                                    'Agen': t.agen?.nama || '-',
                                    'Tipe Agen': t.agen?.tipe || '-',
                                    'Nama Konsumen': t.customer?.nama || '-',
                                    'Sohibul Qurban': itemInTrx?.namaSohibul || '-',
                                    'WA Konsumen 1': t.customer?.wa1 || '-',
                                    'WA Konsumen 2': t.customer?.wa2 || '-',
                                    'Alamat Pengiriman': `${ad.jalan || ''} ${ad.desa || ''}, Kec. ${ad.kec || ''}, Kab. ${ad.kab || ''}`.trim(),
                                    'Tipe Pengiriman': (t.delivery?.tipe || '').replace('_', ' '),
                                    'Tgl Pengiriman': formatTgl(t.delivery?.tgl),
                                    'Harga Deal (Kambing Ini)': hDeal,
                                    'Total Dibayar (Per Ekor)': (parseFloat(t.total_paid || 0)) / nItems,
                                    'Sisa Tagihan (Per Ekor)': (sisa > 0 ? sisa : 0) / nItems,
                                    'Kelebihan Bayar (Per Ekor)': (parseFloat(t.total_overpaid || 0)) / nItems,
                                    'Komisi Agen (Per Ekor)': komPerEkor,
                                    'Status Komisi': t.komisi ? t.komisi.status : '-'
                                };
                            }
                        }
                    }

                    exportArray.push({
                        'Batch': (k.batch || '').replace('BT-','BT'),
                        'ID Sistem': k.id,
                        'Tgl Masuk': formatTgl(k.tgl_masuk),
                        'Supplier': isRestricted('hideSupplierInfo') ? '***' : (k.supplier || '-'),
                        'No Tali': k.no_tali || '-',
                        'Warna Tali': k.warna_tali || '-',
                        'Sex': k.sex || '-',
                        'Lokasi': k.lokasi || '-',
                        ...(isRestricted('hideWeight') ? {} : { 'Berat (kg)': k.berat || '-' }),
                        'Link Foto': k.foto_fisik || '-',
                        ...(isRestricted('hideHargaNota') ? {} : { 'Harga Nota (Rp)': parseFloat(k.harga_nota) || 0 }),
                        ...(isRestricted('hideProfit') ? {} : { 
                            'Nilai Saving (Rp)': parseFloat(k.saving) || 0,
                            'Est Profit (Rp)': parseFloat(k.profit) || 0 
                        }),
                        'Harga Jual Kandang (Rp)': isRestricted('hideHargaKandang') ? 0 : (parseFloat(k.harga_kandang) || 0),
                        'Status Transaksi': k.status_transaksi || '-',
                        'Status Kesehatan': k.status_kesehatan || '-',
                        'Status Fisik': k.status_fisik || '-',
                        'Status Bayar': statBayar,
                        ...(isRestricted('hideProfit') ? {} : { 'Profit Net / Ekor (Rp)': profitNetRow }),
                        'Catatan Histori / Keluar': '-',
                        ...trxInfo
                    });
                });

                if(typeof XLSX !== 'undefined') {
                    const ws = XLSX.utils.json_to_sheet(exportArray);
                    const wb = XLSX.utils.book_new();
                    XLSX.utils.book_append_sheet(wb, ws, "Master Data Stock");
                    XLSX.writeFile(wb, `Master_Data_Export_${new Date().getTime()}.xlsx`);
                    showToast('✅ Berhasil mengunduh data!', 'success');
                } else {
                    throw new Error("Library XLSX tidak ditemukan.");
                }
            } catch (err) {
                console.error("Export Error:", err);
                showAlert("Gagal mengekspor data: " + err.message, "danger");
            }
        });
    }

});
