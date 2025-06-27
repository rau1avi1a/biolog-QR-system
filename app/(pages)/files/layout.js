// app/files/layout.js
import { basicAuth } from "@/db/lib/auth";
import NavBar from "@/app/NavBar";

export default async function HomeLayout({ children }) {

  const user = await basicAuth(); //default: "/"

  return (
    <>
      {/* <NavBar user={user} /> */}
      {children}
    </>
  );
}
