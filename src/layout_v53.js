import { supabase } from './supabase.js';

window.getLocalDate = function() {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().split('T')[0];
};

window.getDirectDriveLink = function(url) {
    if (!url) return '';
    if (url.includes('lh3.googleusercontent.com/d/')) return url;
    if (!url.includes('drive.google.com') && !url.includes('docs.google.com')) return url;
    
    // Improved regex to handle /file/d/ID/... and ?id=ID patterns more robustly
    let fileId = '';
    const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    
    if (fileMatch) fileId = fileMatch[1];
    else if (idMatch) fileId = idMatch[1];
    
    if (fileId) return `https://lh3.googleusercontent.com/d/${fileId}`;
    return url;
};

// --- GLOBAL PHOTO VIEWER ---
window.viewPhoto = function(url) {
    if(!url) return window.showToast('Foto tidak tersedia.', 'warning');
    
    let lb = document.getElementById('globalPhotoLightbox');
    if(!lb) {
        lb = document.createElement('div');
        lb.id = 'globalPhotoLightbox';
        lb.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.9); z-index:999999; display:none; align-items:center; justify-content:center; cursor:zoom-out; flex-direction:column; padding:20px;';
        lb.innerHTML = `
            <div id="globalPhotoLoading" style="color:white; font-size:0.9rem; margin-bottom:10px;">Memuat Foto...</div>
            <img id="globalPhotoImg" style="max-width:95%; max-height:85%; object-fit:contain; border-radius:8px; display:none; box-shadow:0 20px 50px rgba(0,0,0,0.5);">
            <button style="position:absolute; top:20px; right:20px; background:rgba(255,255,255,0.1); color:white; border:none; border-radius:50%; width:40px; height:40px; cursor:pointer; font-size:20px;">&times;</button>
        `;
        document.body.appendChild(lb);
        lb.onclick = () => lb.style.display = 'none';
        lb.querySelector('button').onclick = (e) => { e.stopPropagation(); lb.style.display = 'none'; };
    }

    const img = document.getElementById('globalPhotoImg');
    const loading = document.getElementById('globalPhotoLoading');
    
    img.style.display = 'none';
    loading.style.display = 'block';
    loading.textContent = 'Memuat Foto...';
    
    lb.style.display = 'flex';
    img.src = window.getDirectDriveLink(url);
    img.onload = () => {
        loading.style.display = 'none';
        img.style.display = 'block';
    };
    img.onerror = () => {
        loading.textContent = 'Gagal memuat foto. Cek izin akses GDrive.';
    };
};

// --- GLOBAL WA FORMATTING ---
window.cleanWhatsApp = (num) => {
    let c = String(num || '').replace(/\D/g, ''); // Hapus semua karakter non-angka
    if (c.startsWith('62')) return c;        // Sudah format internasional
    if (c.startsWith('0')) c = '62' + c.substring(1); // 08xx → 628xx
    else if (c.startsWith('8')) c = '62' + c; // 8xx → 628xx
    return c;
};

window.setupAutoCleanWA = (selectorOrEl) => {
    const el = typeof selectorOrEl === 'string' ? document.getElementById(selectorOrEl) : selectorOrEl;
    if (!el) return;
    el.addEventListener('blur', () => {
        if (el.value.trim()) el.value = window.cleanWhatsApp(el.value.trim());
    });
};

// --- GLOBAL MONEY UTILITIES ---
window.formatRp = (v) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v || 0);

window.formatNum = (v) => {
    if (v === null || v === undefined || v === '') return '';
    // Hapus karakter non-digit kecuali jika sudah angka
    let val = typeof v === 'number' ? v : String(v).replace(/\D/g, '');
    if (!val && val !== 0) return '';
    return Math.round(Number(val)).toLocaleString('id-ID');
};

window.parseNum = (s) => {
    if (typeof s === 'number') return s;
    if (!s) return 0;
    // Hapus titik pemisah ribuan dan ganti koma menjadi titik desimal jika ada
    return parseFloat(String(s).replace(/\./g, '').replace(',', '.')) || 0;
};

window.setupMoneyMask = (selectorOrEl) => {
    const el = typeof selectorOrEl === 'string' ? document.getElementById(selectorOrEl) : selectorOrEl;
    if (!el) return;
    
    // Set initial mask if already has value
    if (el.value) el.value = window.formatNum(el.value);

    el.addEventListener('input', (e) => {
        const cursorP = e.target.selectionStart;
        const oldL = e.target.value.length;
        
        let v = e.target.value.replace(/\D/g, '');
        if (!v && v !== '0') {
            e.target.value = '';
            return;
        }
        
        const formatted = window.formatNum(v);
        e.target.value = formatted;
        
        // Adjust cursor position after dots are added
        const newL = formatted.length;
        const adj = newL - oldL;
        e.target.setSelectionRange(cursorP + adj, cursorP + adj);
    });
};

// --- GLOBAL NOTIFICATION SYSTEM ---
let toastContainer = null;
window.showToast = function(message, type = 'info', duration = 3000) {
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container';
        document.body.appendChild(toastContainer);
    }
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let iconSvg = '';
    let bg = 'rgba(var(--primary-rgb), 0.1)';
    let color = 'var(--primary)';
    
    if(type === 'success') {
        iconSvg = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
        bg = 'rgba(var(--success-rgb), 0.1)'; color = 'var(--success)';
    } else if(type === 'danger') {
        iconSvg = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
        bg = 'rgba(var(--danger-rgb), 0.1)'; color = 'var(--danger)';
    } else if(type === 'warning') {
        iconSvg = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;
        bg = 'rgba(var(--warning-rgb), 0.1)'; color = 'var(--warning)';
    } else {
        iconSvg = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
        bg = 'rgba(var(--info-rgb), 0.1)'; color = 'var(--primary)';
    }
    
    toast.innerHTML = `<div class="toast-icon" style="background:${bg}; color:${color};">${iconSvg}</div><div class="toast-content" style="font-weight:600; font-size:0.9rem;">${message}</div>`;
    toastContainer.appendChild(toast);
    setTimeout(() => { toast.classList.add('hiding'); setTimeout(() => toast.remove(), 300); }, duration);
};

window.showAlert = function(message, type = 'info', onOk = null) {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay-custom';
        overlay.style.zIndex = '100005'; // Ensure on top
    
    let iconHtml = '', color = 'var(--primary)', bg = 'rgba(var(--primary-rgb), 0.1)', titleText = 'Pemberitahuan';
    
    if(type === 'success') { 
        iconHtml = `<svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
        color = 'var(--success)'; bg = 'rgba(var(--success-rgb), 0.1)'; titleText = 'Berhasil';
    } else if(type === 'danger') { 
        iconHtml = `<svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
        color = 'var(--danger)'; bg = 'rgba(var(--danger-rgb), 0.1)'; titleText = 'Terjadi Kesalahan';
    } else if(type === 'warning') { 
        iconHtml = `<svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;
        color = 'var(--warning)'; bg = 'rgba(var(--warning-rgb), 0.1)'; titleText = 'Peringatan';
    } else {
        iconHtml = `<svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
        color = 'var(--primary)'; bg = 'rgba(var(--primary-rgb), 0.1)'; titleText = 'Informasi';
    }

        overlay.innerHTML = `
            <div class="modal-custom">
                <div class="modal-custom-header">
                    <div class="modal-custom-icon" style="background:${bg}; color:${color};">
                        ${iconHtml}
                    </div>
                    <div class="modal-custom-title">${titleText}</div>
                </div>
                <div class="modal-custom-body">${message}</div>
                <div class="modal-custom-footer">
                    <button class="btn btn-primary" id="modalOkBtn" style="background:${color}; box-shadow: 0 4px 14px 0 ${bg.replace('0.1', '0.4')};">OKE, MENGERTI</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        document.getElementById('modalOkBtn').onclick = () => { 
            overlay.remove(); 
            if(onOk) onOk(); 
            resolve(true); 
        };
    });
};

window.showConfirm = function(message, onConfirm, onCancel, title = 'Konfirmasi', confirmText = 'Ya, Lanjutkan', confirmClass = 'btn-primary') {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay-custom';
        overlay.style.zIndex = '100006';
    
    let color = 'var(--primary)';
    if (confirmClass.includes('danger')) color = 'var(--danger)';
    else if (confirmClass.includes('warning')) color = 'var(--warning)';

        overlay.innerHTML = `
            <div class="modal-custom">
                <div class="modal-custom-header">
                    <div class="modal-custom-icon" style="background:rgba(var(--primary-rgb), 0.1); color:var(--primary);">
                        <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                    </div>
                    <div class="modal-custom-title">${title}</div>
                </div>
                <div class="modal-custom-body">${message}</div>
                <div class="modal-custom-footer">
                    <button class="btn" id="modalConfirmCancelBtn" style="background:rgba(255,255,255,0.05); color:var(--text-muted);">Batal</button>
                    <button class="btn ${confirmClass}" id="modalConfirmOkBtn" style="${confirmClass === 'btn-primary' ? '' : `background:${color};`}">${confirmText}</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        document.getElementById('modalConfirmOkBtn').onclick = () => { 
            overlay.remove(); 
            if(onConfirm) onConfirm(); 
            resolve(true); 
        };
        document.getElementById('modalConfirmCancelBtn').onclick = () => { 
            overlay.remove(); 
            if(onCancel) onCancel(); 
            resolve(false); 
        };
    });
};

window.showInput = function(message, defaultValue = '', onOk = null, onCancel = null, title = 'Input Data', placeholder = 'Masukkan data...') {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay-custom';
    
    overlay.innerHTML = `
        <div class="modal-custom" style="max-width:400px;">
            <div class="modal-custom-header">
                <div class="modal-custom-icon" style="background:rgba(var(--primary-rgb), 0.1); color:var(--primary);">
                    <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                </div>
                <div class="modal-custom-title">${title}</div>
            </div>
            <div class="modal-custom-body" style="text-align:center;">
                <div style="margin-bottom:1.5rem; color:var(--text-muted); font-size:1rem; line-height:1.5;">${message}</div>
                <input type="text" id="modalInputText" class="form-control" value="${defaultValue}" placeholder="${placeholder}" 
                    style="width:100%; padding:1.25rem; border-radius:16px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:var(--text-main); font-size:1.1rem; text-align:center; box-shadow: inset 0 2px 4px rgba(0,0,0,0.1);">
            </div>
            <div class="modal-custom-footer" style="margin-top:2rem;">
                <button class="btn" id="modalInputCancelBtn" style="background:rgba(255,255,255,0.05); color:var(--text-muted);">BATAL</button>
                <button class="btn btn-primary" id="modalInputOkBtn">SIMPAN DATA</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    const input = document.getElementById('modalInputText');
    setTimeout(() => {
        input.focus();
        input.select();
    }, 100);

    document.getElementById('modalInputOkBtn').onclick = () => { 
        const val = input.value;
        overlay.remove(); 
        if(onOk) onOk(val); 
    };
    document.getElementById('modalInputCancelBtn').onclick = () => { 
        overlay.remove(); 
        if(onCancel) onCancel(); 
    };
    input.onkeydown = (e) => {
        if(e.key === 'Enter') document.getElementById('modalInputOkBtn').click();
        if(e.key === 'Escape') document.getElementById('modalInputCancelBtn').click();
    };
};

window.showChoice = function(message, options, title = 'Konfirmasi') {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay-custom';
    overlay.style.zIndex = '100005';
    
    let buttonsHtml = '';
    options.forEach((opt, idx) => {
        const btnClass = idx === 0 ? 'btn-primary' : 'btn';
        buttonsHtml += `<button class="btn ${btnClass}" id="choiceBtn_${idx}" style="width:100%; margin-bottom:0.5rem;">${opt.text}</button>`;
    });

    overlay.innerHTML = `
        <div class="modal-custom" style="max-width:400px;">
            <div class="modal-custom-header">
                <div class="modal-custom-icon">❓</div>
                <div class="modal-custom-title">${title}</div>
            </div>
            <div class="modal-custom-body" style="text-align:center; padding-bottom:1.5rem;">${message}</div>
            <div class="modal-custom-footer" style="flex-direction:column; gap:0;">
                ${buttonsHtml}
                <button class="btn" id="choiceBtnCancel" style="width:100%; background:transparent; border:1px solid rgba(255,255,255,0.1); margin-top:0.5rem;">Batal</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    options.forEach((opt, idx) => {
        document.getElementById(`choiceBtn_${idx}`).onclick = () => {
            overlay.remove();
            if (opt.callback) opt.callback();
        };
    });

    document.getElementById('choiceBtnCancel').onclick = () => {
        overlay.remove();
    };
};

// --- GLOBAL UTILS ---
window.getSaldoChannel = async (channelKey) => {
    const { data } = await supabase.from('keuangan').select('nominal, tipe, channel');
    let saldo = 0;
    const key = (channelKey || '').toLowerCase();
    (data || []).forEach(f => {
        if((f.channel || '').toLowerCase().includes(key)) {
            saldo += (f.tipe === 'pemasukan' ? 1 : -1) * f.nominal;
        }
    });
    return saldo;
};

window.checkSaldoCukup = async (channelKey, nominal, label) => {
    const saldo = await window.getSaldoChannel(channelKey);
    if(saldo < nominal) {
        window.showAlert(`Saldo ${label || channelKey} Tidak Mencukupi!<br>Tersedia: ${new Intl.NumberFormat('id-ID', {style:'currency', currency:'IDR'}).format(saldo)}`, 'warning');
        return false;
    }
    return true;
};

// --- CORE LAYOUT ENGINE ---
document.addEventListener('DOMContentLoaded', async () => {
    try {
    const isLoginPage = window.location.pathname.includes('login.html') || window.location.pathname === '/login';

    // 1. Theme Immediate Sync
    const applyTheme = () => {
        const t = localStorage.getItem('QURBAN_THEME') || 'light';
        if (t === 'light') document.documentElement.classList.add('light-mode');
        else document.documentElement.classList.remove('light-mode');
    };
    applyTheme();

    if (!session) {
        if (!isLoginPage) window.location.href = 'login.html';
        return;
    }

    // 2. UI Injection (Hamburger & Actions)
    const topbar = document.querySelector('.topbar');
    if (topbar) {
        // 1. Mobile Menu Toggle
        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'menu-toggle';
        toggleBtn.innerHTML = '☰';
        topbar.prepend(toggleBtn);

        // 2. Sidebar Overlay Creation
        let overlay = document.querySelector('.sidebar-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'sidebar-overlay';
            document.body.appendChild(overlay);
        }

        // 3. Toggle Listeners
        const sidebar = document.querySelector('.sidebar');
        const toggleSidebar = () => {
            sidebar?.classList.toggle('active');
            overlay?.classList.toggle('active');
        };

        toggleBtn.onclick = toggleSidebar;
        overlay.onclick = toggleSidebar;

        // Auto-close sidebar on menu click (mobile)
        document.querySelectorAll('.nav-item').forEach(link => {
            link.addEventListener('click', () => {
                if (window.innerWidth <= 768) {
                    sidebar?.classList.remove('active');
                    overlay?.classList.remove('active');
                }
            });
        });

        // Header Actions Container
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'topbar-actions';

        // 1. Notification Bell (For Approval / Alerts)
        const bell = document.createElement('div');
        bell.className = 'action-icon';
        bell.id = 'notifBellIcon';
        bell.innerHTML = '🔔';
        bell.title = 'Notifikasi';
        bell.onclick = () => window.location.href = 'pengaturan.html';
        
        // 2. Settings Gear
        const gear = document.createElement('div');
        gear.className = 'action-icon';
        gear.innerHTML = '⚙️';
        gear.title = 'Pengaturan';
        gear.onclick = () => window.location.href = 'pengaturan.html';

        // 3. Theme Toggle
        const themeBtn = document.createElement('div');
        themeBtn.className = 'action-icon';
        const t = localStorage.getItem('QURBAN_THEME') || 'light';
        themeBtn.innerHTML = t === 'dark' ? '☀️' : '🌙';
        themeBtn.title = 'Ganti Tema';
        themeBtn.onclick = () => {
            const isDark = !document.documentElement.classList.contains('light-mode');
            if (isDark) {
                document.documentElement.classList.add('light-mode');
                localStorage.setItem('QURBAN_THEME', 'light');
                themeBtn.innerHTML = '🌙';
            } else {
                document.documentElement.classList.remove('light-mode');
                localStorage.setItem('QURBAN_THEME', 'dark');
                themeBtn.innerHTML = '☀️';
            }
        };

        // 4. Logout Button in Header
        const logoutHeader = document.createElement('div');
        logoutHeader.className = 'action-icon logout-icon';
        logoutHeader.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width: 18px; height: 18px;">
                <path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path>
                <line x1="12" y1="2" x2="12" y2="12"></line>
            </svg>
        `;
        logoutHeader.title = 'Logout';
        logoutHeader.onclick = async () => {
            window.showConfirm('Yakin ingin keluar?', async () => {
                await supabase.auth.signOut();
                // Simpan kunci admin sebelum pembersihan
                const masterKey = localStorage.getItem('SUPABASE_SERVICE_ROLE');
                localStorage.clear();
                if (masterKey) localStorage.setItem('SUPABASE_SERVICE_ROLE', masterKey);
                
                window.location.href = 'login.html';
            });
        };

        // Theme & Logout are for everyone
        actionsDiv.appendChild(themeBtn);
        actionsDiv.appendChild(logoutHeader);
        
        // Use appendChild so icons appear TO THE RIGHT of User Name
        topbar.querySelector('.user-menu')?.appendChild(actionsDiv);

        // Store references to admin-only icons to be shown later
        window.bellIcon = bell;
        window.gearIcon = gear;
        window.actionsDiv = actionsDiv;
    }

    // 3. Profile & Permissions
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
    if (profile) {
        window.CURRENT_USER = profile;
        const emailDisplay = document.getElementById('userEmailDisplay');
        if (emailDisplay) emailDisplay.textContent = profile.email;

        // Branding
        const sideHeader = document.getElementById('sidebarHeaderWrapper');
        if (sideHeader) {
            sideHeader.innerHTML = `
                <div class="sidebar-logo">
                    <span style="font-weight: 600;">Daarul Mahabbah Qurban</span>
                </div>`;
        }

        // Permissions & Menu Filtering
        const userRole = (profile.role || 'staff').toLowerCase().trim();
        const userEmail = (profile.email || '').toLowerCase();
        const userName = (profile.full_name || '').toLowerCase();
        const userId = profile.id;
        const isYahya = ['15a3372c-87ae-4f0b-8d3b-fc11ccc2b0e1', '7cba5bb4-6a49-4cf9-8006-1a3e88c51ece'].includes(userId) || userName.includes('yahya') || userEmail.includes('yahya');
        const isAdmin = ['admin', 'office', 'staf', 'operator'].includes(userRole) || isYahya;
        const allowedMenus = profile.allowed_menus || [];
        
        if (!isAdmin) {
            // FORCE: Redirect away from protected pages if not admin and not in allowed menus
            const protectedPages = ['dashboard.html', 'keuangan.html', 'laporan.html', 'pemetaan_kandang.html'];
            const currentPage = window.location.pathname.split('/').pop();
            
            if (protectedPages.includes(currentPage) && !allowedMenus.includes(currentPage)) {
                window.location.href = 'kambing.html';
                return;
            }

            document.querySelectorAll('.nav-item').forEach(item => {
                const href = item.getAttribute('href');
                if (href && !allowedMenus.includes(href) && href !== 'pengaturan.html') {
                    item.style.display = 'none';
                }
            });
        }

        // Show topbar actions
        if (window.actionsDiv) {
            if (isAdmin && window.bellIcon) window.actionsDiv.prepend(window.bellIcon);
            if (window.gearIcon) window.actionsDiv.insertBefore(window.gearIcon, window.actionsDiv.children[1]);
        }

        // Notif Bell Badge (Admin)
        // Notif Bell Badge (Admin)
        if (isAdmin) {
            const { count: userCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('status', 'pending');
            const { count: editCount } = await supabase.from('edit_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending');
            const totalNotif = (userCount || 0) + (editCount || 0);

            if (totalNotif > 0) {
                const badge = document.createElement('span');
                badge.className = 'badge-dot';
                document.getElementById('notifBellIcon')?.appendChild(badge);
            }
        }
        
        // --- GLOBAL AFFILIATE LINK INJECTOR (FOR AGENTS/MARKETING) ---
        const isMarketingRole = ['marketing_dm', 'marketing_ext', 'marketing_kandang', 'reseller', 'agen', 'staf', 'admin', 'office', 'operator'].includes(userRole);
        const isMasterDataPage = window.location.pathname.toLowerCase().includes('kambing.html') || window.location.pathname.toLowerCase().endsWith('/kambing');
        const contentArea = document.querySelector('.content-area');

        if (isMarketingRole && contentArea && isMasterDataPage) {
            const username = (profile.email || '').split('@')[0];
            const baseUrl = 'dmqurban.com/etalase.html';
            const fullLink = `${baseUrl}?ref=${username}`;

            // Create Affiliate Card Element
            const affCard = document.createElement('div');
            affCard.id = 'affiliateCardGlobal';
            affCard.className = 'premium-card emerald';
            affCard.style.cssText = 'margin-bottom: 2rem; background: linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(234, 179, 8, 0.05)); border: 1px solid rgba(16, 185, 129, 0.3); padding: 1.5rem; border-radius: 12px;';
            affCard.innerHTML = `
                <div style="display:flex; align-items:center; gap:1.5rem; flex-wrap: wrap;">
                    <div class="premium-icon-box" style="position:static; width:46px; height:46px; flex-shrink:0; background:rgba(16, 185, 129, 0.1); color:var(--emerald-500); display:flex; align-items:center; justify-content:center; border-radius:12px; font-size:1.25rem;">🔗</div>
                    <div style="text-align:left; flex:1; min-width: 200px;">
                        <div class="premium-label" style="color:var(--emerald-500); margin-bottom:0.15rem; font-size:0.75rem; text-transform:uppercase; font-weight:700;">Link Etalase Affiliate Anda</div>
                        <div style="font-size:1.1rem; font-weight:600; color:var(--text-main); word-break: break-all; margin: 0.25rem 0;">${fullLink}</div>
                        <p style="margin:0.1rem 0 0; font-size:0.8rem; color:var(--text-muted);">Bagikan link ini. Chat WA pembeli akan masuk ke nomor Anda!</p>
                    </div>
                    <button id="copyAffBtnGlobal" class="btn btn-sm" style="background:#10b981; color:white; border:none; padding:10px 20px; border-radius:8px; font-weight:700; cursor:pointer; min-width:120px; box-shadow: 0 4px 6px rgba(16, 185, 129, 0.2); transition: 0.3s;">Salin Link</button>
                </div>
            `;
            
            // Prepend to content area (so it's always at the top)
            contentArea.prepend(affCard);

            // Copy logic
            const copyBtn = affCard.querySelector('#copyAffBtnGlobal');
            if (copyBtn) {
                copyBtn.onclick = () => {
                    navigator.clipboard.writeText('https://' + fullLink);
                    const originalText = copyBtn.textContent;
                    copyBtn.textContent = '✅ Tersalin!';
                    copyBtn.style.background = '#059669';
                    setTimeout(() => { 
                        copyBtn.textContent = originalText;
                        copyBtn.style.background = '#10b981';
                    }, 2000);
                };
            }
        }
    }

    // Cleanup legacy sidebar logout button if exists (SAFE VERSION)
    const oldLogout = document.getElementById('logoutBtnLegacy');
    if (oldLogout) oldLogout.remove();

    // 4. VERSION INDICATOR & CREDITS
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
        const verTag = document.createElement('div');
        verTag.style.cssText = 'padding: 1.5rem; font-size: 0.65rem; color: var(--text-muted); opacity: 0.7; border-top: 1px solid rgba(255,255,255,0.05); cursor: default; text-align: center; margin-top: auto; line-height: 1.6;';
        const userId = profile?.id || 'NO_ID';
        verTag.innerHTML = `
            <div>System Version: <span style="color:var(--primary); font-weight:700;">v10.0 [THE RESET]</span></div>
            <div style="margin-top: 0.25rem;">Developed by <span style="color:var(--primary); font-weight:700;">Yoex</span> ✨</div>
        `;
        sidebar.appendChild(verTag);
    }

    // --- GLOBAL ACTIVITY LOGGER ---
    window.logActivity = async (action, target, details = {}) => {
        try {
            const user = window.CURRENT_USER;
            if (!user) return;
            
            await supabase.from('activity_logs').insert([{
                user_id: user.id,
                user_email: user.email,
                user_name: user.full_name || user.email,
                action: action,
                target: target || window.location.pathname.split('/').pop(),
                details: details
            }]);
        } catch (e) {
            console.warn("Logging failed:", e);
        }
    };

    // Auto-log page access
    if (window.CURRENT_USER) {
        const pageName = window.location.pathname.split('/').pop() || 'index.html';
        window.logActivity('OPEN_PAGE', pageName);
    }

    // --- FORCE RENDER SIDEBAR (RESCUE MISSION v7.0) ---
    if (isAdmin) {
        const nav = document.querySelector('.sidebar-nav');
        if (nav) {
            // 1. Check if Dashboard exists, if not, rescue the whole sidebar
            if (!nav.querySelector('a[href="dashboard.html"]')) {
                console.log("SIDEBAR EMPTY! Performing Rescue Render...");
                nav.innerHTML = `
                    <a href="dashboard.html" class="nav-item"> Dashboard Keuangan</a>
                    <div class="nav-header">📁 DATA STOCK</div>
                    <a href="kambing.html" class="nav-item">&bull; Master Data</a>
                    <a href="kambing_masuk.html" class="nav-item">&bull; Kambing Masuk</a>
                    <a href="kambing_terjual.html" class="nav-item">&bull; Kambing Terjual</a>
                    <a href="kesehatan.html" class="nav-item">🏥 Kambing Sakit/Mati</a>
                    <a href="stok_opname.html" class="nav-item">&bull; Stok Opname</a>
                    <a href="distribusi.html" class="nav-item">&bull; Distribusi</a>
                    <div class="nav-header">💰 DATA FINANCE</div>
                    <a href="keuangan.html" class="nav-item">&bull; Pencatatan Keuangan</a>
                    <a href="deposit_agen.html" class="nav-item">&bull; Titipan Dana Agen</a>
                    <a href="terima_pelunasan.html" class="nav-item">&bull; Pelunasan Order</a>
                    <a href="hutang_supplier.html" class="nav-item">&bull; Pelunasan Supplier</a>
                    <a href="komisi.html" class="nav-item">&bull; Komisi Agen</a>
                    <a href="laporan.html" class="nav-item" style="color:#a855f7 !important; font-weight:600; background:rgba(168,85,247,0.1); border:1px solid #a855f7; margin-top:5px;">📊 LAPORAN</a>
                `;
            }

            // 2. Always ensure Pemetaan Kandang & Log Aktivitas exist for Admin
            if (!nav.querySelector('a[href="pemetaan_kandang.html"]')) {
                const mapLink = document.createElement('a');
                mapLink.href = 'pemetaan_kandang.html';
                mapLink.className = 'nav-item';
                mapLink.innerHTML = '&bull; Pemetaan Kandang';
                const distLink = Array.from(nav.querySelectorAll('.nav-item')).find(a => a.href.includes('distribusi.html'));
                if (distLink) distLink.after(mapLink);
                else nav.appendChild(mapLink);
            }

            // 3. FORCE VISIBILITY for all items
            nav.querySelectorAll('.nav-item').forEach(item => {
                item.style.setProperty('display', 'flex', 'important');
                item.style.setProperty('opacity', '1', 'important');
                item.style.setProperty('visibility', 'visible', 'important');
                if (window.location.pathname.includes(item.getAttribute('href'))) {
                    item.classList.add('active');
                }
            });
        }
    }

    } catch (err) {
        console.error("CRITICAL LAYOUT ERROR:", err);
    }
    console.log("%c>> DMQ SYSTEM ACTIVE: v10.0 <<", "color: #10b981; font-weight: bold; font-size: 14px;");
});

// --- UNIVERSAL CAMERA UI (Webcam & Mobile) ---
window.openCameraUI = function(callback) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay-custom active';
    overlay.style.zIndex = '100001';
    
    overlay.innerHTML = `
        <div class="modal-custom" style="max-width: 500px; padding: 0; overflow: hidden; background: #000;">
            <div style="position: relative; width: 100%; aspect-ratio: 4/3; background: #000; display: flex; align-items: center; justify-content: center;">
                <video id="cameraVideo" autoplay playsinline style="width: 100%; height: 100%; object-fit: cover;"></video>
                <div id="cameraLoading" style="position: absolute; color: white;">Memulai Kamera...</div>
            </div>
            <canvas id="cameraCanvas" style="display: none;"></canvas>
            <div class="modal-custom-footer" style="background: var(--bg-card); padding: 1rem; display: flex; flex-direction: column; gap: 0.75rem;">
                <div style="display: flex; gap: 0.75rem; width: 100%;">
                    <button class="btn" id="btnCancelCamera" style="flex: 1; background: transparent; border: 1px solid rgba(255,255,255,0.1);">Batal</button>
                    <button class="btn btn-primary" id="btnCaptureCamera" style="flex: 2;">📸 Ambil Foto (Live)</button>
                </div>
                <!-- Tombol Cadangan untuk Android/Samsung yang Izinnya Terblokir -->
                <button class="btn" id="btnFallbackCamera" style="width: 100%; background: #4f46e5; color: white; border: none; padding: 0.75rem;">
                    📷 Gunakan Kamera HP Standar / Galeri
                </button>
                <input type="file" id="inpFallbackCamera" accept="image/*" capture="environment" style="display: none;">
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    const video = document.getElementById('cameraVideo');
    const canvas = document.getElementById('cameraCanvas');
    const loading = document.getElementById('cameraLoading');
    let stream = null;

    const stopStream = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            stream = null;
        }
    };

    const startCamera = async () => {
        try {
            stream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } 
            });
            video.srcObject = stream;
            loading.style.display = 'none';
        } catch (err) {
            console.error('Camera Error:', err);
            window.showAlert('Gagal mengakses kamera. Pastikan izin kamera sudah diberikan.', 'danger');
            overlay.remove();
        }
    };

    startCamera();

    document.getElementById('btnCancelCamera').onclick = () => {
        stopStream();
        overlay.remove();
    };

    document.getElementById('btnFallbackCamera').onclick = () => {
        document.getElementById('inpFallbackCamera').click();
    };

    document.getElementById('inpFallbackCamera').onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            callback(file);
            stopStream();
            overlay.remove();
        }
    };

    document.getElementById('btnCaptureCamera').onclick = () => {
        const context = canvas.getContext('2d');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        canvas.toBlob((blob) => {
            const file = new File([blob], `capture_${Date.now()}.jpg`, { type: 'image/jpeg' });
            callback(file);
            stopStream();
            overlay.remove();
        }, 'image/jpeg', 0.8);
    };
};

// --- SHARED IMAGE UTILITIES ---
const GDRIVE_PROXY_URL = 'https://script.google.com/macros/s/AKfycbwVd01SmNkuoUwinekKbDAh3meqs8ZsbR-OZoCBPUcHZ3_jcBQST6p5vrSVJULt_t8/exec';

window.compressImage = async function(file, maxWidth = 800, quality = 0.6) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                let width = img.width;
                let height = img.height;
                
                if (width > height) {
                    if (width > maxWidth) { height *= maxWidth / width; width = maxWidth; }
                } else {
                    if (height > maxWidth) { width *= maxWidth / height; height = maxWidth; }
                }
                
                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);
                
                // Get base64 without prefix
                const base64 = canvas.toDataURL('image/jpeg', quality).split(',')[1];
                resolve(base64);
            };
            img.onerror = () => reject(new Error('Gagal memproses file gambar.'));
        };
        reader.onerror = () => reject(new Error('Gagal membaca file.'));
    });
};

window.uploadToGDrive = async function(base64, folderName, fileName) {
    try {
        const response = await fetch(GDRIVE_PROXY_URL, {
            method: 'POST',
            body: JSON.stringify({
                base64: base64,
                mimeType: "image/jpeg",
                fileName: fileName || ("upload_" + Date.now() + ".jpg"),
                folderName: folderName || "UPLOADS_GENERAL"
            })
        });
        const result = await response.json();
        if (result.success && result.url) {
            return window.getDirectDriveLink(result.url);
        } else {
            console.error('GDrive Script Error:', result.error || 'Unknown error');
            return null;
        }
    } catch (error) {
        console.error('GDrive Upload Fetch failed:', error);
        return null;
    }
};

/**
 * processImageUpload: High-level helper for UI modules
 * Returns the URL on success, or null on failure.
 * Automatically shows toasts/alerts.
 */
window.processImageUpload = async function(file, folderName, fileName) {
    if (!file) return null;
    
    window.showToast('Mengompres & Mengunggah gambar...', 'info');
    try {
        const b64 = await window.compressImage(file);
        const url = await window.uploadToGDrive(b64, folderName, fileName);
        
        if (url) {
            window.showToast('Gambar berhasil diunggah!', 'success');
            return url;
        } else {
            window.showAlert('Gagal mengunggah gambar ke Cloud. Silakan coba lagi atau cek koneksi.', 'danger');
            return null;
        }
    } catch (err) {
        console.error('Upload Process Error:', err);
        window.showAlert('Terjadi kesalahan saat memproses gambar: ' + err.message, 'danger');
        return null;
    }
};

