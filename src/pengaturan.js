import { supabase } from './supabase.js';

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Check Session & Profile
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return; // layout.js handles redirect

    const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
    if (!profile) return;

    const user = profile;
    const isAdmin = ['admin', 'office', 'staf', 'operator'].includes((user.role || '').toLowerCase().trim());
    const email = profile.email;
    if (email) {
       const display = document.getElementById('userEmailDisplay');
       if(display) display.textContent = email;
    }

    document.getElementById('logoutBtn')?.addEventListener('click', async () => {
        await supabase.auth.signOut();
        // localStorage.clear(); // <--- JANGAN gunakan clear() karena akan menghapus Kunci Master (Service Role)
        showToast('Keluar...');
        window.location.href = 'login.html';
    });


    // === TABS LOGIC ===
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            const target = btn.dataset.target;
            document.getElementById(target).classList.add('active');
            if(target === 'tabEditRequests') renderEditRequests();
            if(target === 'tabKategori') renderKatFinance();
        });
    });

    window.handleRoleChange = (role) => {
        const sec = document.getElementById('sectionLinkedAgen');
        if(sec) sec.style.display = (role === 'agen') ? 'block' : 'none';
    };

    // === ROLE BASED UI FILTERING ===
    if (!isAdmin) {
        // Sembunyikan tab selain Profil
        tabBtns.forEach(btn => {
            if (btn.dataset.target !== 'tabProfil') {
                btn.style.display = 'none';
            }
        });

        // Sembunyikan bagian Profil Bisnis (Identitas Bisnis)
        const businessProfileSection = document.getElementById('formProfil')?.closest('.card-box');
        if (businessProfileSection) {
            businessProfileSection.style.display = 'none';
        }
        
        // Pastikan tab Profil aktif jika agen masuk
        const profilBtn = document.querySelector('[data-target="tabProfil"]');
        if (profilBtn) profilBtn.click();
    }

    const smartToTitleCase = (str) => {
        if (!str) return '';
        // Proteksi Link: Jika ada URL (http/https), jangan ubah hurufnya
        if (str.toLowerCase().includes('http://') || str.toLowerCase().includes('https://') || str.toLowerCase().includes('://')) {
            return str; 
        }
        return str.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    };

    // Alias agar bisa dipanggil sebagai toTitleCase()
    const toTitleCase = smartToTitleCase;

    // Fungsi otomatis merapikan saat pindah kolom (onblur)
    const setupAutoClean = (id, type) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('blur', () => {
            if (type === 'name' || type === 'address') el.value = smartToTitleCase(el.value.trim());
            if (type === 'wa' && window.cleanWhatsApp) el.value = window.cleanWhatsApp(el.value.trim());
        });
    };

    // Pasang Listeners Otomatis
    setupAutoClean('namaKandangInput', 'name');
    setupAutoClean('alamatKandangInput', 'address');
    setupAutoClean('kontakKandangInput', 'wa');

    // === PROFIL KANDANG LOGIC ===
    const formProfil = document.getElementById('formProfil');
    const namaKandangInput = document.getElementById('namaKandangInput');
    const kontakKandangInput = document.getElementById('kontakKandangInput');
    const alamatKandangInput = document.getElementById('alamatKandangInput');
    const logoInput = document.getElementById('logoInput');
    const logoPreview = document.getElementById('logoPreview');
    const logoUploadBox = document.getElementById('logoUploadBox');
    
    let profileData = { nama: '', kontak: '', alamat: '', logo: '' };
    
    async function loadProfil() {
        const { data, error } = await supabase.from('master_data').select('*').eq('key', 'PROFILE').single();
        if (error && error.code !== 'PGRST116') {
            console.error('Load Profil Error:', error);
        }
        if (data) {
            profileData = data.val;
            profileData.db_id = data.id; // Store original database document ID
            namaKandangInput.value = profileData.nama || '';
            kontakKandangInput.value = profileData.kontak || '';
            alamatKandangInput.value = profileData.alamat || '';
            if (profileData.logo) { 
                logoPreview.src = profileData.logo; 
                logoPreview.style.display = 'block'; 
                const logoText = document.getElementById('logoText');
                if(logoText) logoText.style.display = 'none';
            }
        }
    }
    loadProfil();

    logoInput?.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        showToast('Mengompres Logo...');
        const compressedBase64 = await compressImage(file, 600, 600, 0.8);
        profileData.logo = compressedBase64;
        logoPreview.src = compressedBase64;
        logoPreview.style.display = 'block';
        if(logoText) logoText.style.display = 'none';
    });

    formProfil?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        profileData.nama = namaKandangInput.value.trim();
        profileData.kontak = kontakKandangInput.value.trim();
        profileData.alamat = alamatKandangInput.value.trim();
        
        const payload = { key: 'PROFILE', val: profileData };
        if (profileData.db_id) payload.id = profileData.db_id;
        else payload.id = 'ID-PROFILE';

        const { error } = await supabase.from('master_data').upsert(payload, { onConflict: 'key' });
        
        if (error) {
            console.error('Save Profil Error:', error);
            showAlert('Gagal menyimpan profil: ' + error.message, 'danger');
        } else {
            showAlert('Profil Berhasil Diperbarui ke Cloud!', 'success');
        }
    });

    // === PERSONAL PROFILE LOGIC ===
    const formProfilPersonal = document.getElementById('formProfilPersonal');
    const personalNameInput = document.getElementById('personalNameInput');
    const personalEmailInput = document.getElementById('personalEmailInput');
    const personalPhotoInput = document.getElementById('personalPhotoInput');
    const personalPhotoPreview = document.getElementById('personalPhotoPreview');
    const personalPhotoUploadBox = document.getElementById('personalPhotoUploadBox');
    const personalPhotoText = document.getElementById('personalPhotoText');

    let personalPhotoBase64 = user.photo_url || '';

    async function loadPersonalProfile() {
        personalNameInput.value = user.full_name || '';
        personalEmailInput.value = user.email || '';
        if (user.photo_url) {
            personalPhotoPreview.src = user.photo_url;
            personalPhotoPreview.style.display = 'block';
            if (personalPhotoText) personalPhotoText.style.display = 'none';
        }
    }
    loadPersonalProfile();

    personalPhotoUploadBox?.addEventListener('click', () => personalPhotoInput.click());
    personalPhotoInput?.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        showToast('Mengompres Foto...');
        const compressedBase64 = await compressImage(file, 500, 500, 0.7);
        personalPhotoBase64 = compressedBase64;
        personalPhotoPreview.src = compressedBase64;
        personalPhotoPreview.style.display = 'block';
        if (personalPhotoText) personalPhotoText.style.display = 'none';
    });

    formProfilPersonal?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const newName = personalNameInput.value.trim();
        const { error } = await supabase.from('profiles').update({ 
            full_name: newName, 
            photo_url: personalPhotoBase64 
        }).eq('id', user.id);
        
        if (error) {
            console.error('Save Personal Profile Error:', error);
            showAlert('Gagal menyimpan profil personal: ' + error.message, 'danger');
        } else {
            showAlert('Profil Personal Berhasil Diperbarui!', 'success');
            // Update local object to reflect changes without reload if possible
            user.full_name = newName;
            user.photo_url = personalPhotoBase64;
        }
    });

    setupAutoClean('personalNameInput', 'name');

    // === IMAGE COMPRESSION HELPER ===
    const compressImage = (file, maxWidth = 800, maxHeight = 800, quality = 0.7) => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > maxWidth) {
                            height *= maxWidth / width;
                            width = maxWidth;
                        }
                    } else {
                        if (height > maxHeight) {
                            width *= maxHeight / height;
                            height = maxHeight;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', quality));
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });
    };

    // === CRUD LOGIC MASTER DATA ===
    let modalState = { tipe: '', id: null };
    const modalGeneral = document.getElementById('modalGeneral');
    const modalTitle = document.getElementById('modalTitle');
    const modalBodyGeneral = document.getElementById('modalBodyGeneral');
    const formGeneral = document.getElementById('formGeneral');

    // Peta key untuk konsistensi dengan file-file lain yang membaca master_data
    const keyMap = {
        'supplier': 'SUPPLIERS',
        'agen':     'AGENS',
        'lokasi':   'LOKASI',
        'sopir':    'SOPIR',
        'rekening': 'REKENING',
    };
    const getKey = (tipe) => keyMap[tipe.toLowerCase()] || tipe.toUpperCase();

    const getData = async (tipe) => {
        const key = getKey(tipe);
        const { data, error } = await supabase.from('master_data').select('val').eq('key', key).single();
        
        // JIKA 'REKENING' KOSONG, COBA CEK 'BANK_ACCOUNTS' (FALLBACK)
        if ((!data || !data.val || data.val.length === 0) && key === 'REKENING') {
            console.log('[Migration] Mencoba mengambil dari kunci lama: BANK_ACCOUNTS');
            const { data: oldData } = await supabase.from('master_data').select('val').eq('key', 'BANK_ACCOUNTS').single();
            if (oldData && oldData.val) return oldData.val;
        }

        if (error && error.code !== 'PGRST116') console.error(`Error getData (${key}):`, error);
        return data?.val || [];
    };

    const saveData = async (tipe, dataJson) => {
        const key = getKey(tipe);
        const { error } = await supabase.from('master_data').upsert({ id: 'ID-' + key, key: key, val: dataJson }, { onConflict: 'key' });
        return { error };
    };

    const openModal = async (tipe, id = null) => {
        modalState.tipe = tipe; modalState.id = id;
        modalTitle.textContent = (id ? 'Edit ' : 'Tambah ') + tipe.charAt(0).toUpperCase() + tipe.slice(1);
        let item = null;
        if(id) {
            const list = await getData(tipe);
            item = list.find(x => x.id === id);
        }

        let fields = '';
        if (tipe === 'supplier' || tipe === 'sopir' || tipe === 'agen') {
            fields = `
                <div class="form-group"><label class="form-label">Nama</label><input type="text" id="inpNama" class="form-control" required value="${item?.nama || ''}"></div>
                ${tipe === 'agen' ? `
                <div class="form-group"><label class="form-label">Jenis Agen</label><select id="inpJenis" class="form-control"><option value="Reseller" ${item?.jenis==='Reseller'?'selected':''}>Reseller</option><option value="Walk In" ${item?.jenis==='Walk In'?'selected':''}>Walk In</option><option value="Marketing DM" ${item?.jenis==='Marketing DM'?'selected':''}>Marketing DM</option><option value="Marketing Kandang" ${item?.jenis==='Marketing Kandang'?'selected':''}>Marketing Kandang</option><option value="Marketing Ext" ${item?.jenis==='Marketing Ext'?'selected':''}>Marketing Ext</option></select></div>` : ''}
                <div class="form-group"><label class="form-label">WhatsApp</label><input type="text" id="inpWa" class="form-control" required value="${item?.wa || ''}"></div>
            `;
        } else if (tipe === 'rekening') {
            fields = `
                <div class="form-group"><label class="form-label">Bank</label><input type="text" id="inpBank" class="form-control" required value="${item?.bank || ''}"></div>
                <div class="form-group"><label class="form-label">No Rekening</label><input type="text" id="inpNorek" class="form-control" required value="${item?.norek || ''}"></div>
                <div class="form-group"><label class="form-label">Atas Nama</label><input type="text" id="inpAn" class="form-control" required value="${item?.an || ''}"></div>
            `;
        } else if (tipe === 'lokasi') {
            fields = `
                <div class="form-group"><label class="form-label">Nama Lokasi / Kandang</label><input type="text" id="inpNama" class="form-control" required value="${item?.nama || ''}" placeholder="Cth: Blok A - Atas"></div>
                <div class="form-group"><label class="form-label">Daya Tampung (Ekor)</label><input type="number" id="inpKapasitas" class="form-control" value="${item?.kapasitas || ''}" placeholder="Cth: 50"></div>
            `;
        } else if (tipe === 'user') {
            fields = `
                <div class="form-group"><label class="form-label">Nama Lengkap</label><input type="text" id="inpUserNama" class="form-control" required placeholder="Cth: Ahmad Fulan"></div>
                <div class="form-group"><label class="form-label">Email / Login</label><input type="email" id="inpUserEmail" class="form-control" required placeholder="Cth: staff@qurban.com"></div>
                <div class="form-group"><label class="form-label">Nomor WhatsApp</label><input type="text" id="inpUserWa" class="form-control" required placeholder="Cth: 0812..."></div>
                <div class="form-group"><label class="form-label">Password Sementara</label><input type="password" id="inpUserPass" class="form-control" required placeholder="Minimal 6 karakter"></div>
                <div class="form-group"><label class="form-label">Role</label>
                    <select id="inpUserRole" class="form-control" onchange="window.handleRoleChange(this.value)">
                        <option value="staff">Staff / Admin Kandang</option>
                        <option value="agen">Agen / Marketing</option>
                        <option value="sopir">Sopir / Driver</option>
                    </select>
                </div>
                <div id="sectionLinkedAgen" style="display:none; padding:1rem; background:rgba(255,255,255,0.03); border-radius:8px; margin-bottom:1rem; border:1px solid rgba(255,255,255,0.05);">
                    <p style="font-size:0.75rem; color:var(--primary); margin-bottom:0.5rem;">Otomatis tautkan ke Agen: (Supaya Agen bisa lapor penjualan sendiri)</p>
                    <select id="inpLinkedAgen" class="form-control">
                        <option value="">-- Hubungkan dengan Agen (Opsional) --</option>
                        ${(await getData('agen')).map(a => `<option value="${a.nama}">${a.nama}</option>`).join('')}
                    </select>
                </div>
                <p style="font-size: 0.7rem; color: var(--text-muted); margin-top: 1rem; line-height: 1.4;">
                    ℹ️ <strong>Admin Note:</strong> Akun akan langsung aktif (Approved) di local. User baru perlu login menggunakan Email & Password di atas.
                </p>
            `;
        }
        modalBodyGeneral.innerHTML = fields;

        // Pasang auto-format listener pada field yang baru saja dirender
        const dynWa = document.getElementById('inpWa');
        if (dynWa && window.setupAutoCleanWA) window.setupAutoCleanWA(dynWa);

        const dynNama = document.getElementById('inpNama');
        if (dynNama) dynNama.addEventListener('blur', () => { dynNama.value = toTitleCase(dynNama.value.trim()); });

        const dynUserWa = document.getElementById('inpUserWa');
        if (dynUserWa && window.setupAutoCleanWA) window.setupAutoCleanWA(dynUserWa);

        const dynUserNama = document.getElementById('inpUserNama');
        if (dynUserNama) dynUserNama.addEventListener('blur', () => { dynUserNama.value = toTitleCase(dynUserNama.value.trim()); });

        modalGeneral.classList.add('active');
    };

    function setLoading(isLoading) {
        const btn = document.getElementById('btnSaveModal');
        if (isLoading) {
            btn.disabled = true;
            btn.textContent = 'Memproses...';
        } else {
            btn.disabled = false;
            btn.textContent = 'Simpan Data';
        }
    }

    formGeneral.addEventListener('submit', async (e) => {
        e.preventDefault();
        const { tipe, id } = modalState;
        if (tipe === 'user_akses') return; // Handled by separate listener in editUserAkses
        
        const list = await getData(tipe);
        let newData = { id: id || 'ID-'+Date.now() };

        if (document.getElementById('inpNama')) newData.nama = toTitleCase(document.getElementById('inpNama').value.trim());
        if (document.getElementById('inpWa')) newData.wa = cleanWhatsApp(document.getElementById('inpWa').value);
        if (document.getElementById('inpJenis')) newData.jenis = document.getElementById('inpJenis').value;
        if (document.getElementById('inpBank')) newData.bank = document.getElementById('inpBank').value;
        if (document.getElementById('inpNorek')) newData.norek = document.getElementById('inpNorek').value;
        if (document.getElementById('inpAn')) newData.an = toTitleCase(document.getElementById('inpAn').value);
        if (document.getElementById('inpKapasitas')) newData.kapasitas = document.getElementById('inpKapasitas').value;

        if(id) {
            const idx = list.findIndex(x => x.id === id);
            if(idx !== -1) list[idx] = newData;
        } else {
            if (tipe === 'user') {
                // Special handling for User creation
                setLoading(true);
                const email = document.getElementById('inpUserEmail').value.trim();
                const pass = document.getElementById('inpUserPass').value;
                const nama = document.getElementById('inpUserNama').value.trim();
                const wa = document.getElementById('inpUserWa').value.trim();
                const role = document.getElementById('inpUserRole').value;
                const linkedAgen = document.getElementById('inpLinkedAgen')?.value || '';

                try {
                    const { data: authData, error: authErr } = await supabase.auth.signUp({
                        email, 
                        password: pass,
                        options: {
                            data: { full_name: nama, wa: wa }
                        }
                    });

                    if (authErr) throw authErr;

                    if (authData.user) {
                        // Supabase trigger usually handles profile, but we'll update it to set role & status
                        const { error: profErr } = await supabase
                            .from('profiles')
                            .update({ 
                                full_name: nama, 
                                wa: wa,
                                role: role,
                                status: 'approved', // Auto-approved for admin-added users
                                permissions: linkedAgen ? { linkedAgen: linkedAgen, strictAgen: true } : {}
                            })
                            .eq('id', authData.user.id);
                        
                        if (profErr) throw profErr;
                    }

                    showToast('User Baru Berhasil Ditambahkan!');
                    modalGeneral.classList.remove('active');
                    renderUserTable();
                } catch (err) {
                    console.error(err);
                    showAlert('Gagal menambah user: ' + err.message, 'danger');
                } finally {
                    setLoading(false);
                }
                return; // Exit early
            }
            list.push(newData);
        }
        
        const { error: saveErr } = await saveData(tipe, list);
        if (saveErr) {
            showAlert('Gagal menyimpan data: ' + saveErr.message, 'danger');
        } else {
            modalGeneral.classList.remove('active');
            renderTables();
            showToast('Tersimpan!');
        }
    });

    const renderTables = async () => {
        const types = ['supplier', 'agen', 'rekening', 'sopir', 'lokasi'];
        for(let t of types) {
            const tbody = document.querySelector(`#table${t.charAt(0).toUpperCase() + t.slice(1)} tbody`);
            if(!tbody) continue;
            const items = await getData(t);
            tbody.innerHTML = '';
            items.forEach(it => {
                const tr = document.createElement('tr');
                if (t === 'lokasi') {
                    tr.innerHTML = `<td>${it.nama || '-'}</td><td>${it.kapasitas || '-'} Ekor</td><td><button class="btn btn-sm" onclick="window.editItem('${t}','${it.id}')">✏️</button><button class="btn btn-sm" onclick="window.deleteItem('${t}','${it.id}')">🗑️</button></td>`;
                } else if (t === 'agen') {
                    tr.innerHTML = `
                        <td>${it.nama || '-'}</td>
                        <td><span class="badge ${it.jenis?.includes('EXT') || it.jenis?.includes('DM') ? 'badge-primary' : 'badge-light'}" style="font-size:0.7rem; padding:2px 8px;">${it.jenis || 'Agen'}</span></td>
                        <td>${it.wa || '-'}</td>
                        <td>
                            <button class="btn btn-sm" onclick="window.editItem('${t}','${it.id}')">✏️</button>
                            <button class="btn btn-sm" onclick="window.deleteItem('${t}','${it.id}')">🗑️</button>
                        </td>`;
                } else {
                    tr.innerHTML = `<td>${it.nama || it.bank || '-'}</td><td>${it.wa || it.norek || '-'}</td><td><button class="btn btn-sm" onclick="window.editItem('${t}','${it.id}')">✏️</button><button class="btn btn-sm" onclick="window.deleteItem('${t}','${it.id}')">🗑️</button></td>`;
                }
                tbody.appendChild(tr);
            });
        }
        renderUserTable();
    };

    window.editItem = (tipe, id) => openModal(tipe, id);
    window.deleteItem = (tipe, id) => {
        showConfirm('Hapus data?', async () => {
            const list = await getData(tipe);
            const newList = list.filter(x => x.id !== id);
            await saveData(tipe, newList);
            renderTables();
        });
    };

    const renderUserTable = async () => {
        const tbody = document.querySelector('#tableUser tbody');
        if(!tbody) return;
        const { data: users } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
        tbody.innerHTML = '';
        users.forEach(u => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${u.full_name}</strong><br><small>${u.email}</small></td>
                <td>${u.role}</td>
                <td>${u.status}</td>
                <td style="display:flex; gap:0.4rem; flex-wrap:nowrap;">
                    <button class="btn btn-sm" onclick="window.editUserAkses('${u.id}')" title="Edit Akses">Akses</button>
                    <button class="btn btn-sm" style="background:#4b5563; color:white; border:none;" onclick="window.repairAccountDoctor('${u.email}', '${u.id}')" title="🩺 Perbaiki Akun (Auth Sync)">🩺 Doctor</button>
                    <button class="btn btn-sm" style="background:var(--danger); color:white; border:none;" onclick="window.deleteUser('${u.id}', '${u.full_name}')" title="Hapus User">🗑️</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    };

    window.editUserAkses = async (id) => {
        const { data: u } = await supabase.from('profiles').select('*').eq('id', id).single();
        const agens = (await getData('agen')) || [];

        modalTitle.textContent = 'Edit Hak Akses: ' + u.full_name;
        modalState.tipe = 'user_akses';
        modalState.id = id;
        
        const menusFull = [
            { h: 'dashboard.html', n: 'Dashboard Keuangan' },
            { h: 'kambing.html', n: 'Master Data (Stok)' },
            { h: 'kambing_masuk.html', n: 'Kambing Masuk' },
            { h: 'kambing_terjual.html', n: 'Kambing Terjual' },
            { h: 'kesehatan.html', n: 'Kambing Sakit/Mati' },
            { h: 'stok_opname.html', n: 'Stok Opname' },
            { h: 'distribusi.html', n: 'Distribusi' },
            { h: 'keuangan.html', n: 'Pencatatan Keuangan' },
            { h: 'terima_pelunasan.html', n: 'Terima Pelunasan' },
            { h: 'hutang_supplier.html', n: 'Hutang ke Supplier' },
            { h: 'komisi.html', n: 'Komisi Agen' },
            { h: 'laporan.html', n: 'LAPORAN' },
            { h: 'pengaturan.html', n: 'Pengaturan' }
        ];

        modalBodyGeneral.innerHTML = `
            <div class="form-group"><label class="form-label">Role Akses</label>
                <select id="inpUserRole" class="form-control" onchange="window.handleRoleChange(this.value)">
                    <option value="staff" ${u.role==='staff'?'selected':''}>Staff / Admin Kandang</option>
                    <option value="admin" ${u.role==='admin'?'selected':''}>Admin (Full Akses)</option>
                    <option value="agen" ${u.role==='agen'?'selected':''}>Agen / Marketing</option>
                    <option value="sopir" ${u.role==='sopir'?'selected':''}>Sopir / Driver</option>
                </select>
            </div>
            <div id="sectionLinkedAgen" style="display:${u.role==='agen'?'block':'none'}; padding:1rem; background:rgba(255,255,255,0.03); border-radius:8px; margin-bottom:1rem; border:1px solid rgba(255,255,255,0.05);">
                <p style="font-size:0.75rem; color:var(--primary); margin-bottom:0.5rem;">Tautkan ke Agen: (Supaya bisa lari ke 'Strict Mode')</p>
                <select id="inpLinkedAgen" class="form-control">
                    <option value="">-- Pilih Nama Agen --</option>
                    ${agens.map(a => `<option value="${a.nama}" ${u.permissions?.linkedAgen===a.nama?'selected':''}>${a.nama}</option>`).join('')}
                </select>
            </div>
            <div class="form-group"><label class="form-label">Status Akun</label>
                <select id="inpUserStatus" class="form-control">
                    <option value="pending" ${u.status==='pending'?'selected':''}>Pending (Belum Aktif)</option>
                    <option value="approved" ${u.status==='approved'?'selected':''}>Approved (Aktif)</option>
                    <option value="rejected" ${u.status==='rejected'?'selected':''}>Rejected (Diblokir)</option>
                </select>
            </div>
            <hr><p style="font-weight:bold; margin-bottom:0.75rem;">Ceklis Menu yang Boleh Diakses:</p>
            <div id="menusChecks" style="display:grid; grid-template-columns:1fr 1fr; gap:0.5rem; background:rgba(255,255,255,0.02); padding:1rem; border-radius:10px;">
                ${menusFull.map(m => `<label style="font-size:0.85rem; display:flex; align-items:center; gap:0.5rem; cursor:pointer;"><input type="checkbox" class="inpAuthMenu" value="${m.h}" ${(u.allowed_menus||[]).includes(m.h)?'checked':''}> ${m.n}</label>`).join('')}
            </div>
            <hr>
            <div style="display:flex; flex-direction:column; gap:0.75rem; background:rgba(255,255,255,0.02); padding:1rem; border-radius:10px;">
                <label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer; color:var(--warning);">
                    <input type="checkbox" id="permStrictAgen" ${u.permissions?.strictAgen?'checked':''}> <strong>Strict Data Filter</strong>
                </label>
                <p style="font-size:0.7rem; color:var(--text-muted); margin-top:-0.5rem; margin-left:1.5rem; margin-bottom:0.5rem;">(Hanya boleh melihat/edit data penjualannya sendiri)</p>

                <label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer; color:var(--danger);">
                    <input type="checkbox" id="permHideProfit" ${u.permissions?.hideProfit?'checked':''}> <strong>Sembunyikan Profit</strong>
                </label>
                <p style="font-size:0.7rem; color:var(--text-muted); margin-top:-0.5rem; margin-left:1.5rem; margin-bottom:0.5rem;">(Menyembunyikan angka Laba di Dashboard)</p>

                <label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer; color:#fb923c;">
                    <input type="checkbox" id="permHideHargaNota" ${u.permissions?.hideHargaNota?'checked':''}> <strong>Sembunyikan Harga Beli</strong>
                </label>
                <p style="font-size:0.7rem; color:var(--text-muted); margin-top:-0.5rem; margin-left:1.5rem;">(Menyembunyikan Modal/Harga Nota dari Supplier)</p>
            </div>
        `;
        modalGeneral.classList.add('active');
        
        formGeneral.onsubmit = async (e) => {
            if(modalState.tipe !== 'user_akses') return;
            e.preventDefault();
            const role = document.getElementById('inpUserRole').value;
            const status = document.getElementById('inpUserStatus').value;
            const menus = Array.from(document.querySelectorAll('.inpAuthMenu:checked')).map(c => c.value);
            const strict = document.getElementById('permStrictAgen').checked;
            const hideProfit = document.getElementById('permHideProfit').checked;
            const hideHargaNota = document.getElementById('permHideHargaNota').checked;
            const linked = document.getElementById('inpLinkedAgen')?.value || '';
            
            // Ambil ID Agen dari master data untuk sinkronisasi kolom root
            const { data: agenMaster } = await supabase.from('master_data').select('val').eq('key', 'AGENS').single();
            const agenMatched = (agenMaster?.val || []).find(a => a.nama === linked);
            const matchedId = agenMatched ? agenMatched.id : '';

            const { error } = await supabase.from('profiles').update({ 
                role, 
                status, 
                allowed_menus: menus, 
                linked_agen_nama: linked,
                linked_agen_id: matchedId,
                permissions: { 
                    strictAgen: strict,
                    linkedAgen: linked,
                    linkedAgenId: matchedId,
                    jenis_agen: agenMatched ? agenMatched.jenis : '',
                    hideProfit: hideProfit,
                    hideHargaNota: hideHargaNota
                } 
            }).eq('id', id);

            if(error) {
                showAlert('Gagal Simpan: ' + error.message, 'danger');
            } else {
                modalGeneral.classList.remove('active');
                renderUserTable();
                showToast('Hak Akses Berhasil Diperbarui!');
                
                // NOTIFIKASI WA JIKA APPROVED
                if (status === 'approved') {
                    // Ambil data profil untuk nomor WA
                    const { data: prof } = await supabase.from('profiles').select('full_name, wa, email').eq('id', id).single();
                    if (prof && prof.wa) {
                        const waNum = window.cleanWhatsApp(prof.wa);
                        const config = await window.getWaConfig();
                        const template = config.templateUserApproved;
                        const waMsg = await window.parseWaTemplate(template, {
                            nama: prof.full_name,
                            email: prof.email,
                            role: (role || '').toUpperCase()
                        });
                        await window.sendWa(waNum, waMsg);
                        showToast('Notifikasi WA terkirim ke user!');
                    }
                }
                
                formGeneral.onsubmit = null; 
            }
        };
    };

    async function renderEditRequests() {
        const { data: reqs } = await supabase.from('edit_requests').select('*').eq('status', 'pending');
        const list = document.getElementById('tableEditRequests');
        if(!list) return;
        list.innerHTML = '';
        if(!reqs?.length) {
            document.getElementById('emptyEditRequests').style.display = 'block';
            return;
        }
        document.getElementById('emptyEditRequests').style.display = 'none';

        // Fetch original transactions for comparison
        const trxIds = reqs.map(r => r.trx_id);
        const { data: originalTrxs } = await supabase.from('transaksi').select('*').in('id', trxIds);

        reqs.forEach(r => {
            const tr = document.createElement('tr');
            const original = originalTrxs?.find(t => t.id === r.trx_id);
            const newData = r.new_data;

            // Generate Diff HTML
            let diffHtml = '';
            if (newData?.type === 'PASSWORD_RESET_REQUEST') {
                diffHtml = `
                    <div class="diff-box" style="border-left: 4px solid var(--primary); background: rgba(59, 130, 246, 0.05);">
                        <div class="diff-label" style="color: var(--primary); font-weight: 700;">💎 PERMINTAAN RESET PASSWORD</div>
                        <div class="diff-content">
                            <div style="font-size: 0.85rem; margin-bottom: 5px;">User memohon pengaturan password baru:</div>
                            <div style="font-weight: 600; padding: 5px 10px; background: var(--bg-card); border-radius: 4px; display: inline-block; color: var(--success); letter-spacing: 1px;">
                                ${newData.new_password}
                            </div>
                            <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 5px;">
                                ℹ️ Silakan update secara manual di Dashboard Supabase Auth.
                            </div>
                        </div>
                    </div>`;
            } else {
                const compareFields = [
                    { label: 'Nama Konsumen', old: original?.customer?.nama, new: newData?.customer?.nama },
                    { label: 'WA 1', old: original?.customer?.wa1, new: newData?.customer?.wa1 },
                    { label: 'Alamat (Kec)', old: original?.customer?.delivery?.alamat?.kec || original?.customer?.alamat?.kec, new: newData?.customer?.alamat?.kec },
                    { label: 'Alamat (Jalan)', old: original?.customer?.delivery?.alamat?.jalan || original?.customer?.alamat?.jalan, new: newData?.customer?.alamat?.jalan }
                ];

                compareFields.forEach(f => {
                    if (f.old !== f.new) {
                        diffHtml += `
                            <div class="diff-box">
                                <div class="diff-label">${f.label}</div>
                                <div class="diff-content">
                                    <div class="diff-old">${f.old || '(Kosong)'}</div>
                                    <div class="diff-new">${f.new || '(Kosong)'}</div>
                                </div>
                            </div>`;
                    }
                });
            }

            tr.innerHTML = `
                <td>
                    <div style="font-weight:700;">${r.trx_id}</div>
                    <div style="font-size:0.75rem; color:var(--text-muted);">${r.requester_email}</div>
                </td>
                <td>
                    ${diffHtml || '<div style="font-style:italic; font-size:0.8rem; color:var(--text-muted);">Tidak ada perubahan data utama (mungkin Item/Lainnya)</div>'}
                </td>
                <td style="text-align:right;">
                    <button class="btn btn-sm btn-primary" onclick="window.approveReq('${r.id}')" style="background:var(--success); border:none; margin-right:5px;" title="Setujui">✅</button>
                    <button class="btn btn-sm" onclick="window.rejectReq('${r.id}')" style="background:var(--danger); color:white; border:none;" title="Tolak">❌</button>
                </td>`;
            list.appendChild(tr);
        });
    }

    window.approveReq = async (id) => {
        const { data: req } = await supabase.from('edit_requests').select('*').eq('id', id).single();
        if(!req) return;

        if (req.new_data?.type === 'PASSWORD_RESET_REQUEST') {
            const serviceRoleKey = localStorage.getItem('SUPABASE_SERVICE_ROLE');
            
            if (serviceRoleKey) {
                // AUTOMATED RESET via Admin Client
                showConfirm(`OTOMATIS RESET PASSWORD?\nSistem akan langsung mengubah password ${req.new_data.full_name} menjadi yang baru secara otomatis.`, async () => {
                    try {
                        setLoading(true);
                        // Create a temporary admin client
                        const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm');
                        const supabaseAdmin = createClient('https://juscihvfmgibmrhmclab.supabase.co', serviceRoleKey, {
                            auth: { autoRefreshToken: false, persistSession: false }
                        });

                        // 1. Find the User in Auth (mapping email)
                        const targetEmail = req.new_data.email.includes('@') ? req.new_data.email.toLowerCase() : `${req.new_data.email.toLowerCase()}@qurban.com`;
                        
                        // We need the internal Supabase UUID from public.profiles because auth.admin needs ID
                        // Menggunakan .ilike agar tidak masalah huruf besar/kecil (Bana123 vs bana123)
                        const { data: profile, error: profErr } = await supabase.from('profiles')
                            .select('id, email')
                            .ilike('email', req.new_data.email)
                            .single();
                        
                        if (profErr || !profile) throw new Error(`User dengan email/username "${req.new_data.email}" tidak ditemukan di database.`);

                        const { error: adminErr } = await supabaseAdmin.auth.admin.updateUserById(
                            profile.id,
                            { password: req.new_data.new_password }
                        );

                        if (adminErr) throw adminErr;

                        // 2. Mark request as done
                        await supabase.from('edit_requests').update({ status: 'done' }).eq('id', id);
                        
                        showToast('✅ PASSWORD BERHASIL DIRESET OTOMATIS!');
                        renderEditRequests();
                    } catch (err) {
                        console.error('[AdminReset] Error:', err);
                        showAlert('Gagal Reset Otomatis: ' + err.message, 'danger');
                    } finally {
                        setLoading(false);
                    }
                });
            } else {
                // FALLBACK: Manual Instructions
                showConfirm('TANDAI SELESAI?\nPastikan Anda sudah mengubah password di Supabase Dashboard untuk user ini.', async () => {
                    await supabase.from('edit_requests').update({ status: 'done' }).eq('id', id);
                    showToast('Permintaan Reset Ditandai Selesai!');
                    renderEditRequests();
                });
            }
            return;
        }

        showConfirm('APPLY PERUBAHAN?\nData transaksi akan diperbarui sesuai permintaan agen.', async () => {
            const { error: upErr } = await supabase.from('transaksi').update({ 
                customer: req.new_data.customer, 
                delivery: req.new_data.delivery,
                items: req.new_data.items,
                total_deal: req.new_data.total_deal
            }).eq('id', req.trx_id);

            if(upErr) return showAlert('Gagal Update: ' + upErr.message, 'danger');

            await supabase.from('edit_requests').update({ status: 'done' }).eq('id', id);
            showToast('Perubahan Berhasil Diterapkan!');
            renderEditRequests();
        });
    };

    window.rejectReq = async (id) => {
        showConfirm('TOLAK & HAPUS PERMINTAAN?\nPerubahan ini akan dibatalkan permanen.', async () => {
            await supabase.from('edit_requests').delete().eq('id', id);
            showToast('Permintaan Ditolak');
            renderEditRequests();
        });
    };

    document.querySelectorAll('.btn-add').forEach(btn => btn.onclick = () => openModal(btn.dataset.tipe));
    document.getElementById('btnCloseModal')?.addEventListener('click', () => modalGeneral.classList.remove('active'));
    document.getElementById('btnCancelModal')?.addEventListener('click', () => modalGeneral.classList.remove('active'));

    await renderTables();

    // === WHATSAPP GATEWAY LOGIC (RESTORED) ===
    const inpWAKey = document.getElementById('inpWhatsAppKey');
    const inpWASender = document.getElementById('inpWhatsAppSender');
    const inpWAFooter = document.getElementById('inpWhatsAppFooter');
    const selWATemplate = document.getElementById('waTemplateSelect');
    const edWATemplate = document.getElementById('waTemplateEditor');
    const btnSaveWA = document.getElementById('btnSaveWAConfig');
    const btnTestWA = document.getElementById('btnTestWA');
    const badgeWASatus = document.getElementById('waStatusDot');
    const textWAStatus = document.getElementById('waStatusText');

    let currentWAConfig = {};

    async function loadWAConfig() {
        if (!inpWAKey) return;
        currentWAConfig = await window.getWaConfig();
        inpWAKey.value = currentWAConfig.apiKey || '';
        inpWASender.value = currentWAConfig.sender || '';
        inpWAFooter.value = currentWAConfig.footer || '';
        
        // Trigger load initial template
        if (selWATemplate) {
            const key = selWATemplate.value;
            edWATemplate.value = currentWAConfig[key] || '';
        }

        // Test status (Quick check if key exists)
        if (badgeWASatus && textWAStatus) {
            if (currentWAConfig.apiKey && currentWAConfig.sender) {
                badgeWASatus.className = 'status-dot active';
                textWAStatus.textContent = 'Terhubung';
                textWAStatus.style.color = 'var(--success)';
            } else {
                badgeWASatus.className = 'status-dot inactive';
                textWAStatus.textContent = 'Terputus';
                textWAStatus.style.color = 'var(--danger)';
            }
        }
    }
    loadWAConfig();

    selWATemplate?.addEventListener('change', () => {
        const key = selWATemplate.value;
        edWATemplate.value = currentWAConfig[key] || '';
    });

    edWATemplate?.addEventListener('input', () => {
        const key = selWATemplate.value;
        currentWAConfig[key] = edWATemplate.value;
    });

    btnSaveWA?.addEventListener('click', async () => {
        currentWAConfig.apiKey = inpWAKey.value.trim();
        currentWAConfig.sender = window.cleanWhatsApp(inpWASender.value);
        currentWAConfig.footer = inpWAFooter.value.trim();
        
        const { success, error } = await window.saveWaConfig(currentWAConfig);
        if (success) {
            showToast('Konfigurasi WA Berhasil Disimpan!');
            loadWAConfig();
        } else {
            showAlert('Gagal menyimpan: ' + error.message, 'danger');
        }
    });

    btnTestWA?.addEventListener('click', async () => {
        const num = document.getElementById('inpTestWaNumber').value.trim();
        if (!num) return showAlert('Masukkan nomor WA tujuan!', 'warning');
        
        btnTestWA.disabled = true;
        btnTestWA.textContent = 'Mengirim...';
        
        try {
            const res = await window.sendWa(num, 'Bismillah, ini adalah Pesan Uji Coba dari Dashboard Qurban Manager. (Koneksi Berhasil!)');
            if (res.success) {
                showAlert('Berhasil! ' + res.msg, 'success');
            } else {
                window.showConfirm(`Uji Coba Gagal: ${res.msg}\n\nGateway mungkin sedang bermasalah atau API Key salah. Ingin tes kirim manual (wa.me)?`, () => {
                    window.open(res.link, '_blank');
                }, null, 'Pesan Gagal Terkirim', 'Coba Manual', 'btn-primary');
            }
        } catch (e) {
            showAlert('Terjadi kesalahan: ' + e.message, 'danger');
        } finally {
            btnTestWA.disabled = false;
            btnTestWA.textContent = '🚀 Test WA';
        }
    });

    // === BACKUP & RESTORE LOGIC (RESTORED) ===
    const btnExport = document.getElementById('btnExportData');
    const btnImportTrigger = document.getElementById('btnTriggerImport');
    const inpImportFile = document.getElementById('inpImportFile');

    btnExport?.addEventListener('click', async () => {
        btnExport.disabled = true;
        btnExport.textContent = 'Menyiapkan Data...';
        
        try {
            const tables = ['master_data', 'profiles', 'kambing', 'transaksi', 'komisi', 'log_aktivitas'];
            const backup = { timestamp: new Date().toISOString(), data: {} };
            
            for (const table of tables) {
                const { data } = await supabase.from(table).select('*');
                backup.data[table] = data || [];
            }

            const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `BACKUP_QURBAN_${new Date().getTime()}.json`;
            a.click();
            showToast('Data Berhasil Diunduh!');
        } catch (e) {
            showAlert('Gagal backup data.', 'danger');
        } finally {
            btnExport.disabled = false;
            btnExport.textContent = '📥 Unduh File Cadangan (.json)';
        }
    });

    btnImportTrigger?.addEventListener('click', () => inpImportFile.click());
    
    inpImportFile?.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        showConfirm('PERINGATAN: Memulihkan data akan MENGGANTI data lama di cloud. Lanjutkan?', async () => {
            const reader = new FileReader();
            reader.onload = async (ev) => {
                try {
                    const backup = JSON.parse(ev.target.result);
                    if (!backup.data) throw new Error('File tidak valid.');
                    
                    showToast('Memulihkan data... Mohon tunggu.');
                    
                    for (const table in backup.data) {
                        const rows = backup.data[table];
                        if (!rows.length) continue;
                        
                        // Upsert rows (might need specific logic for RLS if not admin)
                        const { error } = await supabase.from(table).upsert(rows);
                        if (error) console.error(`[Restore] Error on ${table}:`, error);
                    }

                    showAlert('Data Berhasil Dipulihkan! Halaman akan dimuat ulang.', 'success');
                    setTimeout(() => window.location.reload(), 2000);
                } catch (err) {
                    showAlert('File cadangan rusak atau tidak kompatibel.', 'danger');
                }
            };
            reader.readAsText(file);
        });
    });

    window.deleteUser = async (id, name) => {
        showConfirm(`Hapus user "${name}" secara permanen?\nTindakan ini tidak bisa dibatalkan.`, async () => {
            // Kita gunakan profil ID saja karena login dihandle Auth (tapi ini cukup untuk hapus akses)
            try {
                const { error } = await supabase.from('profiles').delete().eq('id', id);
                if (error) throw error;
                
                showToast('User berhasil dihapus');
                renderUserTable();
            } catch (err) {
                console.error(err);
                showAlert('Gagal menghapus user: ' + err.message, 'danger');
            }
        });
    };
    // === FINANCE CATEGORIES LOGIC ===
    async function renderKatFinance() {
        const listIn = document.getElementById('listKatIn');
        const listOut = document.getElementById('listKatOut');
        if(!listIn || !listOut) return;

        listIn.innerHTML = '<div class="spinner"></div>';
        listOut.innerHTML = '<div class="spinner"></div>';

        const { data: resIn } = await supabase.from('master_data').select('val').eq('key', 'KAT_KEU_IN').single();
        const { data: resOut } = await supabase.from('master_data').select('val').eq('key', 'KAT_KEU_OUT').single();
        
        const catsIn = resIn?.val || [];
        const catsOut = resOut?.val || [];

        const renderItem = (name, type) => `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:0.75rem; background:rgba(255,255,255,0.03); border-radius:8px; border:1px solid rgba(255,255,255,0.05);">
                <span style="font-size:0.9rem;">${name}</span>
                <button class="btn btn-sm" onclick="window.deleteCategory('${type}', '${name}')" style="background:transparent; color:var(--danger); border:none; opacity:0.6;">🗑️</button>
            </div>
        `;

        listIn.innerHTML = catsIn.map(c => renderItem(c, 'IN')).join('') || '<p style="text-align:center; color:var(--text-muted); font-size:0.8rem;">Belum ada kategori.</p>';
        listOut.innerHTML = catsOut.map(c => renderItem(c, 'OUT')).join('') || '<p style="text-align:center; color:var(--text-muted); font-size:0.8rem;">Belum ada kategori.</p>';
    }

    window.addCategory = async (type) => {
        const title = type === 'IN' ? 'Kategori Pemasukan' : 'Kategori Pengeluaran';
        const name = prompt(`Ketik nama ${title} baru:`);
        if (!name || !name.trim()) return;

        const key = type === 'IN' ? 'KAT_KEU_IN' : 'KAT_KEU_OUT';
        const { data } = await supabase.from('master_data').select('val').eq('key', key).single();
        const list = data?.val || [];

        if (list.includes(name.trim())) return showAlert('Kategori sudah ada!', 'warning');
        
        list.push(toTitleCase(name.trim()));
        await supabase.from('master_data').upsert({ id: 'ID-' + key, key, val: list }, { onConflict: 'key' });
        
        showToast('Kategori baru ditambahkan');
        renderKatFinance();
    };

    window.deleteCategory = async (type, name) => {
        showConfirm(`Hapus kategori "${name}"?`, async () => {
            const key = type === 'IN' ? 'KAT_KEU_IN' : 'KAT_KEU_OUT';
            const { data } = await supabase.from('master_data').select('val').eq('key', key).single();
            const list = (data?.val || []).filter(c => c !== name);
            
            await supabase.from('master_data').upsert({ id: 'ID-' + key, key, val: list }, { onConflict: 'key' });
            showToast('Kategori dihapus');
            renderKatFinance();
        });
    };

    // --- AUTO-MIGRATION: BANK_ACCOUNTS -> REKENING ---
    const migrateBankData = async () => {
        const { data: oldData } = await supabase.from('master_data').select('val').eq('key', 'BANK_ACCOUNTS').single();
        const { data: newData } = await supabase.from('master_data').select('val').eq('key', 'REKENING').single();

        if (oldData?.val && oldData.val.length > 0 && (!newData?.val || newData.val.length === 0)) {
            console.log('[Migration] Migrating bank data to NEW key...');
            const { error } = await supabase.from('master_data').upsert({ id: 'ID-REKENING', key: 'REKENING', val: oldData.val }, { onConflict: 'key' });
            if (!error) {
                showToast('✅ Migrasi Rekening Berhasil!');
                // Optional: Delete old key if you want to be clean, 
                // but safer to keep it as backup for now.
            }
        }
    };
    if (isAdmin) migrateBankData();
    // --- SERVICE ROLE KEY MANAGEMENT (For Automated Password Reset) ---
    const inpServiceRole = document.getElementById('inpServiceRole');
    const btnSaveServiceRole = document.getElementById('btnSaveServiceRole');
    const btnClearServiceRole = document.getElementById('btnClearServiceRole');
    const statusAutoReset = document.getElementById('statusAutoReset');

    const updateAutoResetStatus = () => {
        let key = localStorage.getItem('SUPABASE_SERVICE_ROLE');
        
        // Coba ambil dari cadangan Cookie jika localStorage kosong
        if (!key) {
            const cookieVal = document.cookie.split('; ').find(row => row.startsWith('SUPABASE_SERVICE_ROLE='))?.split('=')[1];
            if (cookieVal) {
                key = cookieVal;
                localStorage.setItem('SUPABASE_SERVICE_ROLE', key); // Pulihkan ke localStorage
            }
        }
        
        if (key && statusAutoReset) {
            statusAutoReset.textContent = 'Status: Aktif ⚡';
            statusAutoReset.style.background = 'rgba(16, 185, 129, 0.2)';
            statusAutoReset.style.color = 'var(--success)';
            if (inpServiceRole) inpServiceRole.value = '••••••••••••••••••••••••••••••••';
        } else if (statusAutoReset) {
            statusAutoReset.textContent = 'Status: Belum Aktif';
            statusAutoReset.style.background = 'rgba(255,255,255,0.05)';
            statusAutoReset.style.color = 'var(--text-muted)';
            if (inpServiceRole) inpServiceRole.value = '';
        }
    };

    if (btnSaveServiceRole) {
        btnSaveServiceRole.onclick = () => {
            const val = inpServiceRole.value.trim();
            if (!val || val.includes('•')) return showAlert('Masukkan kunci yang valid!', 'warning');
            
            // Simpan di localStorage (Utama)
            localStorage.setItem('SUPABASE_SERVICE_ROLE', val);
            
            // Simpan di Cookie (Cadangan Abadi - Tidak terhapus oleh localStorage.clear())
            document.cookie = `SUPABASE_SERVICE_ROLE=${val}; max-age=31536000; path=/; SameSite=Lax`;
            
            showToast('Kunci Master Tersimpan (Lokal & Cadangan)');
            updateAutoResetStatus();
        };
    }

    if (btnClearServiceRole) {
        btnClearServiceRole.onclick = () => {
            localStorage.removeItem('SUPABASE_SERVICE_ROLE');
            showToast('Kunci Master Dihapus');
            updateAutoResetStatus();
        };
    }

    // --- AKUN DOCTOR: FORCE SYNC & REPAIR ---
    window.repairAccountDoctor = async (rawEmail, currentProfileId) => {
        let serviceRoleKey = localStorage.getItem('SUPABASE_SERVICE_ROLE');
        
        // Coba pulihkan dari Cookie jika hilang
        if (!serviceRoleKey) {
            serviceRoleKey = document.cookie.split('; ').find(row => row.startsWith('SUPABASE_SERVICE_ROLE='))?.split('=')[1];
            if (serviceRoleKey) localStorage.setItem('SUPABASE_SERVICE_ROLE', serviceRoleKey);
        }

        if (!serviceRoleKey) return showAlert('Kunci Master (Service Role) belum diatur di tab Otomatisasi!', 'warning');

        showConfirm(`🩺 Jalankan Akun Doctor untuk "${rawEmail}"?\n\nSistem akan mencari ID asli di Supabase Auth, membetulkan jika tidak sinkron, dan mereset password.`, async () => {
            try {
                setLoading(true);
                const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm');
                const supabaseAdmin = createClient('https://juscihvfmgibmrhmclab.supabase.co', serviceRoleKey, {
                    auth: { autoRefreshToken: false, persistSession: false }
                });

                // 1. Cari User di Auth menggunakan email (lowercase)
                const searchEmail = rawEmail.includes('@') ? rawEmail.toLowerCase() : `${rawEmail.toLowerCase()}@qurban.com`;
                
                // listUsers() then filter is the most robust way if email query is tricky
                const { data: { users }, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
                if (listErr) throw listErr;

                const authUser = users.find(u => u.email.toLowerCase() === searchEmail);
                if (!authUser) throw new Error(`User "${searchEmail}" tidak ditemukan di sistem Autentikasi (Auth). Pastikan user sudah pernah Register.`);

                const realUid = authUser.id;
                console.log('[Doctor] Found Auth User:', authUser.email, 'UID:', realUid);

                // 2. Sinkronisasi Tabel Profiles (Jika ID mismatch)
                if (realUid !== currentProfileId) {
                    console.warn('[Doctor] ID Mismatch detected! Syncing profiles table...');
                    const { data: oldProfile } = await supabase.from('profiles').select('*').eq('id', currentProfileId).single();
                    
                    if (oldProfile) {
                        // Create NEW profile with correct ID, then delete old one
                        const newProfileData = { ...oldProfile, id: realUid, email: rawEmail.toLowerCase(), status: 'approved' };
                        const { error: insErr } = await supabase.from('profiles').upsert(newProfileData);
                        if (insErr) throw new Error('Gagal migrasi ID profil: ' + insErr.message);
                        
                        // Delete old "detached" profile
                        await supabase.from('profiles').delete().eq('id', currentProfileId);
                        console.log('[Doctor] Profile re-linked to real UID.');
                    }
                } else {
                    // Hanya normalisasi email jika ID sudah pas
                    await supabase.from('profiles').update({ email: rawEmail.toLowerCase(), status: 'approved' }).eq('id', realUid);
                }

                // 3. Force Reset Password
                window.showInput(`📦 Masukkan Password Baru untuk <strong>${rawEmail}</strong>:`, 'BanaBaru123', async (newPass) => {
                    if (!newPass) return showAlert('Reset dibatalkan. Password tidak boleh kosong.', 'warning');
                    
                    try {
                        setLoading(true);
                        const { error: resetErr } = await supabaseAdmin.auth.admin.updateUserById(realUid, { password: newPass });
                        if (resetErr) throw resetErr;

                        showAlert(`🩺 AKUN BERHASIL DIPULIHKAN!\n\nEmail Auth: ${authUser.email}\nStatus: Approved\nPassword: ${newPass}\n\nUser sekarang pasti bisa login.`, 'success');
                        renderUserTable();
                    } catch (err) {
                        console.error('[Doctor] Reset Error:', err);
                        showAlert('Gagal Reset Password: ' + err.message, 'danger');
                    } finally {
                        setLoading(false);
                    }
                }, () => {
                    setLoading(false);
                }, 'Reset Password (Doctor)');

            } catch (err) {
                console.error('[Doctor] Failed:', err);
                showAlert('Gagal Menjalankan Akun Doctor: ' + err.message, 'danger');
            } finally {
                setLoading(false);
            }
        });
    };

    updateAutoResetStatus();
});
