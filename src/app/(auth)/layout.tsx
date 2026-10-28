import { Logo } from "@/components/logo";
import { SiteFooter } from "@/components/site-footer";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <header className="border-b border-line bg-white">
        <div className="mx-auto max-w-5xl px-4 py-3">
          <Logo />
        </div>
      </header>
      <main className="mx-auto w-full max-w-md px-4 py-8 sm:py-12">{children}</main>
      <SiteFooter />
    </>
  );
}
