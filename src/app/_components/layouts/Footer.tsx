import Link from "next/link"


function Footer() {
  return (
    <footer className="my-4 text-center space-y-1">
      <hr className="border-gray-300 mb-2 mx-auto w-1/2" />
      <p className="text-xs text-gray-400">
        Hackathon 2025 — New Valley Governorate
      </p>
      <p className="text-xs text-gray-400 flex items-center justify-center gap-2">
        <Link
          href="https://github.com/FadyHe"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-gray-600 transition-colors underline underline-offset-2"
        >
          Fady Helmy
        </Link>
        <span>·</span>
        <Link
          href="https://github.com/mostafammy"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-gray-600 transition-colors underline underline-offset-2"
        >
          Mostafa Yaser
        </Link>
      </p>
    </footer>
  )
}

export default Footer