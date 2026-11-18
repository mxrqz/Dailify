import { BubbleDefs } from "@/components/landing/kit/bubble";
import { SiteHeader } from "@/components/landing/sections/header";
import { Hero } from "@/components/landing/sections/hero";
import { Features } from "@/components/landing/sections/features";
import { World } from "@/components/landing/sections/world";
import { Pricing } from "@/components/landing/sections/pricing";
import { Faq } from "@/components/landing/sections/faq";
import { Cta } from "@/components/landing/sections/cta";
import { Footer } from "@/components/landing/sections/footer";

export default function LandingPage() {
  return (
    <div className="flex w-full flex-col overflow-x-clip bg-canvas text-ink">
      <BubbleDefs />
      <SiteHeader />
      <main className="flex flex-col">
        <Hero />
        <div id="features" className="scroll-mt-bar">
          <Features />
          <World />
        </div>
        <div id="pricing" className="scroll-mt-bar">
          <Pricing />
        </div>
        <Faq />
        <Cta />
      </main>
      <Footer />
    </div>
  );
}
