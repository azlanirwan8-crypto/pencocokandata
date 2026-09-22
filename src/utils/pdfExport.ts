import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { TargetRow } from '../types';
import type { AnalystRow } from './analystPipeline';
import { formatWilayahName } from './normalizer';

interface ExportPdfOptions {
  wilayahLabel: string;
  rows: TargetRow[];
  totalTargetRows?: number;
}

/**
 * Generate a professional executive PDF document for Matched Data
 */
export function exportMatchedDataToPdf({
  wilayahLabel,
  rows,
  totalTargetRows = rows.length,
}: ExportPdfOptions): { success: boolean; filename: string; error?: string } {
  try {
    // Landscape A4 for wide table presentation
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const cleanWilayahName = formatWilayahName(wilayahLabel);
    const dateStr = new Date().toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    // 1. TOP CORPORATE HEADER BANNER
    doc.setFillColor(33, 37, 41); // Slate 800 (#212529)
    doc.rect(0, 0, pageWidth, 24, 'F');

    // Accent line
    doc.setFillColor(41, 156, 219); // Sky 500 (#299cdb)
    doc.rect(0, 24, pageWidth, 1.5, 'F');

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text('LAPORAN HASIL PENCOCOKAN DATA (DATA MATCH)', 14, 11);

    // Subtitle
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(206, 212, 218); // Slate 300
    doc.text('Sistem Rekonsiliasi & Validasi Master Cabang Operasional', 14, 18);

    // Date & Wilayah on the right
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text(cleanWilayahName.toUpperCase(), pageWidth - 14, 11, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(206, 212, 218);
    doc.text(`Dicetak: ${dateStr}`, pageWidth - 14, 18, { align: 'right' });

    // 2. EXECUTIVE METRIC SUMMARY BOXES (Cards)
    const matchRate = totalTargetRows > 0 ? ((rows.length / totalTargetRows) * 100).toFixed(1) : '100.0';

    const cardY = 30;
    const cardH = 14;
    const cardGap = 4;
    const cardW = (pageWidth - 28 - cardGap * 3) / 4;

    const cards = [
      { label: 'WILAYAH LINGKUP', val: cleanWilayahName, bg: [248,249,250], border: [233,235,236], textCol: [33,37,41] },
      { label: 'DATA BERSIH COCOK', val: `${rows.length.toLocaleString('id-ID')} Data`, bg: [232,247,245], border: [183,235,228], textCol: [10,179,156] },
      { label: 'TOTAL DATA TARGET', val: `${totalTargetRows.toLocaleString('id-ID')} Baris`, bg: [243,246,249], border: [206,212,218], textCol: [73,80,87] },
      { label: 'TINGKAT KEBERHASILAN', val: `${matchRate}% Selesai`, bg: [236,234,249], border: [218,213,243], textCol: [101,89,204] },
    ];

    cards.forEach((c, idx) => {
      const cx = 14 + idx * (cardW + cardGap);
      doc.setFillColor(c.bg[0], c.bg[1], c.bg[2]);
      doc.setDrawColor(c.border[0], c.border[1], c.border[2]);
      doc.roundedRect(cx, cardY, cardW, cardH, 1.5, 1.5, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(135, 138, 153); // Slate 500
      doc.text(c.label, cx + 4, cardY + 5);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(c.textCol[0], c.textCol[1], c.textCol[2]);
      doc.text(c.val, cx + 4, cardY + 11);
    });

    // 3. TABLE BODY MAPPING
    const tableColumns = [
      { header: 'No', dataKey: 'no' },
      { header: 'Wilayah', dataKey: 'wilayah' },
      { header: 'Sandi Cabang (Master)', dataKey: 'sandi' },
      { header: 'Nama Outlet (Master)', dataKey: 'outlet' },
      { header: 'Alamat Cabang Master', dataKey: 'alamatMaster' },
      { header: 'Kode Pos', dataKey: 'kodePos' },
      { header: 'Kecamatan', dataKey: 'kecamatan' },
      { header: 'Dati II / Kota', dataKey: 'dati' },
      { header: 'Alamat Target', dataKey: 'alamatTarget' },
    ];

    const tableRows = rows.map((r, idx) => ({
      no: r.No ?? idx + 1,
      wilayah: formatWilayahName(r.Wilayah),
      sandi: r['Sandi Cabang'] || r.Cabang || r.Sandi || '-',
      outlet: r['Nama Outlet'] || '-',
      alamatMaster: r.ALAMAT || '-',
      kodePos: r['KODE POS'] || '-',
      kecamatan: r.Kecamatan || '-',
      dati: r['Dati II'] || '-',
      alamatTarget: r.ALAMAT || '-',
    }));

    autoTable(doc, {
      startY: cardY + cardH + 5,
      columns: tableColumns,
      body: tableRows,
      theme: 'grid',
      styles: {
        fontSize: 7.2,
        font: 'helvetica',
        cellPadding: 1.8,
        lineColor: [233,235,236], // Slate 200
        lineWidth: 0.1,
        textColor: [33,37,41],
      },
      headStyles: {
        fillColor: [33,37,41], // Slate 800
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7.5,
        halign: 'left',
      },
      alternateRowStyles: {
        fillColor: [248,249,250], // Slate 50
      },
      columnStyles: {
        no: { cellWidth: 10, halign: 'center' },
        wilayah: { cellWidth: 20 },
        sandi: { cellWidth: 28, fontStyle: 'bold' },
        outlet: { cellWidth: 32 },
        alamatMaster: { cellWidth: 50 },
        kodePos: { cellWidth: 16, halign: 'center' },
        kecamatan: { cellWidth: 26 },
        dati: { cellWidth: 26 },
        alamatTarget: { cellWidth: 'auto' },
      },
      margin: { left: 14, right: 14, bottom: 14 },
      didDrawPage: (data) => {
        // FOOTER ON EACH PAGE
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(173, 181, 189); // Slate 400
        doc.text(
          'Dokumen Hasil Pencocokan Data Bersih & Terverifikasi • Diproduksi oleh Data Matcher System',
          14,
          pageHeight - 6
        );

        const pageStr = `Halaman ${data.pageNumber}`;
        doc.text(pageStr, pageWidth - 14, pageHeight - 6, { align: 'right' });
      },
    });

    const safeLabel = cleanWilayahName.replace(/\s+/g, '_');
    const filename = `Data_Match_${safeLabel}.pdf`;
    doc.save(filename);

    return {
      success: true,
      filename,
    };
  } catch (err: any) {
    console.error('PDF export error:', err);
    return {
      success: false,
      filename: '',
      error: err?.message || 'Gagal membuat dokumen PDF.',
    };
  }
}

interface AnalystPdfOptions {
  rows: AnalystRow[];
  stats: {
    total: number;
    exact: number;
    highConf: number;
    anomalies: number;
    approved: number;
    role3Complete: number;
    accuracyRate: string;
  };
  wilayahCount: number;
}

export function exportAnalystExecutivePdf({
  rows,
  stats,
  wilayahCount,
}: AnalystPdfOptions): { success: boolean; filename: string; error?: string } {
  try {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const dateStr = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

    // 1. HEADER BANNER
    doc.setFillColor(33, 37, 41);
    doc.rect(0, 0, pageWidth, 24, 'F');
    doc.setFillColor(10, 179, 156);
    doc.rect(0, 24, pageWidth, 1.5, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text('HASIL EKSEKUTIF ANALISA DATA MASTER', 14, 11);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(206, 212, 218);
    doc.text('Data Analyst Engine — Pipeline 3 Fase dengan Multi-Tier AI Analytics', 14, 18);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text(`Laporan: ${dateStr}`, pageWidth - 14, 11, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(206, 212, 218);
    doc.text(`${stats.total.toLocaleString('id-ID')} Data | ${wilayahCount} Wilayah`, pageWidth - 14, 18, { align: 'right' });

    // 2. EXECUTIVE KPI CARDS
    const cardY = 30;
    const cardH = 14;
    const cardGap = 4;
    const cardW = (pageWidth - 28 - cardGap * 4) / 5;

    const cards = [
      { label: 'TOTAL DATA', val: `${stats.total.toLocaleString('id-ID')}`, bg: [243,246,249], border: [206,212,218], textCol: [73,80,87] },
      { label: 'AKURASI ENGINE', val: `${stats.accuracyRate}%`, bg: [232,247,245], border: [183,235,228], textCol: [10,179,156] },
      { label: 'FASE 1: PTEN & POS', val: '100% Terpetakan', bg: [235,242,252], border: [170,205,248], textCol: [53,119,241] },
      { label: 'FASE 2: WILAYAH', val: `${wilayahCount} Kanwil`, bg: [236,234,249], border: [218,213,243], textCol: [101,89,204] },
      { label: 'FASE 3: 3 ROLE', val: `${stats.role3Complete} Lengkap`, bg: [232,247,245], border: [183,235,228], textCol: [10, 179, 156] },
    ];

    cards.forEach((c, idx) => {
      const cx = 14 + idx * (cardW + cardGap);
      doc.setFillColor(c.bg[0], c.bg[1], c.bg[2]);
      doc.setDrawColor(c.border[0], c.border[1], c.border[2]);
      doc.roundedRect(cx, cardY, cardW, cardH, 1.5, 1.5, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(135, 138, 153);
      doc.text(c.label, cx + 4, cardY + 5);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(c.textCol[0], c.textCol[1], c.textCol[2]);
      doc.text(c.val, cx + 4, cardY + 11);
    });

    // 3. SUMMARY TABLE
    const tableColumns = [
      { header: 'No', dataKey: 'no' },
      { header: 'Wilayah', dataKey: 'wilayah' },
      { header: 'Nama Outlet', dataKey: 'outlet' },
      { header: 'Kota PTEN', dataKey: 'kota' },
      { header: 'Kode Pos', dataKey: 'kodePos' },
      { header: 'Kelurahan', dataKey: 'kelurahan' },
      { header: 'Kecamatan', dataKey: 'kecamatan' },
      { header: 'Organisasi Tujuan', dataKey: 'org' },
      { header: 'Tipe', dataKey: 'tipe' },
      { header: '3 Role', dataKey: 'role' },
      { header: 'Alur Wondr', dataKey: 'wondr' },
      { header: 'Status', dataKey: 'status' },
    ];

    const tableRows = rows.map((r, idx) => ({
      no: idx + 1,
      wilayah: r.wilayah,
      outlet: r.namaOutlet,
      kota: r.kotaPtenMax15 || r.kotaPten,
      kodePos: r.kodePosKelurahan || r.kodePosPten,
      kelurahan: r.kelurahan,
      kecamatan: r.kecamatan,
      org: r.organisasiTujuan,
      tipe: r.tipeUnit,
      role: r.is3RoleLengkap ? 'Lengkap' : 'Parsial',
      wondr: r.alurWondr,
      status: r.isFinalApproved ? 'VERIFIED' : r.statusAnalisa,
    }));

    autoTable(doc, {
      startY: cardY + cardH + 5,
      columns: tableColumns,
      body: tableRows,
      theme: 'grid',
      styles: {
        fontSize: 7,
        font: 'helvetica',
        cellPadding: 1.5,
        lineColor: [233,235,236],
        lineWidth: 0.1,
        textColor: [33,37,41],
      },
      headStyles: {
        fillColor: [33,37,41],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7.2,
        halign: 'left',
      },
      alternateRowStyles: {
        fillColor: [248,249,250],
      },
      columnStyles: {
        no: { cellWidth: 10, halign: 'center' },
        wilayah: { cellWidth: 18 },
        outlet: { cellWidth: 32 },
        kota: { cellWidth: 22 },
        kodePos: { cellWidth: 14, halign: 'center' },
        kelurahan: { cellWidth: 24 },
        kecamatan: { cellWidth: 24 },
        org: { cellWidth: 36 },
        tipe: { cellWidth: 12, halign: 'center' },
        role: { cellWidth: 14, halign: 'center' },
        wondr: { cellWidth: 28 },
        status: { cellWidth: 18, halign: 'center', fontStyle: 'bold' },
      },
      margin: { left: 14, right: 14, bottom: 14 },
      didDrawPage: (data) => {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(173, 181, 189);
        doc.text(
          'Laporan Executive Data Analyst Engine • 3 Fase Pipeline Analysis • Multi-Engine Precision Matching',
          14,
          pageHeight - 6
        );
        const pageStr = `Halaman ${data.pageNumber}`;
        doc.text(pageStr, pageWidth - 14, pageHeight - 6, { align: 'right' });
      },
    });

    const filename = `Executive_Summary_Analista_${new Date().toISOString().slice(0, 10)}.pdf`;
    doc.save(filename);

    return { success: true, filename };
  } catch (err: any) {
    console.error('Analyst PDF export error:', err);
    return { success: false, filename: '', error: err?.message || 'Gagal membuat dokumen PDF.' };
  }
}

interface FinalPdfOptions {
  wilayahLabel: string;
  rows: AnalystRow[];
  /** Jumlah baris wilayah itu SEBELUM disaring bersih — untuk kartu persentase. */
  totalRows?: number;
}

/**
 * PDF per wilayah dari DATA FINAL: 13 kolom yang sama dengan tabel menu Final Data.
 * (Laporan lama `exportMatchedDataToPdf` memakai kolom alur Target dan dua kali
  * mencetak alamat yang sama — kolom itu dihapus di sini.)
 */
export function exportFinalRowsToPdf({
  wilayahLabel,
  rows,
  totalRows = rows.length,
}: FinalPdfOptions): { success: boolean; filename: string; error?: string } {
  try {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const cleanWilayahName = formatWilayahName(wilayahLabel);
    const dateStr = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

    doc.setFillColor(33, 37, 41);
    doc.rect(0, 0, pageWidth, 24, 'F');
    doc.setFillColor(10, 179, 156);
    doc.rect(0, 24, pageWidth, 1.5, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text('LAPORAN DATA FINAL — PENEMPATAN CABANG PER KELURAHAN', 14, 11);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(206, 212, 218);
    doc.text('Hasil analisa 3 fase yang sudah disetujui (Data Final)', 14, 18);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text(cleanWilayahName.toUpperCase(), pageWidth - 14, 11, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(206, 212, 218);
    doc.text(`Dicetak: ${dateStr}`, pageWidth - 14, 18, { align: 'right' });

    const share = totalRows > 0 ? ((rows.length / totalRows) * 100).toFixed(1) : '100.0';
    const cardY = 30;
    const cardH = 14;
    const cardGap = 4;
    const cardW = (pageWidth - 28 - cardGap * 2) / 3;
    const cards = [
      { label: 'WILAYAH LINGKUP', val: cleanWilayahName, textCol: [33,37,41] },
      { label: 'BARIS TERCETAK', val: `${rows.length.toLocaleString('id-ID')} Baris`, textCol: [10,179,156] },
      { label: 'TOTAL BARIS WILAYAH', val: `${totalRows.toLocaleString('id-ID')} Baris · ${share}%`, textCol: [73,80,87] },
    ];
    cards.forEach((c, idx) => {
      const cx = 14 + idx * (cardW + cardGap);
      doc.setFillColor(248, 249, 250);
      doc.setDrawColor(233, 235, 236);
      doc.roundedRect(cx, cardY, cardW, cardH, 1.5, 1.5, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(135, 138, 153);
      doc.text(c.label, cx + 4, cardY + 5);
      doc.setFontSize(9.5);
      doc.setTextColor(c.textCol[0], c.textCol[1], c.textCol[2]);
      doc.text(c.val, cx + 4, cardY + 11);
    });

    const tableRows = rows.map((r, i) => ({
      no: i + 1,
      wilayah: r.wilayah || '-',
      sandi: r.sandiCabang || '-',
      branch: r.branchCode || '-',
      kode: r.kodeCabang || '-',
      outlet: r.namaOutlet || '-',
      status: r.statusOutlet || '-',
      alamat: r.alamat || '-',
      kodepos: r.kodePosKelurahan || r.kodePosPten || '-',
      kelurahan: r.kelurahan || '-',
      kecamatan: r.kecamatan || '-',
      dati: r.kotaPtenMax15 || r.kotaPten || '-',
      provinsi: r.provinsi || '-',
    }));

    autoTable(doc, {
      startY: cardY + cardH + 5,
      head: [[
        'No', 'Wilayah', 'Sandi Cabang', 'Branch Code', 'Kode Cabang', 'Nama Outlet', 'Status Outlet',
        'ALAMAT', 'KODE POS', 'Kelurahan', 'Kecamatan', 'Dati II', 'Provinsi',
      ]],
      body: tableRows,
      theme: 'grid',
      styles: { fontSize: 6.4, font: 'helvetica', cellPadding: 1.4, lineColor: [233,235,236], lineWidth: 0.1, textColor: [33,37,41] },
      headStyles: { fillColor: [64,81,137], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 6.6 },
      alternateRowStyles: { fillColor: [248,249,250] },
      columnStyles: {
        0: { cellWidth: 7, halign: 'center' },
        1: { cellWidth: 13, halign: 'center' },
        2: { cellWidth: 19 },
        3: { cellWidth: 17, halign: 'center' },
        4: { cellWidth: 17, halign: 'center' },
        5: { cellWidth: 30 },
        6: { cellWidth: 13, halign: 'center' },
        7: { cellWidth: 44 },
        8: { cellWidth: 14, halign: 'center' },
        9: { cellWidth: 24 },
        10: { cellWidth: 22 },
        11: { cellWidth: 20 },
        12: { cellWidth: 'auto' },
      },
      margin: { left: 14, right: 14, bottom: 14 },
      didDrawPage: (data) => {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(173, 181, 189);
        doc.text('Data Final — penempatan kelurahan ke cabang hasil analisa 3 fase • Data Matcher System', 14, pageHeight - 6);
        doc.text(`Halaman ${data.pageNumber}`, pageWidth - 14, pageHeight - 6, { align: 'right' });
      },
    });

    const filename = `Data_Final_${cleanWilayahName.replace(/\s+/g, '_')}.pdf`;
    doc.save(filename);
    return { success: true, filename };
  } catch (err: any) {
    console.error('Final PDF export error:', err);
    return { success: false, filename: '', error: err?.message || 'Gagal membuat dokumen PDF.' };
  }
}
