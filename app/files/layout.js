// app/docs/[id]/layout.js
import { basicAuth } from "@/lib/auth";
import NavBar from "@/components/NavBar";

export default async function HomeLayout({ children }) {

  const user = await basicAuth(); //default: "/"

  return (
    <>
      <NavBar user={user} />
      {children}
    </>
  );
}
