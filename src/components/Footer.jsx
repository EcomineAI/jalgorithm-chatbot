import { Sparkles } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="border-t border-gray-100 py-8 px-6">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-400">
        <div className="flex items-center gap-2 font-medium text-gray-600">
          <div className="w-5 h-5 bg-pink-500 rounded-md flex items-center justify-center">
            <Sparkles size={10} className="text-white" />
          </div>
          JALgorithm
        </div>
        <p>ML-based appointment chatbot for hair &amp; makeup stylists - Olongapo City</p>
        <p>© {new Date().getFullYear()}</p>
      </div>
    </footer>
  )
}
