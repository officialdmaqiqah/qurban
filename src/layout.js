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
    let fileId = '';
    const matchFile = url.match(/\/file\/d\/([^\/?#]+)/);
    const matchId = url.match(/[?&]id=([^&#]+)/);
    if (matchFile) fileId = matchFile[1];
    else if (matchId) fileId = matchId[1];
    if (fileId) return `https://lh3.googleusercontent.com/d/${fileId}`;
    return url;
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
    let icon = 'ℹ️';
    if(type === 'success') icon = '✅';
    if(type === 'danger') icon = '❌';
    if(type === 'warning') icon = '⚠️';
    toast.innerHTML = `<div class="toast-icon">${icon}</div><div class="toast-content">${message}</div>`;
    toastContainer.appendChild(toast);
    setTimeout(() => { toast.classList.add('hiding'); setTimeout(() => toast.remove(), 300); }, duration);
};

window.showAlert = function(message, type = 'info', onOk = null) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay-custom';
    let icon = 'ℹ️', color = 'var(--primary)';
    if(type === 'success') { icon = '✅'; color = '#10b981'; }
    if(type === 'danger') { icon = '❌'; color = '#ef4444'; }
    if(type === 'warning') { icon = '⚠️'; color = '#f59e0b'; }
    overlay.innerHTML = `
        <div class="modal-custom">
            <div class="modal-custom-header"><div class="modal-custom-icon">${icon}</div><div class="modal-custom-title">Info</div></div>
            <div class="modal-custom-body">${message}</div>
            <div class="modal-custom-footer"><button class="btn btn-primary" id="modalOkBtn" style="background:${color};">OK</button></div>
        </div>
    `;
    document.body.appendChild(overlay);
    document.getElementById('modalOkBtn').onclick = () => { overlay.remove(); if(onOk) onOk(); };
};

window.showConfirm = function(message, onConfirm, onCancel, title = 'Konfirmasi', confirmText = 'Lanjut', confirmClass = 'btn-danger') {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay-custom';
    overlay.innerHTML = `
        <div class="modal-custom">
            <div class="modal-custom-header"><div class="modal-custom-icon">❓</div><div class="modal-custom-title">${title}</div></div>
            <div class="modal-custom-body">${message}</div>
            <div class="modal-custom-footer">
                <button class="btn" id="modalConfirmCancelBtn">Batal</button>
                <button class="btn ${confirmClass}" id="modalConfirmOkBtn">${confirmText}</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    document.getElementById('modalConfirmOkBtn').onclick = () => { overlay.remove(); if(onConfirm) onConfirm(); };
    document.getElementById('modalConfirmCancelBtn').onclick = () => { overlay.remove(); if(onCancel) onCancel(); };
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
    const { data: { session } } = await supabase.auth.getSession();
    const isLoginPage = window.location.pathname.includes('index.html') || window.location.pathname === '/';

    // 1. Theme Immediate Sync
    const applyTheme = () => {
        const t = localStorage.getItem('QURBAN_THEME') || 'dark';
        if (t === 'light') document.documentElement.classList.add('light-mode');
        else document.documentElement.classList.remove('light-mode');
    };
    applyTheme();

    if (!session) {
        if (!isLoginPage) window.location.href = 'index.html';
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
        actionsDiv.className = 'header-actions';

        // 1. Notification Bell
        const bell = document.createElement('div');
        bell.className = 'action-icon';
        bell.innerHTML = '🔔';
        bell.onclick = () => window.location.href = 'pengaturan.html';
        
        // 2. Theme Toggle
        const themeBtn = document.createElement('div');
        themeBtn.className = 'action-icon';
        const t = localStorage.getItem('QURBAN_THEME') || 'dark';
        themeBtn.innerHTML = t === 'dark' ? '☀️' : '🌙';
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

        // 3. Logout Button in Header
        const logoutHeader = document.createElement('div');
        logoutHeader.className = 'action-icon';
        logoutHeader.innerHTML = '⏻';
        logoutHeader.title = 'Logout';
        logoutHeader.style.color = '#ef4444'; // Beri warna merah sedikit agar kontras
        logoutHeader.onclick = async () => {
            window.showConfirm('Yakin ingin keluar?', async () => {
                await supabase.auth.signOut();
                localStorage.clear();
                window.location.href = 'index.html';
            });
        };

        actionsDiv.appendChild(bell);
        actionsDiv.appendChild(themeBtn);
        actionsDiv.appendChild(logoutHeader);
        topbar.querySelector('.user-menu')?.prepend(actionsDiv);
    }

    // 3. Profile & Permissions
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
    if (profile) {
        window.CURRENT_USER = profile;
        const emailDisplay = document.getElementById('userEmailDisplay');
        if (emailDisplay) emailDisplay.textContent = profile.email;

        // Branding
        const { data: qProfil } = await supabase.from('master_data').select('val').eq('key', 'QURBAN_PROFIL').single();
        const sideHeader = document.getElementById('sidebarHeaderWrapper');
        if (sideHeader && qProfil?.val) {
            sideHeader.innerHTML = `
                <div class="sidebar-logo">
                    ${qProfil.val.logo ? `<img src="${qProfil.val.logo}">` : '🐐'}
                    <span>${qProfil.val.nama}</span>
                </div>`;
        }

        // Permissions & Menu Filtering
        const userRole = profile.role || 'staff';
        const allowedMenus = profile.allowed_menus || [];
        
        if (userRole !== 'admin') {
            document.querySelectorAll('.nav-item').forEach(item => {
                const href = item.getAttribute('href');
                if (href && !allowedMenus.includes(href)) {
                    item.style.display = 'none';
                }
            });
            
            // Special handling for nav-headers (hide if all items below it are hidden)
            // But for now, just filtering individual items is enough for the user.
        }

        // Notif Bell Badge (Admin)
        if (userRole === 'admin') {
            const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('status', 'pending');
            if (count > 0) {
                const badge = document.createElement('span');
                badge.className = 'badge-dot';
                document.querySelector('.header-actions .action-icon')?.appendChild(badge);
            }
        }
    }

    // Cleanup legacy sidebar logout button if exists
    document.getElementById('logoutBtn')?.closest('div')?.remove();
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
