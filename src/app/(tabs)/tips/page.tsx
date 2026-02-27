"use client"
import React, { useEffect, useState } from 'react'

interface Post { id:number; title:string; body:string; category?:string }

export default function TipsPage(){
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(()=>{
    setLoading(true)
    fetch('/api/posts')
      .then(r=>r.json())
      .then(data=>setPosts(data.posts || []))
      .catch(()=>{})
      .finally(()=>setLoading(false))
  },[])

  return (
    <div className="max-w-md mx-auto">
      <h2 className="text-xl font-semibold mb-4">병영꿀팁</h2>

      <div className="mb-3">
        <button className="rounded bg-indigo-600 text-white px-3 py-1 text-sm" onClick={async()=>{
          const title = prompt('제목')
          const body = prompt('내용')
          if(!title||!body) return
          const res = await fetch('/api/posts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title,body,category:'일반'})})
          const j = await res.json()
          setPosts(prev=>[j,...prev])
        }}>새 글 작성</button>
      </div>

      {loading? <p className="text-sm text-gray-500">불러오는 중...</p> : (
        <div className="space-y-3">
          {posts.map(p=> (
            <article key={p.id} className="p-3 bg-white rounded shadow-sm">
              <h3 className="font-medium">{p.title}</h3>
              <p className="text-sm text-gray-600 mt-1">{p.body}</p>
              <div className="mt-2 text-xs text-gray-500">카테고리: {p.category}</div>
              <div className="mt-2 flex gap-2">
                <button className="text-xs text-red-500" onClick={async()=>{await fetch(`/api/posts/${p.id}`,{method:'DELETE'});setPosts(prev=>prev.filter(x=>x.id!==p.id))}}>삭제</button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
