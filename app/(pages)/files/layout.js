// app/files/layout.js
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { basicAuth } from "@/db/lib/auth";
import NavBar from "@/app/(pages)/(components)/NavBar";

export default async function HomeLayout({ children }) {

  const user = await basicAuth(); //default: "/"

  return (
    <>
      {/* <NavBar user={user} /> */}
      {children}
    </>
  );
}
