// app/chemicals/layout.js
import { basicAuth } from "@/lib/auth";

export default async function HomeLayout({ children }) {

  const user = await basicAuth(); //default: "/"

  return (
    <>
      {children}
    </>
  );
}
