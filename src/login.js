import { supabase } from './supabase.js';

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Check current session
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session) {
        // Fetch profile to check status
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        
        // Local Bypass: Allow entry if on localhost regardless of status
        if (profile && (profile.status === 'approved' || isLocal)) {
            const userRole = (profile.role || 'staff').toLowerCase().trim();
            const isAdmin = ['admin', 'office', 'staf', 'operator'].includes(userRole);
            window.location.href = isAdmin ? 'dashboard.html' : 'kambing.html';
            return;
        } else if (profile && profile.status !== 'approved' && !isLocal) {
            // Logout if not approved and not on localhost
            await supabase.auth.signOut();
        }
    }

    // --- Dynamic Logo & Title from Supabase Cloud ---
    async function loadBranding() {
        try {
            const { data } = await supabase.from('master_data').select('val').eq('key', 'PROFILE').single();
            if (data && data.val) {
                const profile = data.val;
                const loginLogo = document.getElementById('loginLogo');
                const loginTitle = document.getElementById('loginTitle');
                
                if (profile.logo) {
                    const logos = ['loginLogo', 'registerLogo', 'forgotLogo'];
                    logos.forEach(id => {
                        const img = document.getElementById(id);
                        if (img) {
                            img.src = profile.logo;
                            img.style.display = 'block';
                            img.style.opacity = '1';
                        }
                    });
                    
                    // Ensure the logo is visible if it was hidden or using a fallback icon
                    const defaultIcon = document.querySelector('.login-header .icon-box');
                    if (defaultIcon) defaultIcon.style.display = 'none';
                } else {
                    restoreLogosOpacity();
                }
                if (profile.nama && loginTitle) {
                    loginTitle.innerHTML = `<span style="color: var(--primary);">${profile.nama}</span> Qurban`;
                }
            } else {
                restoreLogosOpacity();
            }
        } catch (e) {
            console.error('Branding Load Error:', e);
            restoreLogosOpacity();
        }
    }
    
    function restoreLogosOpacity() {
        ['loginLogo', 'registerLogo', 'forgotLogo'].forEach(id => {
            const img = document.getElementById(id);
            if (img) img.style.opacity = '1';
        });
    }

    loadBranding();

    const loginForm = document.getElementById('loginForm');
    const usernameInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const errorMessage = document.getElementById('errorMessage');
    const loginBtn = document.getElementById('loginBtn');
    const loginSpinner = document.getElementById('loginSpinner');
    const btnText = loginBtn.querySelector('span');

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Reset error state
        errorMessage.textContent = '';
        usernameInput.style.borderColor = 'transparent';
        passwordInput.style.borderColor = 'transparent';

        const username = usernameInput.value.trim();
        const password = passwordInput.value;

        if (!username || !password) {
            showError('Mohon isi username dan password.');
            return;
        }

        setLoading(true);

        try {
            // 1. Auth Login
            const email = username.includes('@') ? username : `${username}@qurban.com`;
            const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                email: email,
                password: password
            });

            if (authError) throw authError;

            // 2. Fetch Profile Details
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', authData.user.id)
                .single();

            if (profileError) throw profileError;

            // 3. Status Check (Local Bypass Included)
            const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            
            if (profile.status === 'pending' && !isLocal) {
                await supabase.auth.signOut();
                showError('Akun Anda masih dalam status Menunggu Persetujuan Admin (Pending).');
                setLoading(false);
                return;
            } else if (profile.status === 'rejected' && !isLocal) {
                await supabase.auth.signOut();
                showError('Akun Anda Ditolak oleh Pimpinan.');
                setLoading(false);
                return;
            }

            // Success - Just set a minimal flag for immediate UI response if needed, 
            // though layout.js will handle the redirect on next page load or via location.reload()
            loginBtn.style.backgroundColor = 'var(--success)';
            btnText.textContent = 'Berhasil Masuk...';
            
            setTimeout(() => {
                const userRole = (profile.role || 'staff').toLowerCase().trim();
                const isAdmin = ['admin', 'office', 'staf', 'operator'].includes(userRole);
                window.location.href = isAdmin ? 'dashboard.html' : 'kambing.html';
            }, 500);

        } catch (err) {
            console.error(err);
            setLoading(false);
            
            let userMsg = err.message || 'Terjadi gangguan koneksi ke server.';
            
            // Custom messages for clearer feedback
            if (err.message === 'Invalid login credentials') {
                userMsg = 'Email atau Password salah. Silakan cek kembali.';
            } else if (err.message.includes('Email not confirmed')) {
                userMsg = 'Email belum dikonfirmasi. Silakan cek email Anda.';
            } else if (err.message.includes('JSON object requested, but 0 rows were returned')) {
                userMsg = 'Profil akun tidak ditemukan. Harap hubungi Admin Utama.';
            }
            
            showError(userMsg);
            usernameInput.style.borderColor = 'var(--danger)';
            passwordInput.style.borderColor = 'var(--danger)';
        }
    });


    function showError(msg) {
        errorMessage.textContent = msg;
        loginForm.classList.add('shake');
        setTimeout(() => loginForm.classList.remove('shake'), 500);
    }

    function setLoading(isLoading) {
        if (isLoading) {
            loginBtn.disabled = true;
            btnText.textContent = 'Memverifikasi...';
            loginSpinner.style.display = 'block';
        } else {
            loginBtn.disabled = false;
            btnText.textContent = 'Masuk';
            loginSpinner.style.display = 'none';
        }
    }

    // --- Developer Mode: Quick Login ---
    const quickLoginBtn = document.getElementById('quickLoginBtn');
    if (quickLoginBtn) {
        quickLoginBtn.addEventListener('click', async () => {
            // Logic: Fill with a common dev credential and submit
            // or simply bypass if we want to be more direct.
            // Since we use Supabase, we MUST have a valid user.
            // For now, let's fill with a common placeholder or what the user likely has.
            usernameInput.value = 'admin';
            passwordInput.value = 'admin123';
            
            // Trigger normal login
            loginForm.dispatchEvent(new Event('submit'));
        });
    }

    // --- Modify Status Check in Submit Handler ---
    // (I'll do this by replacing the block in the next chunk)
});
