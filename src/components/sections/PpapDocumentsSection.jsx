import { useRef, useState } from 'react'
import { Field, SectionCard } from '../ui.jsx'
import { formatBytes } from '../../lib/format.js'
import { DOCUMENT_ACCEPT, FSA_DOCUMENT_FIELDS, MAX_FILES_PER_FIELD } from '../../lib/fsaForm.js'
import { isAllowedDocument, isImage, MAX_FILE_SIZE } from '../../lib/validation.js'
import { compressImage } from '../../lib/image.js'
import { uploadToStorage } from '../../lib/api.js'

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

export default function PpapDocumentsSection({ form, errors, onChange, fsaId }) {
  const { documents } = form
  const [localError, setLocalError] = useState('')
  const [uploading, setUploading] = useState(false)

  const setDocuments = (next) => onChange({ ...documents, ...next })

  async function handleProductPhoto(files) {
    setLocalError('')
    const file = files[0]
    if (!file) return

    if (!isImage(file)) {
      setLocalError('File product photo harus berupa gambar (jpg/png/webp)')
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      setLocalError('Ukuran file maksimal 10 MB')
      return
    }

    setUploading(true)
    try {
      const compressed = await compressImage(file)
      const meta = await uploadToStorage(compressed, fsaId)
      setDocuments({ productPhoto: { ...meta, localPreview: URL.createObjectURL(compressed) } })
    } catch (err) {
      setLocalError(err.message)
    } finally {
      setUploading(false)
    }
  }

  async function handleSlotFiles(fieldKey, fieldLabel, files) {
    setLocalError('')
    if (!files.length) return
    const current = documents[fieldKey] ?? []

    if (current.length + files.length > MAX_FILES_PER_FIELD) {
      setLocalError(`${fieldLabel}: maksimal ${MAX_FILES_PER_FIELD} file`)
      return
    }

    const tooBig = files.find((file) => file.size > MAX_FILE_SIZE)
    if (tooBig) {
      setLocalError(`File ${tooBig.name} melebihi 10 MB`)
      return
    }

    const badType = files.find((file) => !isAllowedDocument(file))
    if (badType) {
      setLocalError(`File ${badType.name} harus PDF, Excel, Word, atau gambar`)
      return
    }

    setUploading(true)
    try {
      const metas = await Promise.all(
        files.map(async (file) => {
          const compressed = file.type.startsWith('image/') ? await compressImage(file) : file
          return uploadToStorage(compressed, fsaId)
        }),
      )
      setDocuments({ [fieldKey]: [...current, ...metas] })
    } catch (err) {
      setLocalError(err.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <SectionCard step="2" title="FSA Documents" description="Upload dokumentasi pendukung Parts Production Approval Process.">
      {localError ? <p className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{localError}</p> : null}
      {uploading ? <p className="mb-4 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-medium text-sky-700">Mengunggah file...</p> : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Field label="Product Photo" required error={errors.productPhoto} hint="Upload 1 foto part (maks 10 MB)">
          <div className="space-y-3">
            <UploadButton
              accept="image/*"
              label={documents.productPhoto ? 'Ganti foto' : 'Upload foto'}
              onPick={handleProductPhoto}
              disabled={uploading}
            />
            {documents.productPhoto ? (
              <ul className="space-y-2">
                {documents.productPhoto._existing ? (
                  <li className="overflow-hidden rounded-lg border border-slate-200 bg-slate-100 px-4 py-6 text-center text-sm text-slate-500">
                    📷 {documents.productPhoto.fileName}
                    <span className="ml-2 text-xs text-slate-400">(file tersimpan di server)</span>
                  </li>
                ) : (
                  <li className="overflow-hidden rounded-lg border border-slate-200">
                    <img
                      src={documents.productPhoto.localPreview ?? ''}
                      alt="Preview product photo"
                      className="h-40 w-full object-cover"
                    />
                  </li>
                )}
                <FileRow file={documents.productPhoto} onRemove={() => setDocuments({ productPhoto: null })} />
              </ul>
            ) : (
              <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                Belum ada foto product photo yang diunggah.
              </p>
            )}
          </div>
        </Field>

        {FSA_DOCUMENT_FIELDS.map((field) => {
          const files = documents[field.key] ?? []
          return (
            <Field
              key={field.key}
              label={field.label}
              required={field.required}
              hint={`Multiple file upload, maksimal ${MAX_FILES_PER_FIELD} file (PDF/Excel/Word/gambar)`}
              error={errors[`documents.${field.key}`]}
            >
              <div className="space-y-3">
                <UploadButton
                  accept={DOCUMENT_ACCEPT}
                  multiple
                  disabled={files.length >= MAX_FILES_PER_FIELD || uploading}
                  label={files.length ? 'Tambah file' : 'Upload file'}
                  onPick={(picked) => handleSlotFiles(field.key, field.label, picked)}
                />
                {files.length ? (
                  <ul className="space-y-2">
                    {files.map((file, index) => (
                      <FileRow
                        key={`${file.storedName}-${index}`}
                        file={file}
                        onRemove={() =>
                          setDocuments({ [field.key]: files.filter((_, i) => i !== index) })
                        }
                      />
                    ))}
                  </ul>
                ) : (
                  <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                    Belum ada file {field.label}.
                  </p>
                )}
              </div>
            </Field>
          )
        })}
      </div>
    </SectionCard>
  )
}
