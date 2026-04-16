import { supabase } from './supabase.js';

document.addEventListener('DOMContentLoaded', async () => {
    // Elements
    const tableBodySaldo = document.getElementById('tableBodySaldoAgen');
    const tableBodyRiwayat = document.getElementById('tableBodyRiwayat');
    const statsTotalTitipan = document.getElementById('statsTotalTitipan');
    const statsTotalTerpakai = document.getElementById('statsTotalTerpakai');
    const statsTotalAktif = document.getElementById('statsTotalAktif');
    
    const modalDeposit = document.getElementById('modalDeposit');
    const formDeposit = document.getElementById('formDeposit');
    const btnTambahDeposit = document.getElementById('btnTambahDeposit');
    const btnCloseModal = document.getElementById('btnCloseModal');
    const btnCancelModal = document.getElementById('btnCancelModal');
    
    const inpAgenName = document.getElementById('inpAgenName');
    const inpNominal = document.getElementById('inpNominal');
    const inpTgl = document.getElementById('inpTgl');
    const inpChannel = document.getElementById('inpChannel');
    const containerRek = document.getElementById('containerRek');
    const inpRekId = document.getElementById('inpRekId');

    // 1. Check Session (Must Have)
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    // Load Profile (Optional for this page, don't return if fail)
    try {
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
        if (profile && document.getElementById('userEmailDisplay')) {
            document.getElementById('userEmailDisplay').textContent = profile.email;
        }
    } catch (e) {
        console.warn("Profil tidak dapat dimuat:", e);
    }

    // DB Helpers
    const getAgens = async () => {
        const { data } = await supabase.from('master_data').select('val').eq('key', 'AGENS').single();
        return data?.val || [];
    };

    const getRekening = async () => {
        const { data } = await supabase.from('master_data').select('val').eq('key', 'REKENING').single();
        if (data?.val?.length) return data.val;
        const { data: old } = await supabase.from('master_data').select('val').eq('key', 'BANK_ACCOUNTS').single();
        return old?.val || [];
    };

    const initForm = async () => {
        const agens = await getAgens();
        agens.sort((a, b) => (a.nama || "").localeCompare(b.nama || ""));
        inpAgenName.innerHTML = '<option value="">-- Pilih Agen --</option>';
        agens.forEach(a => {
            const opt = document.createElement('option');
            opt.value = a.nama;
            opt.textContent = `${a.nama} (${a.jenis || 'Agen'})`;
            inpAgenName.appendChild(opt);
        });

        inpTgl.value = window.getLocalDate();
        inpNominal.value = '';
        document.getElementById('editId').value = '';
        document.getElementById('modalTitle').textContent = 'Tambah Titipan Dana';
        
        window.setupMoneyMask(inpNominal);
    };

    const refreshData = async () => {
        const { data: keuangan } = await supabase.from('keuangan').select('*').order('tanggal', { ascending: false });
        const agens = await getAgens();
        
        // Filter transactions related to deposits
        const depKats = ['Titipan Dana Agen', 'Pemakaian Titipan Agen', 'Penarikan Titipan Agen'];
        const depRows = (keuangan || []).filter(f => depKats.includes(f.kategori));

        // Group by Agent
        const balances = {};
        agens.forEach(a => { balances[a.nama] = { in: 0, out: 0, balance: 0 }; });

        let totalIn = 0;
        let totalOut = 0;

        depRows.forEach(f => {
            const name = f.agen_name || '';
            const nom = parseFloat(f.nominal) || 0;
            
            if (f.kategori === 'Titipan Dana Agen') {
                if (f.tipe === 'pemasukan') {
                    if (balances[name]) balances[name].in += nom;
                    totalIn += nom;
                } else { // Penarikan (jika ada yang input pengeluaran dgn kategori ini)
                    if (balances[name]) balances[name].out += nom;
                    totalOut += nom;
                }
            } else { // Pemakaian / Penarikan
                if (balances[name]) balances[name].out += nom;
                totalOut += nom;
            }
        });

        // Render Balances
        tableBodySaldo.innerHTML = '';
        Object.keys(balances).forEach(name => {
            const b = balances[name];
            if (b.in === 0 && b.out === 0) return; // Skip zero balance
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${name}</strong></td>
                <td class="text-right text-success">${window.formatRp(b.in)}</td>
                <td class="text-right text-danger">${window.formatRp(b.out)}</td>
                <td class="text-right font-bold">${window.formatRp(b.in - b.out)}</td>
                <td class="text-right">
                    <button class="btn btn-sm" onclick="window.viewAgentHistory('${name}')">👁️ Detail</button>
                </td>
            `;
            tableBodySaldo.appendChild(tr);
        });
        if (tableBodySaldo.innerHTML === '') tableBodySaldo.innerHTML = '<tr><td colspan="5" class="text-center">Belum ada saldo titipan.</td></tr>';

        // Render History
        tableBodyRiwayat.innerHTML = '';
        depRows.forEach(f => {
            const tr = document.createElement('tr');
            const isOut = f.kategori !== 'Titipan Dana Agen' || f.tipe === 'pengeluaran';
            tr.innerHTML = `
                <td>${f.tanggal}</td>
                <td>${f.agen_name || '-'}</td>
                <td><span class="badge ${isOut ? 'badge-danger' : 'badge-success'}">${f.kategori}</span></td>
                <td><small>${f.keterangan || '-'}</small></td>
                <td>${f.channel || '-'}</td>
                <td class="text-right font-bold ${isOut ? 'text-danger' : 'text-success'}">${isOut ? '-' : '+'}${window.formatRp(f.nominal)}</td>
                <td class="text-right">
                    <button class="btn btn-sm" onclick="window.deleteDeposit('${f.id}')">🗑️</button>
                </td>
            `;
            tableBodyRiwayat.appendChild(tr);
        });
        if (tableBodyRiwayat.innerHTML === '') tableBodyRiwayat.innerHTML = '<tr><td colspan="7" class="text-center">Belum ada riwayat transaksi.</td></tr>';

        // Stats
        statsTotalTitipan.textContent = window.formatRp(totalIn);
        statsTotalTerpakai.textContent = window.formatRp(totalOut);
        statsTotalAktif.textContent = window.formatRp(totalIn - totalOut);
    };

    // Actions
    btnTambahDeposit.onclick = () => {
        initForm();
        modalDeposit.classList.add('active');
    };

    btnCloseModal.onclick = () => modalDeposit.classList.remove('active');
    btnCancelModal.onclick = () => modalDeposit.classList.remove('active');

    inpChannel.onchange = async () => {
        if (inpChannel.value === 'Transfer Bank') {
            containerRek.style.display = 'block';
            const reks = await getRekening();
            inpRekId.innerHTML = '<option value="">-- Pilih Rekening --</option>';
            reks.forEach(r => {
                const opt = document.createElement('option');
                opt.value = r.id;
                opt.textContent = `${r.bank} - ${r.norek} (${r.an})`;
                inpRekId.appendChild(opt);
            });
        } else {
            containerRek.style.display = 'none';
        }
    };

    formDeposit.onsubmit = async (e) => {
        e.preventDefault();
        const id = document.getElementById('editId').value || 'DEP-' + Date.now();
        const kat = document.getElementById('inpKategori').value;
        const tipe = (kat === 'Titipan Dana Agen') ? 'pemasukan' : 'pengeluaran';
        const nominal = window.parseNum(inpNominal.value);
        let channel = inpChannel.value;
        if (channel === 'Transfer Bank' && inpRekId.value) {
            channel = `TF ${inpRekId.options[inpRekId.selectedIndex].textContent}`;
        }

        const data = {
            id,
            tanggal: inpTgl.value,
            tipe,
            kategori: kat,
            nominal,
            channel,
            agen_name: inpAgenName.value,
            keterangan: document.getElementById('inpKeterangan').value,
            rek_id: inpRekId.value || null
        };

        const { error } = await supabase.from('keuangan').upsert([data]);
        if (error) {
            window.showAlert('Gagal menyimpan: ' + error.message, 'danger');
        } else {
            window.showToast('Transaksi Berhasil Disimpan', 'success');
            modalDeposit.classList.remove('active');
            refreshData();
        }
    };

    window.deleteDeposit = (id) => {
        window.showConfirm('Hapus transaksi ini?', async () => {
            const { error } = await supabase.from('keuangan').delete().eq('id', id);
            if (error) window.showAlert('Gagal menghapus: ' + error.message, 'danger');
            else { window.showToast('Terhapus'); refreshData(); }
        }, null, 'Hapus Riwayat', 'Ya, Hapus', 'btn-danger');
    };

    window.viewAgentHistory = (name) => {
        // Simple search filter in table or just show toast for now
        window.showToast('Menampilkan riwayat ' + name);
        // Find in history table and highlight
        const rows = tableBodyRiwayat.querySelectorAll('tr');
        rows.forEach(r => {
            if (r.children[1].textContent === name) r.style.backgroundColor = 'rgba(var(--primary-rgb), 0.1)';
            else r.style.backgroundColor = '';
        });
    };

    // Initial Load
    refreshData();
});
