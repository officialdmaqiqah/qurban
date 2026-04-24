// Mock data and logic test to verify identicality
const parseNum = (val) => {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    return parseFloat(String(val).replace(/[^0-9.-]+/g, "")) || 0;
};

function calculateNetProfit(trxs, fin, start, end) {
    let omzet = 0, hpp = 0, komisi = 0, saving = 0;
    let opex = 0, deadLossRaw = 0, deadKomp = 0;

    // OMZET BLOCK
    trxs.forEach(t => {
        omzet += parseNum(t.total_deal || t.totalDeal);
        if(t.added_cost) omzet += parseNum(t.added_cost);
        if(t.admin_fee) omzet += parseNum(t.admin_fee);

        (t.items || []).forEach(it => {
            hpp += parseNum(it.hargaNota);
            saving += parseNum(it.saving);
        });
        komisi += parseNum(t.komisi?.nominal);
    });

    // KEUANGAN BLOCK
    fin.forEach(f => {
        const nom = parseNum(f.nominal);
        const katLine = (f.kategori || '').toLowerCase().trim();
        const isNonKas = (f.channel || '').toLowerCase().includes('non-kas');

        if (isNonKas) {
            if (f.tipe === 'pengeluaran') deadLossRaw += nom;
            else if (f.tipe === 'pemasukan') deadKomp += nom;
        } else {
            if (f.tipe === 'pengeluaran') {
                const isPurchasing = katLine.includes('bayar supplier') || katLine.includes('pelunasan supplier') || katLine.includes('beli kambing');
                const isExclusion = isPurchasing || katLine.includes('komisi') || katLine.includes('bagi hasil') || katLine.includes('mutasi') || katLine.includes('titipan');
                
                if (!isExclusion) {
                    opex += nom;
                }
            } else if (f.tipe === 'pemasukan') {
                if (katLine.includes('kompensasi')) {
                    deadKomp += nom;
                }
            }
        }
    });

    const deadLossNet = deadLossRaw - deadKomp;
    const netProfit = omzet - hpp - komisi - opex - deadLossNet - saving;
    
    return { omzet, hpp, komisi, opex, deadLossNet, saving, netProfit };
}

// Test with the 1.000.000 case
const mockTrxs = [
    { total_deal: 126250000, items: [{hargaNota: 78100000, saving: 3600000}], komisi: {nominal: 5480000} }
];
const mockTrxsWithAdded = [
    { total_deal: 126250000, added_cost: 1000000, items: [{hargaNota: 78100000, saving: 3600000}], komisi: {nominal: 5480000} }
];
const mockFin = [
    { nominal: 17411150, tipe: 'pengeluaran', kategori: 'Biaya Operasional', channel: 'Tunai' },
    { nominal: 4100000, tipe: 'pengeluaran', kategori: 'Kerugian Mati', channel: 'Non-Kas' },
    { nominal: 2100000, tipe: 'pemasukan', kategori: 'Kompensasi Supplier', channel: 'Tunai' }
];

const resultOldReportStyle = calculateNetProfit(mockTrxs, mockFin);
const resultNewStyle = calculateNetProfit(mockTrxsWithAdded, mockFin);

console.log('Result Without Added Cost:', resultOldReportStyle.netProfit);
console.log('Result With Added Cost:', resultNewStyle.netProfit);
console.log('Difference:', resultNewStyle.netProfit - resultOldReportStyle.netProfit);
