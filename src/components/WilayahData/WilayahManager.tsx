import React, { useState, useEffect } from 'react';
import {
  Map,
  Plus,
  Trash2,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Info,
  Sparkles,
  ArrowRight,
  Database
} from 'lucide-react';
import type { WilayahSetting } from '../../types';
import { loadWilayahFromNeon, saveWilayahToNeon } from '../../utils/neonSync';

export const WilayahManager: React.FC = () => {
  const [settings, setSettings] = useState<WilayahSetting[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await loadWilayahFromNeon();
        if (data && Array.isArray(data)) {
          setSettings(data);
        } else {
          setSettings([]);
        }
      } catch (err) {
        console.error('Gagal mengambil data wilayah:', err);
        setError('Gagal memuat data wilayah dari server.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const handleAdd = () => {
    setSettings(prev => [...prev, { kodeWilayah: '', keterangan: '' }]);
  };

  const handleRemove = (index: number) => {
    setSettings(prev => prev.filter((_, i) => i !== index));
  };

  const handleChange = (index: number, field: keyof WilayahSetting, value: string) => {
    setSettings(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleLoadSamples = () => {
    const samples: WilayahSetting[] = [
      { kodeWilayah: '01', keterangan: 'Wilayah 1' },
      { kodeWilayah: '02', keterangan: 'Wilayah 2' },
      { kodeWilayah: '03', keterangan: 'Wilayah 3' },
      { kodeWilayah: '04', keterangan: 'Wilayah 4' },
      { kodeWilayah: '05', keterangan: 'Wilayah 5' },
    ];
    setSettings(samples);
  };

  const handleSave = async () => {
    // Validasi baris kosong
    const emptyRows = settings.filter(
      s => !s.kodeWilayah.trim() || !s.keterangan.trim()
    );

    if (emptyRows.length > 0) {
      setError('Kode Wilayah dan Keterangan tidak boleh ada yang kosong.');
      setTimeout(() => setError(null), 4000);
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccessMsg(null);

    const success = await saveWilayahToNeon(settings);
    setIsSaving(false);

    if (success) {
      setSuccessMsg('Data setting wilayah berhasil disimpan ke database cloud!');
      setTimeout(() => setSuccessMsg(null), 3500);
    } else {
      setError('Gagal menyimpan perubahan ke Neon database.');
      setTimeout(() => setError(null), 4000);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
      {/* Top Header Card (Velzon Section Header) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
          marginBottom: '0.1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '5px',
              background: 'rgba(64, 81, 137, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#405189',
            }}
          >
            <Map size={17} />
          </div>
          <div>
            <h3 style={{ fontSize: '0.96rem', fontWeight: 600, color: '#212529', margin: 0 }}>
              Setting Wilayah
            </h3>
            <p style={{ fontSize: '0.76rem', color: '#878a99', margin: 0 }}>
              Kelola pemetaan 2 digit kode branch ke nama wilayah untuk pengayaan otomatis file Excel.
            </p>
          </div>
        </div>

        {/* Action Buttons Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
          {settings.length === 0 && !isLoading && (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={handleLoadSamples}
              title="Isi dengan contoh wilayah 1-5"
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <Sparkles size={12} style={{ color: '#d68b0c' }} />
              <span>Muat Contoh</span>
            </button>
          )}

          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={handleAdd}
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <Plus size={13} />
            <span>Tambah Wilayah</span>
          </button>

          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleSave}
            disabled={isLoading || isSaving}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.32rem 0.85rem',
            }}
          >
            {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            <span>{isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}</span>
          </button>
        </div>
      </div>

      {/* Alert Notifications */}
      {error && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.65rem 0.95rem',
            borderRadius: '4px',
            background: 'rgba(240, 101, 72, 0.08)',
            border: '1px solid rgba(240, 101, 72, 0.25)',
            color: '#f06548',
            fontSize: '0.78rem',
          }}
        >
          <AlertCircle size={15} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.65rem 0.95rem',
            borderRadius: '4px',
            background: 'rgba(10, 179, 156, 0.08)',
            border: '1px solid rgba(10, 179, 156, 0.25)',
            color: '#0ab39c',
            fontSize: '0.78rem',
          }}
        >
          <CheckCircle2 size={15} style={{ flexShrink: 0 }} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Main Card Container (Velzon Glass Card) */}
      <div className="glass-card" style={{ padding: '1rem 1.25rem' }}>
        {/* Table Sub-header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.5rem',
            marginBottom: '0.75rem',
          }}
        >
          <div style={{ fontSize: '0.8rem', color: '#878a99' }}>
            Total <strong style={{ color: '#212529' }}>{settings.length}</strong> aturan pemetaan wilayah aktif.
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.72rem', color: '#0ab39c' }}>
            <Database size={12} />
            <span>Tersinkronisasi otomatis dengan Database Cloud</span>
          </div>
        </div>

        {/* Loading Spinner */}
        {isLoading ? (
          <div
            style={{
              padding: '3rem 1rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.65rem',
              color: '#878a99',
            }}
          >
            <Loader2 size={24} className="animate-spin" style={{ color: '#405189' }} />
            <span style={{ fontSize: '0.8rem' }}>Memuat konfigurasi wilayah...</span>
          </div>
        ) : settings.length === 0 ? (
          /* Empty State */
          <div
            style={{
              padding: '2.5rem 1.5rem',
              textAlign: 'center',
              borderRadius: '6px',
              border: '1px dashed #ced4da',
              background: '#f8f9fa',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.6rem',
            }}
          >
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                background: 'rgba(64, 81, 137, 0.08)',
                color: '#405189',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Map size={20} />
            </div>
            <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#212529', margin: 0 }}>
              Belum Ada Aturan Wilayah
            </h4>
            <p style={{ fontSize: '0.77rem', color: '#878a99', maxWidth: '380px', margin: 0 }}>
              Tambahkan aturan digit branch code untuk secara otomatis memetakan baris data Excel ke wilayah terkait.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem' }}>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={handleLoadSamples}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <Sparkles size={12} style={{ color: '#d68b0c' }} />
                <span>Muat Contoh (01 s/d 05)</span>
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleAdd}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <Plus size={13} />
                <span>Tambah Wilayah Baru</span>
              </button>
            </div>
          </div>
        ) : (
          /* Velzon Modern Table */
          <div className="table-container" style={{ border: '1px solid #e9ebec', borderRadius: '6px' }}>
            <table className="modern-table">
              <thead>
                <tr>
                  <th style={{ width: '45px', textAlign: 'center' }}>No</th>
                  <th style={{ width: '220px' }}>Kode Wilayah (Digit Ke 2 & 3)</th>
                  <th>Keterangan Wilayah</th>
                  <th style={{ width: '180px' }}>Preview Pencocokan</th>
                  <th style={{ width: '65px', textAlign: 'center' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {settings.map((item, idx) => {
                  const sampleCode = item.kodeWilayah ? `6${item.kodeWilayah}0012` : '6XX0012';
                  return (
                    <tr
                      key={idx}
                      style={{
                        background: idx % 2 === 0 ? '#fafbfe' : '#ffffff',
                      }}
                    >
                      {/* Kolom No */}
                      <td className="code-cell" style={{ textAlign: 'center', color: '#878a99' }}>
                        {idx + 1}
                      </td>

                      {/* Kolom Kode Wilayah */}
                      <td>
                        <input
                          type="text"
                          value={item.kodeWilayah}
                          onChange={(e) => handleChange(idx, 'kodeWilayah', e.target.value.trim().toUpperCase())}
                          placeholder="Misal: 01"
                          maxLength={5}
                          style={{
                            width: '100%',
                            maxWidth: '180px',
                            padding: '0.32rem 0.6rem',
                            fontSize: '0.78rem',
                            fontFamily: 'var(--font-mono)',
                            fontWeight: 700,
                            borderRadius: '4px',
                            border: '1px solid #ced4da',
                            background: '#ffffff',
                            color: '#405189',
                            outline: 'none',
                            transition: 'border-color 0.15s',
                          }}
                          onFocus={(e) => (e.target.style.borderColor = '#405189')}
                          onBlur={(e) => (e.target.style.borderColor = '#ced4da')}
                        />
                      </td>

                      {/* Kolom Keterangan Wilayah */}
                      <td>
                        <input
                          type="text"
                          value={item.keterangan}
                          onChange={(e) => handleChange(idx, 'keterangan', e.target.value)}
                          placeholder="Misal: Wilayah 1"
                          style={{
                            width: '100%',
                            padding: '0.32rem 0.6rem',
                            fontSize: '0.78rem',
                            borderRadius: '4px',
                            border: '1px solid #ced4da',
                            background: '#ffffff',
                            color: '#212529',
                            outline: 'none',
                            transition: 'border-color 0.15s',
                          }}
                          onFocus={(e) => (e.target.style.borderColor = '#405189')}
                          onBlur={(e) => (e.target.style.borderColor = '#ced4da')}
                        />
                      </td>

                      {/* Kolom Preview Visual */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.72rem' }}>
                          <span
                            className="code-cell"
                            style={{
                              background: '#f3f6f9',
                              padding: '0.12rem 0.35rem',
                              borderRadius: '3px',
                              border: '1px solid #e9ebec',
                              fontSize: '0.72rem',
                            }}
                          >
                            {sampleCode}
                          </span>
                          <ArrowRight size={11} style={{ color: '#878a99' }} />
                          <span className="badge badge-match">
                            {item.keterangan || 'Wilayah'}
                          </span>
                        </div>
                      </td>

                      {/* Kolom Hapus */}
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => handleRemove(idx)}
                          title="Hapus baris ini"
                          style={{
                            background: 'rgba(240, 101, 72, 0.08)',
                            border: '1px solid rgba(240, 101, 72, 0.25)',
                            color: '#f06548',
                            borderRadius: '4px',
                            padding: '0.28rem 0.45rem',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(240, 101, 72, 0.18)')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(240, 101, 72, 0.08)')}
                        >
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Action Tambah Baris di Bawah Tabel */}
        {settings.length > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: '0.75rem',
            }}
          >
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={handleAdd}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <Plus size={12} />
              <span>Tambah Baris</span>
            </button>

            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleSave}
              disabled={isLoading || isSaving}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            >
              {isSaving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
              <span>Simpan Perubahan</span>
            </button>
          </div>
        )}
      </div>

      {/* Information Box (Velzon Info Banner) */}
      <div
        style={{
          background: 'rgba(64, 81, 137, 0.04)',
          border: '1px solid rgba(64, 81, 137, 0.15)',
          borderRadius: '6px',
          padding: '0.85rem 1.15rem',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.75rem',
        }}
      >
        <div
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            background: 'rgba(64, 81, 137, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#405189',
            flexShrink: 0,
            marginTop: '0.1rem',
          }}
        >
          <Info size={15} />
        </div>
        <div style={{ flex: 1, fontSize: '0.78rem', color: '#495057', lineHeight: '1.5' }}>
          <strong style={{ color: '#212529', display: 'block', marginBottom: '0.2rem', fontSize: '0.82rem' }}>
            Cara Kerja Logika Pemetaan Wilayah:
          </strong>
          <p style={{ margin: '0 0 0.4rem' }}>
            Pada saat berkas Excel diunggah (baik Data Master maupun Data Target Cek), sistem akan secara otomatis memeriksa kolom{' '}
            <strong style={{ color: '#212529' }}>Branch Code / Kode Cabang</strong>.
          </p>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              flexWrap: 'wrap',
              background: '#ffffff',
              padding: '0.45rem 0.75rem',
              borderRadius: '4px',
              border: '1px solid #e9ebec',
              width: 'fit-content',
            }}
          >
            <span>Contoh Branch Code:</span>
            <span
              className="code-cell"
              style={{
                background: '#f3f6f9',
                padding: '0.12rem 0.4rem',
                borderRadius: '3px',
                border: '1px solid #ced4da',
              }}
            >
              6<span style={{ color: '#0ab39c', fontWeight: 800, textDecoration: 'underline' }}>01</span>15601
            </span>
            <ArrowRight size={13} style={{ color: '#878a99' }} />
            <span>Diekstrak digit ke-2 & ke-3:</span>
            <span className="badge badge-level1" style={{ fontSize: '0.72rem' }}>
              01
            </span>
            <ArrowRight size={13} style={{ color: '#878a99' }} />
            <span>Otomatis diisi Wilayah:</span>
            <span className="badge badge-match" style={{ fontSize: '0.72rem' }}>
              Wilayah 1
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
