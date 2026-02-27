import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 p-6">
      <main className="max-w-md mx-auto">
        <h1 className="text-2xl font-semibold mb-4">MiliConnect</h1>

        <nav className="grid grid-cols-2 gap-2">
          <Link className="block p-4 bg-white rounded shadow text-center" href="/service">복무기간</Link>
          <Link className="block p-4 bg-white rounded shadow text-center" href="/tips">병영꿀팁</Link>
          <Link className="block p-4 bg-white rounded shadow text-center" href="/market">병영장터</Link>
          <Link className="block p-4 bg-white rounded shadow text-center" href="/share">생활공유</Link>
        </nav>

        <div className="mt-6">
          <p className="text-sm text-gray-600">각 탭은 데모 UI로 연결되어 있으며, 상호작용은 Mock API 연동으로 확장 가능합니다.</p>
        </div>
      </main>
    </div>
  )
}
