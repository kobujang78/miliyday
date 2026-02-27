"use client"
import React from 'react'

// Simple client-side EXIF-stripping upload (draw to canvas then toBlob)
export default function ImageUploadWidget({ onUpload }:{ onUpload?: (file:File)=>void }){
  async function handleFile(e:React.ChangeEvent<HTMLInputElement>){
    const f = e.target.files && e.target.files[0]
    if(!f) return
    const img = document.createElement('img')
    const url = URL.createObjectURL(f)
    img.src = url
    await img.decode()
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d')
    if(!ctx) return
    ctx.drawImage(img,0,0)
    canvas.toBlob((blob)=>{
      if(!blob) return
      const clean = new File([blob], f.name, { type: 'image/jpeg' })
      onUpload && onUpload(clean)
      URL.revokeObjectURL(url)
    }, 'image/jpeg', 0.9)
  }

  return (
    <div className="mt-2">
      <label className="inline-flex items-center gap-2 bg-white px-3 py-2 rounded-md shadow-sm text-sm">
        <input type="file" accept="image/*" onChange={handleFile} className="hidden" />
        업로드 (EXIF 제거)
      </label>
    </div>
  )
}
