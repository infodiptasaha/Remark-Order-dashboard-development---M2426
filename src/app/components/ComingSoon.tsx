export default function ComingSoon({
  section, subItem, icon
}: { section: string; subItem: string | null; icon: string }) {
  return (
    <div className="min-h-full flex items-center justify-center bg-gray-50">
      <div className="text-center max-w-md px-6">
        <div className="text-5xl mb-4">{icon}</div>
        <h2 className="text-xl font-semibold text-gray-800 mb-2">
          {subItem || section}
        </h2>
        <p className="text-sm text-gray-400 mb-1">{section}</p>
        <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-full text-sm font-medium">
          <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>
          Coming soon
        </div>
        <p className="text-xs text-gray-400 mt-4">
          This analysis module is under development.
        </p>
      </div>
    </div>
  )
}
