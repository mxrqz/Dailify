import { BubbleDefs } from "@/components/landing/kit/bubble";
import { SiteHeaderV2 } from "@/components/landing/sections/header";
import { HeroV2 } from "@/components/landing/sections/hero";
import { FeaturesV2 } from "@/components/landing/sections/features";
import { WorldV2 } from "@/components/landing/sections/world";
import { PricingV2 } from "@/components/landing/sections/pricing";
import { FaqV2 } from "@/components/landing/sections/faq";
import { CtaV2 } from "@/components/landing/sections/cta";
import { FooterV2 } from "@/components/landing/sections/footer";

export default function LandingPage() {
  return (
    <main className="flex w-full flex-col overflow-x-clip bg-canvas text-ink">
      <BubbleDefs />
      <SiteHeaderV2 />
      <HeroV2 />
      <div id="features">
        <FeaturesV2 />
        <WorldV2 />
      </div>
      <div id="pricing">
        <PricingV2 />
      </div>
      <FaqV2 />
      <CtaV2 />
      <FooterV2 />
    </main>
  );
}
