import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Upload, X, Loader2, Image as ImageIcon } from 'lucide-react';
import api, { request } from '@/lib/api';

/**
 * Image picker + uploader. Uploads to POST /uploads/image (multipart) and calls
 * onChange(publicUrl). Also shows a preview and a "remove" control.
 */
export default function ImageUpload({ value, onChange, label, aspect = 'square' }) {
  const ref = useRef();
  const [busy, setBusy] = useState(false);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) { toast.error('Image must be under 3MB'); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await request(api.post('/uploads/image', fd));
      onChange(res.url);
      toast.success('Image uploaded');
    } catch (err) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = '';
    }
  };

  const box = aspect === 'wide' ? 'h-24 w-40' : 'h-24 w-24';

  return (
    <div>
      {label && <label className="mb-1.5 block text-sm font-medium text-zinc-600 dark:text-zinc-300">{label}</label>}
      <div className="flex items-center gap-3">
        <div className={`relative grid ${box} place-items-center overflow-hidden rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50`}>
          {value ? (
            <>
              <img src={value} alt="" className="h-full w-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
              <button type="button" onClick={() => onChange('')} className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-white"><X className="h-3.5 w-3.5" /></button>
            </>
          ) : <ImageIcon className="h-7 w-7 text-zinc-300" />}
        </div>
        <div>
          <input ref={ref} type="file" accept="image/*" className="hidden" onChange={onFile} />
          <button type="button" onClick={() => ref.current?.click()} disabled={busy}
            className="flex items-center gap-2 rounded-xl border border-zinc-300 dark:border-zinc-700 px-3.5 py-2 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-60">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {busy ? 'Uploading…' : 'Upload image'}
          </button>
          <p className="mt-1 text-xs text-zinc-400">PNG/JPG/WebP · under 3MB</p>
        </div>
      </div>
    </div>
  );
}
