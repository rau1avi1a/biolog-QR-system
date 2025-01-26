import Link from "next/link";

export default function NavBar() {
  return (
    <nav 
    className="relative z-50 flex justify-left items-center bg-slate-800 px-8 py-3">

      <div 
      className="flex space-x-6">
        
        <Link
          href="/"
          className="text-white hover:text-gray-300 transition-colors">

          Home

        </Link>

        <Link
          href="/GenerateQR"
          className="text-white hover:text-gray-300 transition-colors">
          
          Create QR

        </Link>

      </div>

    </nav>
  );
}
