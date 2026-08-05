import Header from "@/components/header";
import { Hero } from "@/components/landing/hero";
import { FeatureTabs } from "@/components/landing/feature-tabs";
import { FeatureBento } from "@/components/landing/feature-bento";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Pricing } from "@/components/landing/pricing";
import { CtaBand } from "@/components/landing/cta";
import { SiteFooter } from "@/components/landing/site-footer";

export default function LandingPage() {
  return (
    <main className="relative flex flex-col w-full bg-surface-page text-foreground overflow-x-clip">
      {/* <Grain /> removido do QA — reintroduzir refatorado depois (componente em @/components/landing/grain) */}

      <div className="relative z-10 flex flex-col">
        <Header className="px-[clamp(1rem,5vw,24rem)]" />
        <Hero />

        <div id="features">
          <FeatureTabs />
        </div>

        <FeatureBento />

        <HowItWorks />

        <div id="pricing">
          <Pricing />
        </div>

        <CtaBand />

        <SiteFooter />
      </div>
    </main>
  );
}
