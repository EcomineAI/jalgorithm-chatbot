export default function Footer() {
  return (
    <footer className="border-t border-gray-100 py-8 px-6">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-400">
        <p>Vicky's Parlor - Hair &amp; Makeup Services, Olongapo City</p>
        <p>© {new Date().getFullYear()} · Made by JALgorithm</p>
      </div>
    </footer>
  )
}
