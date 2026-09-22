import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  /** Aksi menghapus cache lokal bersifat merusak, jadi tombolnya harus ditekan dua kali. */
  konfirmasiReset: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    konfirmasiReset: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null, konfirmasiReset: false };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught React ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  public handleReload = () => {
    window.location.reload();
  };

  public mintaKonfirmasiReset = () => {
    this.setState({ konfirmasiReset: true });
    window.setTimeout(() => this.setState({ konfirmasiReset: false }), 8000);
  };

  public handleClearStorageAndReload = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
      indexedDB.deleteDatabase('ToolsDataMatcherDB');
    } catch (e) {
      console.warn('Failed clearing storage:', e);
    }
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#f3f3f9',
            padding: '2rem',
            fontFamily: 'Poppins, sans-serif',
          }}
        >
          <div
            style={{
              maxWidth: '560px',
              width: '100%',
              background: '#ffffff',
              borderRadius: '6px',
              padding: '2rem',
              boxShadow: '0 5px 10px rgba(30, 32, 37, 0.12)',
              border: '1px solid #e9ebec',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: '54px',
                height: '54px',
                borderRadius: '50%',
                background: 'rgba(240, 101, 72, 0.1)',
                color: '#f06548',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1rem',
              }}
            >
              <AlertTriangle size={28} />
            </div>

            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#212529', marginBottom: '0.5rem' }}>
              Terjadi Kendala pada Tampilan
            </h2>

            <p style={{ fontSize: '0.85rem', color: '#878a99', marginBottom: '1.25rem', lineHeight: 1.5 }}>
              Aplikasi mendeteksi format data yang tidak kompatibel atau kegagalan render sementara. Data Anda tersimpan aman.
            </p>

            {this.state.error && (
              <div
                style={{
                  background: '#f8f9fa',
                  border: '1px solid #ced4da',
                  borderRadius: '4px',
                  padding: '0.75rem',
                  fontSize: '0.75rem',
                  fontFamily: 'var(--font-mono)',
                  color: '#f06548',
                  textAlign: 'left',
                  marginBottom: '1.5rem',
                  maxHeight: '140px',
                  overflowY: 'auto',
                  wordBreak: 'break-word',
                }}
              >
                {this.state.error.toString()}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={this.handleReload}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.5rem 1.1rem',
                  borderRadius: '4px',
                  background: '#405189',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '0.82rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                <RotateCcw size={14} />
                <span>Muat Ulang Halaman</span>
              </button>

              <button
                type="button"
                onClick={this.state.konfirmasiReset ? this.handleClearStorageAndReload : this.mintaKonfirmasiReset}
                style={{
                  padding: '0.5rem 1.1rem',
                  borderRadius: '4px',
                  background: this.state.konfirmasiReset ? '#f06548' : '#ffffff',
                  color: this.state.konfirmasiReset ? '#ffffff' : '#495057',
                  border: `1px solid ${this.state.konfirmasiReset ? '#f06548' : '#ced4da'}`,
                  fontSize: '0.82rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                {this.state.konfirmasiReset ? 'Ya, Hapus Cache Lokal' : 'Reset Cache & Muat Ulang'}
              </button>
            </div>

            {this.state.konfirmasiReset && (
              <p style={{ fontSize: '0.74rem', color: '#f06548', marginTop: '0.75rem', marginBottom: 0 }}>
                Peringatan: seluruh data yang hanya tersimpan di browser ini (termasuk perubahan yang
                belum terkirim ke cloud) akan terhapus. Tekan sekali lagi untuk melanjutkan.
              </p>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
