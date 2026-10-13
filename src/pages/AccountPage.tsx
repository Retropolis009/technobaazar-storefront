import { UserRound } from 'lucide-react'

function AccountPage() {
  return (
    <main id="top" className="mx-auto flex min-h-[70vh] max-w-[720px] flex-col justify-center px-4 py-12 sm:px-7">
      <p className="section-kicker">TechnoBaazar account</p>
      <h1 className="font-display text-4xl font-bold tracking-[-0.05em]">Your account</h1>
      <div className="mt-7 border border-[#dfe4dc] bg-white p-6 sm:p-8">
        <UserRound size={25} className="text-[#315ee8]" />
        <h2 className="mt-4 font-display text-xl font-bold">Account access is coming soon</h2>
        <p className="mt-2 text-sm leading-6 text-[#68736c]">You can browse products, save favorites, and build a shopping bag in this starter storefront. Sign-in and order history can be connected when the store backend is ready.</p>
      </div>
    </main>
  )
}

export default AccountPage