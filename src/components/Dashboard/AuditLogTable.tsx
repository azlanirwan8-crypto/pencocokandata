import React from 'react';
import { History, Download, Clock, UserCheck } from 'lucide-react';
import type { BatchLog } from '../../types';
import { exportTargetToExcel } from '../../utils/excel';

interface AuditLogTableProps {
  logs: BatchLog[];
}

export const AuditLogTable: React.FC<AuditLogTableProps> = ({ logs }) => {
  const handleRedownload = (log: BatchLog) => {
    exportTargetToExcel(log.dataSnapshot, 'BATCH_HISTORY', log.totalRows, false);
  };

  return (
    <div className="glass-card" style={{ marginTop: '1.5rem' }}>
      <div className="section-header">
        <div>
          <h2 className="section-title" style={{ fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <History size={18} color="var(--accent-blue)" />
            Audit Log & Riwayat Batch
          </h2>
          <p className="section-subtitle">
            Riwayat pemrosesan berkas transaksi sebelumnya, durasi eksekusi, dan tautan unduh ulang.
          </p>
        </div>
      </div>

      <div className="table-container" style={{ marginTop: '1rem' }}>
        <table className="modern-table">
          <thead>
            <tr>
              <th>Waktu Unggah</th>
              <th>Nama File Target</th>
              <th>User Pengunggah</th>
              <th>Total Baris</th>
              <th>Matching Rate</th>
              <th>PTEN Discrepancy</th>
              <th>Durasi Eksekusi</th>
              <th style={{ textAlign: 'center' }}>Aksi Unduh Ulang</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                  Belum ada riwayat batch pemrosesan. Jalankan pencocokan di Menu 3 untuk merekam batch log.
                </td>
              </tr>
            ) : (
              logs.map((log) => {
                const matchRate = log.totalRows > 0 ? ((log.matchedCount / log.totalRows) * 100).toFixed(1) : '0.0';
                return (
                  <tr key={log.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)' }}>
                        <Clock size={13} />
                        <span>{log.timestamp}</span>
                      </div>
                    </td>
                    <td>
                      <strong style={{ color: 'var(--text-primary)' }}>{log.fileName}</strong>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <UserCheck size={13} color="#94a3b8" />
                        <span>{log.uploader}</span>
                      </div>
                    </td>
                    <td className="code-cell">{log.totalRows.toLocaleString('id-ID')}</td>
                    <td>
                      <span className="badge badge-match">{matchRate}% ({log.matchedCount})</span>
                    </td>
                    <td>
                      {log.ptenDiscrepancyCount > 0 ? (
                        <span className="badge badge-diff">{log.ptenDiscrepancyCount} Selisih</span>
                      ) : (
                        <span className="badge badge-match">0 Selisih</span>
                      )}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', color: '#93c5fd' }}>
                      {log.durationMs} ms
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => handleRedownload(log)}
                        title="Unduh ulang berkas hasil pemrosesan batch ini"
                      >
                        <Download size={13} />
                        <span>Unduh Excel</span>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
