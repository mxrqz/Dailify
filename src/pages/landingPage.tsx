import {
  Calendar1Icon,
  Check,
  CheckIcon,
  ClipboardListIcon,
  Clock12Icon,
  ClockIcon,
  HomeIcon,
  PlusIcon,
  SunIcon,
} from "lucide-react";
import Header from "../components/header";
import { Button } from "../components/ui/button";
import Calendar3 from "@/components/ui/calendar3";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

export default function LandingPage() {
  return (
    <main className="flex flex-col w-full">
      <Header className="px-[clamp(1rem,5vw,24rem)]" />

      <section className="w-full grid md:grid-cols-2 gap-10 md:gap-36 items-center px-[clamp(1rem,5vw,24rem)] relative py-20">
        <div className="absolute w-full h-full mask-b">
          <img
            src="./blob_10_blur.png"
            alt="Blob"
            className="size-full object-cover mix-blend-color-burn opacity-70 "
          />

          <div className="absolute left-0 top-0 size-full mix-blend-soft-light dark:invert opacity-50 dark:opacity-25">
            <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <filter id="noiseFilter">
                <feTurbulence
                  type="fractalNoise"
                  baseFrequency="1.61"
                  numOctaves="5"
                  stitchTiles="stitch"
                />
              </filter>

              <rect width="100%" height="100%" filter="url(#noiseFilter)" />
            </svg>
          </div>
        </div>

        <div className="flex flex-col gap-5 shrink text-pretty relative">
          <h1 className="text-5xl sm:text-6xl font-bold leading-none">
            Organize your daily tasks <span className="text-primary">effortlessly</span>
          </h1>

          <p className="text-xl text-foreground/70">
            Dailify helps you manage your day-to-day tasks with a simple, intuitive interface. Stay
            organized, focused, and productive.
          </p>

          <div className="flex gap-5 w-full">
            <Button size="lg" className="bg-primary shrink border border-primary cursor-pointer">
              Get Started — It's Free
            </Button>

            <Button
              size="lg"
              className="shrink bg-background hover:bg-background/70 cursor-pointer text-foreground border"
            >
              See how it works
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-xl border p-3 bg-background/70 backdrop-blur-sm relative">
          <div className="flex justify-between items-center">
            <ul className="flex gap-2">
              <li className="size-3 rounded-full bg-red-500" />
              <li className="size-3 rounded-full bg-yellow-500" />
              <li className="size-3 rounded-full bg-green-500" />
            </ul>

            <div className="flex gap-3">
              <Button variant={"outline"} className="size-7">
                <SunIcon />
              </Button>

              <div className="rounded-full size-7 aspect-square bg-muted-foreground/30" />
            </div>
          </div>

          <Calendar3 className="bg-background/50" />

          <div className="flex gap-5">
            <Button className="w-full shrink border">
              <PlusIcon />
            </Button>

            <Button className="w-full shrink bg-background hover:bg-background/90 text-foreground border">
              <Calendar1Icon />
            </Button>
          </div>

          <div className="bg-background/50 w-full flex flex-col items-center gap-3 p-3 border rounded-md h-full">
            <span className="text- font-bold">Upcoming Task</span>

            <div className="w-full border border-primary rounded-md p-2 flex flex-col">
              <span className="text-lg font-bold">Dailify</span>
              <span className="text-sm text-muted-foreground">12:00 PM</span>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <span className="text-xl font-bold">Today's Tasks</span>

            <div className="flex items-center gap-1">
              <ClockIcon className="size-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground text-nowrap">
                06:00 AM
              </span>
              <Separator className="shrink" />
            </div>

            <div className="flex flex-col gap-2 bg-background/50 rounded-md border p-3 shadow">
              <div className="flex flex-col w-full">
                <div className="flex w-full justify-between items-center">
                  <span className="text-base font-semibold">task.title</span>

                  <div className="flex items-center gap-2">
                    <Badge variant={"outline"} className="">
                      1h
                    </Badge>
                  </div>
                </div>

                <p className="text-sm font-medium text-muted-foreground">task.description</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <ClockIcon className="size-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground text-nowrap">
                09:00 AM
              </span>
              <Separator className="shrink" />
            </div>

            <div className="flex flex-col gap-2 bg-background/50 rounded-md border p-3 shadow">
              <div className="flex flex-col w-full">
                <div className="flex w-full justify-between items-center">
                  <span className="text-base font-semibold">task.title 2</span>

                  <div className="flex items-center gap-2">
                    <Badge variant={"outline"} className="">
                      1h
                    </Badge>
                  </div>
                </div>

                <p className="text-sm font-medium text-muted-foreground">task.description</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 w-full flex flex-col gap-10 items-center px-[clamp(1rem,5vw,24rem)]">
        <div className="max-w-3xl text-center flex flex-col gap-3">
          <h2 className="text-3xl md:text-4xl font-bold">Everything you need to stay organized</h2>

          <p className="text-xl text-foreground/70">
            Dailify combines simplicity with powerful features to help you manage your tasks
            effectively.
          </p>
        </div>

        <ul className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          <li className="bg-background rounded-xl p-6 shadow border">
            <div className="mb-4 p-3 bg-red-500/10 text-primary rounded-lg inline-block">
              <Calendar1Icon />
            </div>
            <h3 className="text-xl font-semibold mb-2">Simple Calendar View</h3>
            <p className="text-foreground/70">
              See all your tasks in a clean, intuitive calendar interface. Plan your days, weeks,
              and months with ease.
            </p>
          </li>

          <li className="bg-background rounded-xl p-6 shadow border">
            <div className="mb-4 p-3 bg-red-500/10 text-primary rounded-lg inline-block">
              <ClockIcon />
            </div>
            <h3 className="text-xl font-semibold mb-2">Time-Based Tasks</h3>
            <p className="text-foreground/70">
              Organize your tasks by time to create a structured daily schedule that keeps you on
              track.
            </p>
          </li>

          <li className="bg-background rounded-xl p-6 shadow border">
            <div className="mb-4 p-3 bg-red-500/10 text-primary rounded-lg inline-block">
              <CheckIcon />
            </div>
            <h3 className="text-xl font-semibold mb-2">Task Prioritization</h3>
            <p className="text-foreground/70">
              Mark tasks as high, medium, or low priority to focus on what matters most.
            </p>
          </li>

          <li className="bg-background rounded-xl p-6 shadow border">
            <div className="mb-4 p-3 bg-red-500/10 text-primary rounded-lg inline-block">
              <ClipboardListIcon />
            </div>
            <h3 className="text-xl font-semibold mb-2">Custom Categories</h3>
            <p className="text-foreground/70">
              Create your own task categories and tags to organize your tasks in a way that makes
              sense for you.
            </p>
          </li>

          <li className="bg-background rounded-xl p-6 shadow border">
            <div className="mb-4 p-3 bg-red-500/10 text-primary rounded-lg inline-block">
              <Clock12Icon />
            </div>
            <h3 className="text-xl font-semibold mb-2">Recurring Tasks</h3>
            <p className="text-foreground/70">
              Set up tasks that repeat daily, weekly, or monthly to maintain your routine without
              extra effort.
            </p>
          </li>

          <li className="bg-background rounded-xl p-6 shadow border">
            <div className="mb-4 p-3 bg-red-500/10 text-primary rounded-lg inline-block">
              <HomeIcon />
            </div>
            <h3 className="text-xl font-semibold mb-2">Smart Notifications</h3>
            <p className="text-foreground/70">
              Get timely reminders for upcoming tasks so you never miss an important deadline.
            </p>
          </li>
        </ul>
      </section>

      <section className="bg-background py-20 px-[clamp(1rem,5vw,24rem)]">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">How Dailify works</h2>
            <p className="text-xl text-foreground/70">
              Getting started is simple. Organize your tasks in just a few steps.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              {
                step: "01",
                title: "Create your tasks",
                description:
                  "Add tasks with details like time, duration, and priority. Set them as one-time or recurring.",
              },
              {
                step: "02",
                title: "Organize your day",
                description:
                  "View your tasks in a clean calendar interface. Rearrange as needed to optimize your schedule.",
              },
              {
                step: "03",
                title: "Stay on track",
                description:
                  "Mark tasks as completed, receive reminders, and maintain your productivity momentum.",
              },
            ].map((step, index) => (
              <div key={index} className="text-center">
                <div className="w-16 h-16 bg-red-500/5 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-red-500 font-bold">{step.step}</span>
                </div>
                <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
                <p className="text-foreground/70">{step.description}</p>
              </div>
            ))}
          </div>

          <div className="mt-16 text-center">
            <Button size="lg" className="bg-red-500 hover:bg-red-600 text-white">
              Get Started Now
            </Button>
          </div>
        </div>
      </section>

      <section className="py-20 px-[clamp(1rem,5vw,24rem)]">
        <div className="px-4">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Loved by productive people</h2>
            <p className="text-xl text-foreground/70">
              See what our users have to say about how Dailify has transformed their productivity.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                quote:
                  "Dailify has completely changed how I organize my day. The simple interface makes it easy to plan and stay on track.",
                name: "Sarah Johnson",
                title: "Marketing Manager",
              },
              {
                quote:
                  "As a freelancer juggling multiple projects, Dailify helps me prioritize tasks and never miss a deadline. It's become essential to my workflow.",
                name: "Miguel Rodriguez",
                title: "Freelance Designer",
              },
              {
                quote:
                  "The recurring task feature saves me so much time. I set up my routine once, and Dailify takes care of the rest.",
                name: "Aisha Patel",
                title: "Software Developer",
              },
            ].map((testimonial, index) => (
              <div key={index} className="bg-background rounded-xl p-6 shadow-sm border grid">
                <div className="mb-4">
                  {[...Array(5)].map((_, i) => (
                    <span key={i} className="text-yellow-400">
                      ★
                    </span>
                  ))}
                </div>

                <p className="text-foreground/70 mb-4">"{testimonial.quote}"</p>

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                  <div>
                    <h4 className="font-medium text-foreground">{testimonial.name}</h4>
                    <p className="text-sm text-foreground/30">{testimonial.title}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-background px-[clamp(1rem,5vw,24rem)] relative">
        <div className="absolute w-full h-full top-0 left-0">
          <img
            src="./blobs-bottom.620ca521.jpg"
            alt=""
            className="size-full object-cover invert dark:invert-0"
          />

          <div className="absolute left-0 top-0 size-full mix-blend-soft-light">
            <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <filter id="noiseFilter">
                <feTurbulence
                  type="fractalNoise"
                  baseFrequency="1.61"
                  numOctaves="5"
                  stitchTiles="stitch"
                />
              </filter>

              <rect width="100%" height="100%" filter="url(#noiseFilter)" />
            </svg>
          </div>
        </div>

        <div className="px-4 relative">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Simple, transparent pricing</h2>
            <p className="text-xl text-foreground/70">
              Start for free, upgrade when you need more features.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                name: "Free",
                price: "$0",
                description: "Perfect for getting started",
                features: [
                  "Up to 10 daily tasks",
                  "Basic calendar view",
                  "Task prioritization",
                  "Mobile access",
                ],
                buttonText: "Get Started",
                popular: false,
              },
              {
                name: "Pro",
                price: "$5",
                period: "per month",
                description: "For busy individuals",
                features: [
                  "Unlimited tasks",
                  "Advanced calendar views",
                  "Recurring tasks",
                  "Custom categories",
                  "Priority support",
                ],
                buttonText: "Upgrade to Pro",
                popular: true,
              },
              {
                name: "Team",
                price: "$12",
                period: "per user/month",
                description: "For teams and organizations",
                features: [
                  "Everything in Pro",
                  "Team collaboration",
                  "Shared calendars",
                  "Task delegation",
                  "Admin controls",
                  // "API access",
                ],
                buttonText: "Contact Sales",
                popular: false,
              },
            ].map((plan, index) => (
              <div
                key={index}
                className={`flex flex-col relative rounded-xl p-6 border bg-background/70 shadow backdrop-blur-sm`}
              >
                <div className="absolute left-0 top-0 size-full mix-blend-soft-light dark:invert opacity-70">
                  <svg
                    width="100%"
                    height="100%"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                  >
                    <filter id="noiseFilter">
                      <feTurbulence
                        type="fractalNoise"
                        baseFrequency="1.61"
                        numOctaves="5"
                        stitchTiles="stitch"
                      />
                    </filter>

                    <rect width="100%" height="100%" filter="url(#noiseFilter)" />
                  </svg>
                </div>

                {plan.popular && (
                  <Badge className="bg-red-500 text-white hover:bg-red-600 absolute top-7 right-6">
                    Most Popular
                  </Badge>
                )}

                <div className="mb-6 relative">
                  <h3 className="text-2xl font-bold text-foreground">{plan.name}</h3>

                  <div className="mb-1">
                    <span className="text-3xl font-bold">{plan.price}</span>
                    {plan.period && <span className="text-foreground/70"> /{plan.period}</span>}
                  </div>

                  <p className="text-foreground/70">{plan.description}</p>
                </div>

                <ul className="space-y-3 mb-8 h-full relative">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <Check size={16} className="text-green-500" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  className={`w-full cursor-pointer relative ${plan.popular && "bg-primary hover:bg-primary/70 text-white"}`}
                  variant={plan.popular ? "default" : "outline"}
                >
                  {plan.buttonText}
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-primary text-white px-[clamp(1rem,5vw,24rem)]">
        <div className="text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to organize your day?</h2>

          <p className="text-xl mb-8">
            Join thousands of users who have transformed their productivity with Dailify.
          </p>

          <Button size="lg" className="bg-white text-black hover:bg-gray-100">
            Get Started — It's Free
          </Button>
        </div>
      </section>

      <footer className="py-12 bg-background text-foreground px-[clamp(1rem,5vw,24rem)]">
        <div className="grid md:grid-cols-4 gap-8 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-4 relative">
              <div className="size-8 relative">
                <img
                  src="/dailify_logo_2.png"
                  alt="Dailify Logo"
                  className="absolute w-full h-full object-cover invert dark:invert-0"
                />
              </div>

              <span className="text-xl font-bold">Dailify</span>
            </div>

            <p className="text-gray-400 mb-4">
              The simple way to organize your daily tasks and boost your productivity.
            </p>

            <div className="flex gap-4">
              <a href="#" className="text-gray-400 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fillRule="evenodd"
                    d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z"
                    clipRule="evenodd"
                  ></path>
                </svg>
              </a>
              <a href="#" className="text-gray-400 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84"></path>
                </svg>
              </a>
              <a href="#" className="text-gray-400 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fillRule="evenodd"
                    d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z"
                    clipRule="evenodd"
                  ></path>
                </svg>
              </a>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-4">Product</h3>
            <ul className="space-y-2">
              <li>
                <a href="#features" className="text-gray-400 hover:text-white transition-colors">
                  Features
                </a>
              </li>
              <li>
                <a href="#pricing" className="text-gray-400 hover:text-white transition-colors">
                  Pricing
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-400 hover:text-white transition-colors">
                  Integrations
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-400 hover:text-white transition-colors">
                  Changelog
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-4">Resources</h3>
            <ul className="space-y-2">
              <li>
                <a href="#" className="text-gray-400 hover:text-white transition-colors">
                  Help Center
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-400 hover:text-white transition-colors">
                  Blog
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-400 hover:text-white transition-colors">
                  Tutorials
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-400 hover:text-white transition-colors">
                  API Documentation
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-4">Company</h3>
            <ul className="space-y-2">
              <li>
                <a href="#" className="text-gray-400 hover:text-white transition-colors">
                  About Us
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-400 hover:text-white transition-colors">
                  Careers
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-400 hover:text-white transition-colors">
                  Privacy Policy
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-400 hover:text-white transition-colors">
                  Terms of Service
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 pt-8">
          <p className="text-gray-400 text-center">© 2025 Dailify. All rights reserved.</p>
        </div>
      </footer>
    </main>
  );
}
