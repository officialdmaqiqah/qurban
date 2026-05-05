import { supabase } from './supabase.js';

document.addEventListener('DOMContentLoaded', async () => {
    // 1. SECURITY CHECK: Only Yahya (yahyaisyoyok) can access
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = 'login.html';
        return;
    }

    const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
    if (!profile) {
        window.location.href = 'login.html';
        return;
    }

    const isAdminRole = ['admin', 'office'].includes(role);
    const isAuthorizedYahya = (name.includes('yahya') || email.includes('yahya')) && isAdminRole;

    if (!isAuthorizedYahya) {
        document.body.innerHTML = `
            <div style="height:100vh; display:flex; flex-direction:column; align-items:center; justify-content:center; background:#0f172a; color:white; font-family:sans-serif;">
                <h1 style="font-size:4rem;">🚫</h1>
                <h2>Akses Ditolak</h2>
                <p style="color:#94a3b8;">Halaman ini hanya dapat diakses oleh Akun Admin (Yahya).</p>
                <a href="dashboard.html" style="margin-top:20px; color:#10b981; text-decoration:none;">Kembali ke Dashboard</a>
            </div>
        `;
        return;
    }

    const logContainer = document.getElementById('logContainer');
    const inpSearch = document.getElementById('inpSearchLog');
    const filterAction = document.getElementById('filterAction');
    const btnRefresh = document.getElementById('btnRefreshLog');

    let allLogs = [];

    async function loadLogs() {
        try {
            const { data, error } = await supabase
                .from('activity_logs')
                .select('*')
                .order('timestamp', { ascending: false })
                .limit(200);

            if (error) throw error;
            allLogs = data;
            renderLogs();
        } catch (err) {
            console.error(err);
            logContainer.innerHTML = `<p style="color:red">Gagal memuat log: ${err.message}</p>`;
        }
    }

    function renderLogs() {
        const search = (inpSearch.value || '').toLowerCase();
        const action = filterAction.value;

        let filtered = allLogs;
        if (search) {
            filtered = filtered.filter(l => 
                (l.user_name || '').toLowerCase().includes(search) ||
                (l.user_email || '').toLowerCase().includes(search) ||
                (l.action || '').toLowerCase().includes(search) ||
                (l.target || '').toLowerCase().includes(search)
            );
        }
        if (action) {
            filtered = filtered.filter(l => l.action === action);
        }

        if (filtered.length === 0) {
            logContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📂</div>
                    <p>Tidak ada log aktivitas yang ditemukan.</p>
                </div>
            `;
            return;
        }

        logContainer.innerHTML = filtered.map(l => {
            const time = new Date(l.timestamp).toLocaleString('id-ID', {
                day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit'
            });

            let badgeClass = 'badge-open';
            let actionName = l.action;
            if (l.action === 'OPEN_PAGE') actionName = 'Membuka';
            else if (l.action === 'SAVE_DATA') { actionName = 'Menyimpan'; badgeClass = 'badge-save'; }
            else if (l.action === 'DELETE') { actionName = 'Menghapus'; badgeClass = 'badge-delete'; }

            return `
                <div class="log-card">
                    <div class="log-user-icon">
                        ${(l.user_name || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div class="log-info">
                        <div class="log-header">
                            <span class="log-user-name">${l.user_name || l.user_email}</span>
                            <span class="log-time">${time}</span>
                        </div>
                        <div class="log-action-text">
                            <span class="log-badge ${badgeClass}">${actionName}</span>
                            <span style="margin-left:8px;">Halaman: <b>${l.target || '-'}</b></span>
                        </div>
                        ${l.details && Object.keys(l.details).length > 0 ? `
                            <div style="font-size:0.75rem; margin-top:5px; color:var(--primary); background:rgba(255,255,255,0.03); padding:5px; border-radius:4px;">
                                Info: ${JSON.stringify(l.details)}
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }

    btnRefresh.onclick = loadLogs;
    inpSearch.oninput = renderLogs;
    filterAction.onchange = renderLogs;

    loadLogs();

    // Set up Realtime Subscription
    supabase
        .channel('activity_logs_realtime')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_logs' }, payload => {
            allLogs.unshift(payload.new);
            if (allLogs.length > 200) allLogs.pop();
            renderLogs();
        })
        .subscribe();
});
