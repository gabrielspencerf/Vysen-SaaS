import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Login",
  description: "Acesse sua conta para visualizar dados e operações no dashboard.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
  alternates: {
    canonical: "/login",
  },
};

export default function LoginLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
