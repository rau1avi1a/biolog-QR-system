import Image from "next/image";
import QRcodeGenerator from "@/components/QRcodeGenerator";

export default function GenerateQR() {
  return (
    <div className="relative min-h-[100vh] h-full flex justify-center items-center">

      <QRcodeGenerator />
      
      <Image 
      src="/glass.png" 
      alt="glass image" 
      width={1600} 
      height={1600} 
      className="fixed top-0 left-0 w-full h-full object-cover z-0 pointer-events-none"  
      />

    </div>
  );
}