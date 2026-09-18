import React, { useState, useEffect } from 'react';
import { X, Save, Edit, MapPin, Building2, Users } from 'lucide-react';
import type { AnalystRow } from '../../utils/analystPipeline';
import type { WilayahSetting } from '../../types';

interface AnalystRowEditModalProps {
  isOpen: boolean;
  row: AnalystRow | null;
  onClose: () => void;
  onSave: (updatedRow: AnalystRow) => void;
  wilayahSettings: WilayahSetting[];
  phase: 'fase1' | 'fase2' | 'fase3' | 'final';
}

export const AnalystRowEditModal: React.FC<AnalystRowEditModalProps> = ({
  isOpen,
  row,
  onClose,
  onSave,
  wilayahSettings,
  phase,
}) => {
  const [formData, setFormData] = useState<AnalystRow | null>(row);

  useEffect(() => {
    setFormData(row ? { ...row } : null);
  }, [row]);

  if (!isOpen || !formData) return null;

  const showFase1 = phase === 'fase1' || phase === 'final';
  const showFase2 = phase === 'fase2' || phase === 'final';
  const showFase3 = phase === 'fase3' || phase === 'final';
  const phaseLabel =
    phase === 'fase1' ? 'Fase 1 (PTEN & Kode Pos)' :
    phase === 'fase2' ? 'Fase 2 (Wilayah & Master Cabang)' :
    phase === 'fase3' ? 'Fase 3 (Mapping Role & Wondr)' :
    'Data Final';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData) return;
    onSave({
      ...formData,
      editedManually: true,
      statusAnalisa: 'EXACT_MATCH',
      confidenceScore: 100,
      matchingAlgorithm: 'Manual Operator Correction',
    });
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1060,
        background: 'rgba(15, 23, 42, 0.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        className="glass-card"
        style={{
          background: '#ffffff',
          borderRadius: '10px',
          width: '100%',
          maxWidth: '720px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
          border: '1px solid #e9ebec',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '1rem 1.4rem',
            borderBottom: '1px solid #e9ebec',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#fafbfc',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '6px',
                background: 'rgba(64, 81, 137, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#405189',
              }}
            >
              <Edit size={16} />
            </div>
            <div>
              <h3 style={{ fontSize: '0.96rem', fontWeight: 700, color: '#212529', margin: 0 }}>
                Koreksi & Edit Data {phaseLabel} (Baris #{formData.no})
              </h3>
              <p style={{ fontSize: '0.74rem', color: '#878a99', margin: '0.1rem 0 0' }}>
                Hanya atribut {phaseLabel} yang dapat diubah pada review fase ini
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#878a99',
              cursor: 'pointer',
              padding: '0.25rem',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '1.25rem 1.4rem', overflowY: 'auto', maxHeight: 'calc(90vh - 140px)', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Section 1: Fase 1 PTEN & Kode Pos */}
            {showFase1 && (
            <div style={{ background: '#f8fafc', padding: '0.85rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.82rem', fontWeight: 700, color: '#299cdb', marginBottom: '0.65rem' }}>
                <MapPin size={15} />
                <span>Atribut Fase 1: PTEN & Kode Pos</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.65rem' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 600, color: '#495057' }}>Kota PTEN:</label>
                  <input
                    type="text"
                    className="form-control"
                    style={{ fontSize: '0.78rem', padding: '0.35rem 0.6rem' }}
                    value={formData.kotaPten}
                    onChange={(e) => setFormData({ ...formData, kotaPten: e.target.value.toUpperCase() })}
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 600, color: '#495057' }}>Kode Pos PTEN:</label>
                  <input
                    type="text"
                    className="form-control"
                    style={{ fontSize: '0.78rem', padding: '0.35rem 0.6rem' }}
                    value={formData.kodePosPten}
                    onChange={(e) => setFormData({ ...formData, kodePosPten: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 600, color: '#495057' }}>Kelurahan:</label>
                  <input
                    type="text"
                    className="form-control"
                    style={{ fontSize: '0.78rem', padding: '0.35rem 0.6rem' }}
                    value={formData.kelurahan}
                    onChange={(e) => setFormData({ ...formData, kelurahan: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 600, color: '#495057' }}>Kecamatan:</label>
                  <input
                    type="text"
                    className="form-control"
                    style={{ fontSize: '0.78rem', padding: '0.35rem 0.6rem' }}
                    value={formData.kecamatan}
                    onChange={(e) => setFormData({ ...formData, kecamatan: e.target.value })}
                  />
                </div>
              </div>
            </div>
            )}

            {/* Section 2: Fase 2 Wilayah & Master Cabang */}
            {showFase2 && (
            <div style={{ background: '#f8fafc', padding: '0.85rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.82rem', fontWeight: 700, color: '#405189', marginBottom: '0.65rem' }}>
                <Building2 size={15} />
                <span>Atribut Fase 2: Wilayah & Master Cabang</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.65rem' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 600, color: '#495057' }}>Wilayah (Kanwil):</label>
                  <select
                    className="form-control"
                    style={{ fontSize: '0.78rem', padding: '0.35rem 0.6rem' }}
                    value={formData.wilayah}
                    onChange={(e) => setFormData({ ...formData, wilayah: e.target.value })}
                  >
                    {wilayahSettings.map((w) => (
                      <option key={w.wilayah} value={`Wilayah ${w.wilayah}`}>
                        Wilayah {w.wilayah} ({w.namaOutlet || w.keterangan || w.dati2})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 600, color: '#495057' }}>Sandi Cabang:</label>
                  <input
                    type="text"
                    className="form-control"
                    style={{ fontSize: '0.78rem', padding: '0.35rem 0.6rem' }}
                    value={formData.sandiCabang}
                    onChange={(e) => setFormData({ ...formData, sandiCabang: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 600, color: '#495057' }}>Branch Code:</label>
                  <input
                    type="text"
                    className="form-control"
                    style={{ fontSize: '0.78rem', padding: '0.35rem 0.6rem' }}
                    value={formData.branchCode}
                    onChange={(e) => setFormData({ ...formData, branchCode: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 600, color: '#495057' }}>Nama Outlet:</label>
                  <input
                    type="text"
                    className="form-control"
                    style={{ fontSize: '0.78rem', padding: '0.35rem 0.6rem' }}
                    value={formData.namaOutlet}
                    onChange={(e) => setFormData({ ...formData, namaOutlet: e.target.value })}
                    required
                  />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ fontSize: '0.72rem', fontWeight: 600, color: '#495057' }}>ALAMAT Cabang:</label>
                  <input
                    type="text"
                    className="form-control"
                    style={{ fontSize: '0.78rem', padding: '0.35rem 0.6rem' }}
                    value={formData.alamat}
                    onChange={(e) => setFormData({ ...formData, alamat: e.target.value })}
                  />
                </div>
              </div>
            </div>
            )}

            {/* Section 3: Fase 3 Mapping Role */}
            {showFase3 && (
            <div style={{ background: '#f8fafc', padding: '0.85rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.82rem', fontWeight: 700, color: '#0ab39c', marginBottom: '0.65rem' }}>
                <Users size={15} />
                <span>Atribut Fase 3: Mapping Role & Wondr</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.65rem' }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ fontSize: '0.72rem', fontWeight: 600, color: '#495057' }}>ORGANISASI TUJUAN:</label>
                  <input
                    type="text"
                    className="form-control"
                    style={{ fontSize: '0.78rem', padding: '0.35rem 0.6rem' }}
                    value={formData.organisasiTujuan}
                    onChange={(e) => setFormData({ ...formData, organisasiTujuan: e.target.value.toUpperCase() })}
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 600, color: '#495057' }}>Tipe Unit:</label>
                  <select
                    className="form-control"
                    style={{ fontSize: '0.78rem', padding: '0.35rem 0.6rem' }}
                    value={formData.tipeUnit}
                    onChange={(e) => setFormData({ ...formData, tipeUnit: e.target.value as 'KC' | 'KCP' })}
                  >
                    <option value="KC">KC - Kantor Cabang Utama</option>
                    <option value="KCP">KCP - Kantor Cabang Pembantu</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 600, color: '#495057' }}>Alur Wondr Tier:</label>
                  <input
                    type="text"
                    className="form-control"
                    style={{ fontSize: '0.78rem', padding: '0.35rem 0.6rem' }}
                    value={formData.alurWondr}
                    onChange={(e) => setFormData({ ...formData, alurWondr: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 600, color: '#495057' }}>3 Role Operasional:</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '0.3rem', fontSize: '0.74rem' }}>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                      <input
                        type="checkbox"
                        checked={formData.roleCabsal === 1}
                        onChange={(e) => setFormData({ ...formData, roleCabsal: e.target.checked ? 1 : 0 })}
                      />
                      <span>Sales</span>
                    </label>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                      <input
                        type="checkbox"
                        checked={formData.roleCabapv1 === 1}
                        onChange={(e) => setFormData({ ...formData, roleCabapv1: e.target.checked ? 1 : 0 })}
                      />
                      <span>Verifikator</span>
                    </label>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                      <input
                        type="checkbox"
                        checked={formData.roleCabapv2 === 1}
                        onChange={(e) => setFormData({ ...formData, roleCabapv2: e.target.checked ? 1 : 0 })}
                      />
                      <span>Penyetuju</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
            )}
          </div>

          {/* Modal Footer */}
          <div
            style={{
              padding: '0.85rem 1.4rem',
              borderTop: '1px solid #e9ebec',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '0.6rem',
              background: '#fafbfc',
            }}
          >
            <button type="button" className="btn btn-outline btn-sm" onClick={onClose}>
              Batal
            </button>
            <button type="submit" className="btn btn-primary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              <Save size={14} />
              <span>Simpan Perubahan</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
