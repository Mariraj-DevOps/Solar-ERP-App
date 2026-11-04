/**
 * Mobile-Aware Universal Download Helper
 * Reliably downloads files in Desktop browsers, Mobile browsers (Chrome/Safari),
 * and React Native WebViews (Expo Mobile App).
 */

export interface DownloadFileOptions {
  filename: string;
  mimeType?: string;
  base64?: string;
  blob?: Blob;
  url?: string;
}

export async function downloadFile(options: DownloadFileOptions): Promise<void> {
  const { filename, mimeType, base64, blob, url } = options;

  // 1. Detect React Native WebView (Expo Mobile App)
  const isReactNative =
    typeof window !== 'undefined' &&
    Boolean((window as any).ReactNativeWebView && (window as any).ReactNativeWebView.postMessage);

  if (isReactNative) {
    if (base64) {
      const cleanB64 = base64.replace(/^data:[^;]+;base64,/, '');
      (window as any).ReactNativeWebView.postMessage(
        JSON.stringify({
          type: 'DOWNLOAD_BASE64',
          filename,
          base64: cleanB64,
          mimeType: mimeType || 'application/octet-stream',
        })
      );
      return;
    }

    if (blob) {
      await new Promise<void>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = String(reader.result || '');
          const b64 = result.split(',')[1] || '';
          (window as any).ReactNativeWebView.postMessage(
            JSON.stringify({
              type: 'DOWNLOAD_BASE64',
              filename,
              base64: b64,
              mimeType: blob.type || mimeType || 'application/octet-stream',
            })
          );
          resolve();
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      return;
    }

    if (url) {
      const token =
        localStorage.getItem('erp_token') ||
        sessionStorage.getItem('erp_token') ||
        localStorage.getItem('solar_erp_token') ||
        '';
      const absoluteUrl = new URL(url, window.location.origin).href;
      (window as any).ReactNativeWebView.postMessage(
        JSON.stringify({
          type: 'DOWNLOAD_URL',
          url: absoluteUrl,
          filename,
          token,
        })
      );
      return;
    }
  }

  // 2. Standard Mobile Browser / Desktop Browser Download
  if (blob || base64) {
    let targetBlob = blob;
    if (!targetBlob && base64) {
      const cleanB64 = base64.replace(/^data:[^;]+;base64,/, '');
      const binaryString = atob(cleanB64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      targetBlob = new Blob([bytes], { type: mimeType || 'application/octet-stream' });
    }

    if (targetBlob) {
      const blobUrl = URL.createObjectURL(targetBlob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        if (document.body.contains(link)) {
          document.body.removeChild(link);
        }
        URL.revokeObjectURL(blobUrl);
      }, 600);
      return;
    }
  }

  if (url) {
    // For authenticated remote URLs, fetch as blob using auth header, then trigger blob download
    try {
      const token = localStorage.getItem('erp_token') || sessionStorage.getItem('erp_token') || '';
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const fetchedBlob = await res.blob();
      const blobUrl = URL.createObjectURL(fetchedBlob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        if (document.body.contains(link)) {
          document.body.removeChild(link);
        }
        URL.revokeObjectURL(blobUrl);
      }, 600);
    } catch (e) {
      console.warn('Authenticated fetch download failed, falling back to direct open:', e);
      window.open(url, '_blank');
    }
  }
}
