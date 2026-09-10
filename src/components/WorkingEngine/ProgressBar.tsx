import React from 'react';
import { Activity, Clock, Zap } from 'lucide-react';

interface ProgressBarProps {
  isProcessing: boolean;
  progress: number;
  processedCount: number;
  totalCount: number;
  durationMs: number;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  isProcessing,
  progress,
  processedCount,
  totalCount,
  durationMs,
}) => {
  if (!isProcessing && progress === 0) return null;

  const rowsPerSec = durationMs > 0 ? Math.round((processedCount / (durationMs / 1000))) : 0;

  return (
    <div className="progress-container" style={{ margin: '1.25rem 0' }}>
      <div className="progress-header">
        <div className="progress-label">
          <Activity size={18} className={isProcessing ? 'pulse-dot' : ''} />
          <span>
            {isProcessing ? 'Memproses Cascade Matching Engine (Anti-Stopper Chunk Stream)...' : 'Pencocokan Bertingkat Selesai 100%'}
          </span>
        </div>
        <div className="progress-pct">{progress}%</div>
      </div>

      <div className="progress-bar-bg">
        <div
          className="progress-bar-inner"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
        <div>
          Progres: <strong style={{ color: '#ffffff', fontFamily: 'var(--font-mono)' }}>{processedCount.toLocaleString('id-ID')}</strong> / {totalCount.toLocaleString('id-ID')} Baris
        </div>
        <div style={{ display: 'flex', gap: '1rem', fontFamily: 'var(--font-mono)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#93c5fd' }}>
            <Clock size={13} />
            <span>{durationMs} ms</span>
          </span>
          {rowsPerSec > 0 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#34d399' }}>
              <Zap size={13} />
              <span>{rowsPerSec.toLocaleString('id-ID')} baris/detik</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
