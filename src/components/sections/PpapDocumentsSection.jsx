import { useRef, useState } from 'react'
import { Field, SectionCard } from '../ui.jsx'
import { formatBytes } from '../../lib/format.js'
import { isImage, MAX_FILE_SIZE, MAX_PPAP_FILES, readFileAsDataUrl } from '../../lib/validation.js'
import { compressImage } from '../../lib/image.js'

function UploadButton({ accept, multiple, onPick, disabled, label }) {
  const inputRef = useRef(null)

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(event) => {
          onPick(Array.from(event.target.files ?? []))
          event.target.value = ''
        }}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {label}
      </button>
    </>
  )
}

function FileRow({ file, onRemove }) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-slate-800">{file.fileName}</p>
        <p className="text-xs text-slate-500">
          {formatBytes(file.size)} {file.mime ? `- ${file.mime}` : ''}
        </p>
      </div>
      {onRemove ? (
        <button type="button" onClick={onRemove} className="shrink-0 text-xs font-semibold text-rose-600 hover:text-rose-700">
          Hapus
        </button>
      ) : null}
    </li>
  )
}

export default function PpapDocumentsSection({ form, errors, onChange }) {
  const { documents } = form
  const [localError, setLocalError] = useState('')

  const setDocuments = (next) => onChange({ ...documents, ...next })

  async function handleAppearance(files) {
    setLocalError('')
    const file = files[0]
    if (!file) return

    if (!isImage(file)) {
      setLocalError('File appearance harus berupa gambar (jpg/png/webp)')
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      setLocalError('Ukuran file maksimal 10 MB')
      return
    }

    try {
      const compressed = await compressImage(file)
      const payload = await readFileAsDataUrl(compressed)
      setDocuments({ appearance: { ...payload, size: compressed.size, localPreview: URL.createObjectURL(compressed) } })
    } catch (err) {
      setLocalError(err.message)
    }
  }

  async function handlePpap(files) {
    setLocalError('')
    if (documents.ppap.length + files.length > MAX_PPAP_FILES) {
      setLocalError(`Maksimal ${MAX_PPAP_FILES} file PPAP`)
      return
    }

    const invalid = files.find((file) => file.size > MAX_FILE_SIZE)
    if (invalid) {
      setLocalError(`File ${invalid.name} melebihi 10 MB`)
      return
    }

    try {
      const payloads = await Promise.all(
        files.map(async (file) => {
          const compressed = file.type.startsWith('image/') ? await compressImage(file) : file
          return { ...(await readFileAsDataUrl(compressed)), size: compressed.size }
        }),
      )
      setDocuments({ ppap: [...documents.ppap, ...payloads] })
    } catch (err) {
      setLocalError(err.message)
    }
  }

  return (
    <SectionCard step="2" title="PPAP Documents" description="Upload dokumentasi pendukung Parts Production Approval Process.">
      {localError ? <p className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{localError}</p> : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Field label="Appearance" required error={errors.appearance} hint="Upload 1 foto part (maks 10 MB)">
          <div className="space-y-3">
            <UploadButton
              accept="image/*"
              label={documents.appearance ? 'Ganti foto' : 'Upload foto'}
              onPick={handleAppearance}
            />
            {documents.appearance ? (
              <ul className="space-y-2">
                {documents.appearance._existing ? (
                  // File sudah tersimpan di server – tampilkan placeholder
                  <li className="overflow-hidden rounded-lg border border-slate-200 bg-slate-100 px-4 py-6 text-center text-sm text-slate-500">
                    📷 {documents.appearance.fileName}
                    <span className="ml-2 text-xs text-slate-400">(file tersimpan di server)</span>
                  </li>
                ) : (
                  <li className="overflow-hidden rounded-lg border border-slate-200">
                    <img
                      src={documents.appearance.localPreview ?? documents.appearance.dataUrl ?? ''}
                      alt="Preview appearance"
                      className="h-40 w-full object-cover"
                    />
                  </li>
                )}
                <FileRow file={documents.appearance} onRemove={() => setDocuments({ appearance: null })} />
              </ul>
            ) : (
              <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                Belum ada foto appearance yang diunggah.
              </p>
            )}
          </div>
        </Field>

        <Field
          label="PPAP Document"
          hint={`Multiple file upload, maksimal ${MAX_PPAP_FILES} file`}
          error={errors.ppapDocuments}
        >
          <div className="space-y-3">
            <UploadButton
              accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.zip"
              multiple
              disabled={documents.ppap.length >= MAX_PPAP_FILES}
              label="Upload file PPAP"
              onPick={handlePpap}
            />
            {documents.ppap.length ? (
              <ul className="space-y-2">
                {documents.ppap.map((file, index) => (
                  <FileRow
                    key={`${file.fileName}-${index}`}
                    file={file}
                    onRemove={() => setDocuments({ ppap: documents.ppap.filter((_, i) => i !== index) })}
                  />
                ))}
              </ul>
            ) : (
              <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                Belum ada file PPAP. Upload antara lain dimensional report, material cert, test result.
              </p>
            )}
          </div>
        </Field>
      </div>
    </SectionCard>
  )
}
