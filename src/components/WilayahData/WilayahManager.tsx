import React, { useState, useEffect } from 'react';
import { Save, Plus, Trash2, Map, Loader2, AlertCircle } from 'lucide-react';
import type { WilayahSetting } from '../../types';
import { loadWilayahFromNeon, saveWilayahToNeon } from '../../utils/neonSync';

export const WilayahManager: React.FC = () => {
  const [settings, setSettings] = useState<WilayahSetting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      setIsLoading(true);
      setError(null);
      const data = await loadWilayahFromNeon();
      if (data) {
        setSettings(data);
      }
      setIsLoading(false);
    };
    fetchSettings();
  }, []);

  const handleAdd = () => {
    setSettings([...settings, { kodeWilayah: '', keterangan: '' }]);
  };

  const handleRemove = (index: number) => {
    const newSettings = [...settings];
    newSettings.splice(index, 1);
    setSettings(newSettings);
  };

  const handleChange = (index: number, field: keyof WilayahSetting, value: string) => {
    const newSettings = [...settings];
    newSettings[index][field] = value;
    setSettings(newSettings);
  };

  const handleSave = async () => {
    // Validasi input
    const isValid = settings.every(s => s.kodeWilayah.trim() !== '' && s.keterangan.trim() !== '');
    if (!isValid) {
      setError('Kode Wilayah dan Keterangan tidak boleh kosong.');
      setTimeout(() => setError(null), 3000);
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccessMsg(null);
    const success = await saveWilayahToNeon(settings);
    setIsSaving(false);
    
    if (success) {
      setSuccessMsg('Setting Wilayah berhasil disimpan!');
      setTimeout(() => setSuccessMsg(null), 3000);
    } else {
      setError('Gagal menyimpan setting wilayah ke server.');
      setTimeout(() => setError(null), 3000);
    }
  };

  return (
    <div className="tab-pane active fade-in">
      <div className="mb-6 flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
            <Map size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">Setting Wilayah</h2>
            <p className="text-sm text-slate-500">Kelola pemetaan 2 digit kode branch ke nama wilayah.</p>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={isLoading || isSaving}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors shadow-sm disabled:opacity-50"
        >
          {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
          Simpan Perubahan
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-700 border border-red-200 rounded-lg flex items-center gap-3 animate-in fade-in">
          <AlertCircle size={20} />
          <span className="font-medium">{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="mb-6 p-4 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg flex items-center gap-3 animate-in fade-in">
          <Save size={20} />
          <span className="font-medium">{successMsg}</span>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex justify-center items-center">
            <Loader2 size={32} className="animate-spin text-blue-600" />
          </div>
        ) : (
          <div className="p-6">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-y border-slate-200">
                    <th className="px-4 py-3 text-sm font-semibold text-slate-600 w-16 text-center">No</th>
                    <th className="px-4 py-3 text-sm font-semibold text-slate-600 w-1/3">Kode Wilayah (2 Digit)</th>
                    <th className="px-4 py-3 text-sm font-semibold text-slate-600">Keterangan</th>
                    <th className="px-4 py-3 text-sm font-semibold text-slate-600 w-24 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {settings.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-slate-500 italic">
                        Belum ada data wilayah. Silakan klik "Tambah Wilayah".
                      </td>
                    </tr>
                  ) : (
                    settings.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-3 text-center text-slate-500 font-medium">
                          {idx + 1}
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            value={item.kodeWilayah}
                            onChange={(e) => handleChange(idx, 'kodeWilayah', e.target.value)}
                            placeholder="Misal: 01"
                            maxLength={5}
                            className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            value={item.keterangan}
                            onChange={(e) => handleChange(idx, 'keterangan', e.target.value)}
                            placeholder="Misal: Wilayah 1"
                            className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                          />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => handleRemove(idx)}
                            className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                            title="Hapus"
                          >
                            <Trash2 size={18} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-200">
              <button
                onClick={handleAdd}
                className="flex items-center gap-2 px-4 py-2 text-blue-600 font-medium hover:bg-blue-50 rounded-lg transition-colors"
              >
                <Plus size={18} />
                Tambah Wilayah
              </button>
            </div>
            
            <div className="mt-6 bg-blue-50 p-4 rounded-lg border border-blue-100 flex gap-3 text-blue-800 text-sm">
              <AlertCircle size={20} className="shrink-0 mt-0.5" />
              <div>
                <strong>Informasi:</strong><br />
                Kode wilayah akan dicocokkan dengan digit ke-2 dan ke-3 dari <b>Branch Code</b> pada saat file Excel diunggah.<br />
                Contoh: Branch Code <code>60115601</code> akan diekstrak menjadi <code>01</code> dan menggunakan keterangan <b>Wilayah 1</b> jika terdaftar di atas.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
