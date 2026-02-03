import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BentoCard, BentoGrid } from "@/components/ui/bento-grid";
import { cn } from "@/lib/utils";
import { Marquee } from "@/components/ui/marquee";
import { AnimatedList } from "@/components/ui/animated-list";
import {
  FileText,
  Rocket,
  Bell,
  Users,
  Cloud,
  Heart,
  BarChart3
} from "lucide-react";

interface Notification {
  name: string;
  description: string;
  time: string;
  icon: string;
  color: string;
}

let notifications = [
  {
    name: "New User",
    description: "John joined the team",
    time: "15m ago",
    icon: "👤",
    color: "#FF6B6B",
  },
  {
    name: "Deploy Success",
    description: "Production build completed",
    time: "10m ago",
    icon: "✅",
    color: "#4CAF50",
  },
  {
    name: "New Message",
    description: "Sarah sent you a message",
    time: "5m ago",
    icon: "💬",
    color: "#2196F3",
  },
  {
    name: "Error Alert",
    description: "API rate limit exceeded",
    time: "2m ago",
    icon: "⚠️",
    color: "#FF9800",
  },
];

notifications = Array.from({ length: 10 }, () => notifications).flat();

const Notification = ({ name, description, icon, color, time }: Notification) => {
  return (
    <figure
      className={cn(
        "relative mx-auto min-h-fit w-full max-w-[400px] cursor-pointer overflow-hidden rounded-2xl p-4",
        "transition-all duration-200 ease-in-out hover:scale-[103%]",
        "bg-white [box-shadow:0_0_0_1px_rgba(0,0,0,.03),0_2px_4px_rgba(0,0,0,.05),0_12px_24px_rgba(0,0,0,.05)]",
        "dark:bg-transparent dark:backdrop-blur-md dark:[border:1px_solid_rgba(255,255,255,.1)] dark:[box-shadow:0_-20px_80px_-20px_#ffffff1f_inset]"
      )}
    >
      <div className="flex flex-row items-center gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-2xl"
          style={{
            backgroundColor: color,
          }}
        >
          <span className="text-lg">{icon}</span>
        </div>
        <div className="flex flex-col overflow-hidden">
          <figcaption className="flex flex-row items-center whitespace-pre text-lg font-medium dark:text-white">
            <span className="text-sm sm:text-lg">{name}</span>
            <span className="mx-1">·</span>
            <span className="text-xs text-gray-500">{time}</span>
          </figcaption>
          <p className="text-sm font-normal dark:text-white/60">
            {description}
          </p>
        </div>
      </div>
    </figure>
  );
};

export default function Page() {
  const files = [
    { name: "database.sql", body: "PostgreSQL database schema with optimized indexes for high-performance queries", icon: "🗄️" },
    { name: "api-config.json", body: "REST API configuration with rate limiting and authentication settings", icon: "⚙️" },
    { name: "deployment.yaml", body: "Kubernetes deployment configuration for containerized applications", icon: "🚀" },
    { name: "security-keys.pem", body: "SSL/TLS certificates and private keys for secure communications", icon: "🔐" },
    { name: "analytics.js", body: "Real-time analytics tracking script with privacy-first approach", icon: "📊" },
  ];

  const features = [
    {
      Icon: FileText,
      name: "Auto-Save Files",
      description: "Never lose your work with automatic file saving as you type",
      href: "/",
      cta: "Learn more",
      className: "lg:col-span-1 lg:row-span-1 h-[280px]",
      background: (
        <Marquee
          pauseOnHover
          className="absolute top-10 [--duration:20s] [mask-image:linear-gradient(to_top,transparent_40%,#000_100%)]"
        >
          {files.map((f, idx) => (
            <figure
              key={idx}
              className={cn(
                "relative w-32 cursor-pointer overflow-hidden rounded-xl border p-4",
                "border-gray-950/[.1] bg-gray-950/[.01] hover:bg-gray-950/[.05]",
                "dark:border-gray-50/[.1] dark:bg-gray-50/[.10] dark:hover:bg-gray-50/[.15]",
                "transform-gpu blur-[1px] transition-all duration-300 ease-out hover:blur-none"
              )}
            >
              <div className="flex flex-row items-center gap-2">
                <div className="text-2xl">{f.icon}</div>
                <div className="flex flex-col">
                  <figcaption className="text-sm font-medium dark:text-white">
                    {f.name}
                  </figcaption>
                </div>
              </div>
              <blockquote className="mt-2 text-xs">{f.body}</blockquote>
            </figure>
          ))}
        </Marquee>
      ),
    },

    {
      Icon: Bell,
      name: "Real-time Notifications",
      description: "Stay updated with instant notifications for all events",
      href: "/",
      cta: "Learn more",
      className: "lg:col-span-1 lg:row-span-2 h-[600px]",
      background: (
        <div className="absolute right-2 top-4 h-[300px] w-full scale-90 mask-[linear-gradient(to_top,transparent_10%,#000_100%)]">
          <AnimatedList>
            {notifications.map((item, idx) => (
              <Notification {...item} key={idx} />
            ))}
          </AnimatedList>
        </div>
      ),
    },
    {
      Icon: Users,
      name: "Team Collaboration",
      description: "Work together seamlessly with real-time collaboration tools",
      href: "/",
      cta: "Learn more",
      className: "lg:col-span-1 lg:row-span-2 h-[600px]",
      background: (
        <Marquee
          pauseOnHover
          className="absolute top-10 [--duration:25s] [mask-image:linear-gradient(to_top,transparent_40%,#000_100%)]"
          vertical
        >
          {[
            { name: "Alex", role: "Designer", avatar: "🎨", color: "#FF6B6B" },
            { name: "Sarah", role: "Developer", avatar: "👩‍💻", color: "#4CAF50" },
            { name: "Mike", role: "PM", avatar: "📊", color: "#2196F3" },
            { name: "Emma", role: "Engineer", avatar: "⚙️", color: "#FF9800" },
            { name: "Chris", role: "Designer", avatar: "🎨", color: "#9C27B0" },
            { name: "Lisa", role: "Developer", avatar: "👨‍💻", color: "#00BCD4" },
          ].map((member, idx) => (
            <div
              key={idx}
              className="mx-auto my-2 flex w-48 items-center gap-3 rounded-xl border border-gray-950/[.1] bg-gray-950/[.01] p-3 dark:border-gray-50/[.1] dark:bg-gray-50/[.10]"
            >
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full text-xl"
                style={{ backgroundColor: member.color }}
              >
                {member.avatar}
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold dark:text-white">{member.name}</span>
                <span className="text-xs text-gray-500">{member.role}</span>
              </div>
            </div>
          ))}
        </Marquee>
      ),
    },
    {
      Icon: Cloud,
      name: "Cloud Native",
      description: "Scale effortlessly with cloud infrastructure",
      href: "/",
      cta: "Learn more",
      className: "lg:col-span-1 lg:row-span-1 h-[280px]",
      background: (
        <div className="absolute inset-0 flex flex-col gap-4 overflow-hidden">
          <Marquee
            pauseOnHover
            className="[--duration:20s] [mask-image:linear-gradient(to_right,transparent,#000_20%,#000_80%,transparent)]"
          >
            {["☁️", "🔧", "🚀", "⚡", "🔐", "📊", "🌐", "💾"].map((icon, idx) => (
              <div
                key={idx}
                className="mx-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500/80 to-orange-600/80 text-3xl shadow-lg backdrop-blur-sm"
              >
                {icon}
              </div>
            ))}
          </Marquee>
          <Marquee
            pauseOnHover
            reverse
            className="[--duration:20s] [mask-image:linear-gradient(to_right,transparent,#000_20%,#000_80%,transparent)]"
          >
            {["🔄", "📡", "🛡️", "📈", "🎯", "⚙️", "🔗", "💡"].map((icon, idx) => (
              <div
                key={idx}
                className="mx-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-400/80 to-orange-500/80 text-3xl shadow-lg backdrop-blur-sm"
              >
                {icon}
              </div>
            ))}
          </Marquee>
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-background dark">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="text-xl font-bold text-primary">
              ScaleField
            </Link>
            <div className="flex items-center gap-4">
              <Link href="#features" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                Features
              </Link>
              <Link href="#pricing" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                Pricing
              </Link>
              <Link href="/login">
                <Button variant="ghost" size="sm">
                  Log in
                </Button>
              </Link>
              <Link href="/signup">
                <Button size="sm">
                  Get Started
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-linear-to-b from-primary/5 via-transparent to-transparent" />
        <div className="absolute top-40 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />

        <div className="container mx-auto max-w-5xl text-center relative z-10">

          <h1 className="text-6xl sm:text-7xl lg:text-8xl font-bold mb-6 leading-tight">
            Build faster.<br />
            <span className="text-primary">Scale smarter.</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-12 max-w-3xl mx-auto">
            The all-in-one platform for modern teams. Ship products faster with our
            powerful tools and seamless integrations.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link href="/dashboard">
            <Button size="lg" className="text-lg px-8">
              Start Free Trial
            </Button>
            </Link>
            <Button size="lg" variant="outline" className="text-lg px-8">
              Watch Demo
            </Button>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 border-y border-border">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-4xl font-bold text-primary mb-2">10K+</div>
              <div className="text-sm text-muted-foreground">Active Users</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-primary mb-2">99.9%</div>
              <div className="text-sm text-muted-foreground">Uptime</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-primary mb-2">150+</div>
              <div className="text-sm text-muted-foreground">Countries</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-primary mb-2">24/7</div>
              <div className="text-sm text-muted-foreground">Support</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section with Bento Grid */}
      <section id="features" className="py-32 px-4">
        <div className="container mx-auto max-w-7xl">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 mb-6 rounded-full border border-border bg-muted/50">
              <span className="text-xs text-primary font-medium">FEATURES</span>
            </div>
            <h2 className="text-5xl font-bold mb-6">
              Everything you need.<br />
              <span className="text-primary">Nothing you don't.</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Powerful features built for modern teams. Ship faster without compromising on quality.
            </p>
          </div>

          <BentoGrid className="max-w-6xl mx-auto">
            {features.map((feature) => (
              <BentoCard key={feature.name} {...feature} />
            ))}
          </BentoGrid>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-16 border-y border-border">
        <div className="container mx-auto px-4">
          <div className="text-center text-xs text-muted-foreground mb-12 uppercase tracking-wider">
            Trusted by leading companies worldwide
          </div>
          <div className="flex items-center justify-center gap-16 flex-wrap opacity-40">
            <div className="text-2xl font-bold text-muted-foreground">ACME</div>
            <div className="text-2xl font-bold text-muted-foreground">ZENITH</div>
            <div className="text-2xl font-bold text-muted-foreground">NOVA</div>
            <div className="text-2xl font-bold text-muted-foreground">APEX</div>
            <div className="text-2xl font-bold text-muted-foreground">PULSE</div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32 px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-linear-to-b from-transparent via-primary/5 to-transparent" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />

        <div className="container mx-auto max-w-3xl text-center relative z-10">
          <div className="w-20 h-20 mx-auto mb-8 bg-primary rounded-2xl flex items-center justify-center rotate-3 shadow-2xl shadow-primary/30">
            <Heart className="w-10 h-10 text-primary-foreground" />
          </div>
          <h2 className="text-5xl font-bold mb-6">
            Ready to scale?
          </h2>
          <p className="text-xl text-muted-foreground mb-12">
            Join thousands of teams building the future. Start your free trial today.
          </p>
          <Button size="lg" className="text-lg px-12">
            Get Started Free →
          </Button>
          <p className="text-sm text-muted-foreground mt-6">No credit card required • 14-day free trial</p>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-32 px-4 bg-muted/20">
        <div className="container mx-auto max-w-7xl">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 mb-6 rounded-full border border-border bg-muted/50">
              <span className="text-xs text-primary font-medium">PRICING</span>
            </div>
            <h2 className="text-5xl font-bold mb-6">
              Simple, transparent pricing
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Choose the plan that fits your needs. All plans include a 14-day free trial.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Starter Plan */}
            <div className="relative bg-card/50 backdrop-blur-sm border border-border p-8 hover:border-primary/40 transition-colors">
              <h3 className="text-2xl font-bold mb-2">Starter</h3>
              <p className="text-muted-foreground text-sm mb-6">Perfect for individuals and small teams</p>
              <div className="mb-8">
                <span className="text-5xl font-bold">$9</span>
                <span className="text-muted-foreground">/month</span>
              </div>
              <Button className="w-full mb-8" variant="secondary">
                Start Free Trial
              </Button>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <span className="text-primary mt-1">✓</span>
                  <span className="text-foreground/80">Up to 5 team members</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-primary mt-1">✓</span>
                  <span className="text-foreground/80">10 GB storage</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-primary mt-1">✓</span>
                  <span className="text-foreground/80">Basic analytics</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-primary mt-1">✓</span>
                  <span className="text-foreground/80">Email support</span>
                </li>
              </ul>
            </div>

            {/* Pro Plan */}
            <div className="relative bg-primary/10 border-2 border-primary/50 p-8 transform scale-105">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-primary text-primary-foreground text-xs font-semibold rounded-full">
                MOST POPULAR
              </div>
              <h3 className="text-2xl font-bold mb-2">Pro</h3>
              <p className="text-muted-foreground text-sm mb-6">For growing teams and businesses</p>
              <div className="mb-8">
                <span className="text-5xl font-bold text-primary">$29</span>
                <span className="text-muted-foreground">/month</span>
              </div>
              <Button className="w-full mb-8">
                Start Free Trial
              </Button>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <span className="text-primary mt-1">✓</span>
                  <span className="text-foreground/80">Unlimited team members</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-primary mt-1">✓</span>
                  <span className="text-foreground/80">100 GB storage</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-primary mt-1">✓</span>
                  <span className="text-foreground/80">Advanced analytics</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-primary mt-1">✓</span>
                  <span className="text-foreground/80">Priority support</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-primary mt-1">✓</span>
                  <span className="text-foreground/80">Custom integrations</span>
                </li>
              </ul>
            </div>

            {/* Enterprise Plan */}
            <div className="relative bg-card/50 backdrop-blur-sm border border-border p-8 hover:border-primary/40 transition-colors">
              <h3 className="text-2xl font-bold mb-2">Enterprise</h3>
              <p className="text-muted-foreground text-sm mb-6">For large-scale organizations</p>
              <div className="mb-8">
                <span className="text-5xl font-bold">Custom</span>
              </div>
              <Button className="w-full mb-8" variant="secondary">
                Contact Sales
              </Button>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <span className="text-primary mt-1">✓</span>
                  <span className="text-foreground/80">Unlimited everything</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-primary mt-1">✓</span>
                  <span className="text-foreground/80">Dedicated infrastructure</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-primary mt-1">✓</span>
                  <span className="text-foreground/80">Custom analytics</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-primary mt-1">✓</span>
                  <span className="text-foreground/80">24/7 phone support</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-primary mt-1">✓</span>
                  <span className="text-foreground/80">SLA guarantee</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-16">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            <div>
              <div className="text-2xl font-bold text-primary mb-4">ScaleField</div>
              <p className="text-sm text-muted-foreground">
                Building the future of development, one line at a time.
              </p>
            </div>
            <div>
              <div className="text-sm font-semibold mb-4 text-muted-foreground">PRODUCT</div>
              <ul className="space-y-3 text-sm">
                <li><Link href="#" className="text-muted-foreground hover:text-primary transition-colors">Features</Link></li>
                <li><Link href="#" className="text-muted-foreground hover:text-primary transition-colors">Pricing</Link></li>
                <li><Link href="#" className="text-muted-foreground hover:text-primary transition-colors">Documentation</Link></li>
                <li><Link href="#" className="text-muted-foreground hover:text-primary transition-colors">API</Link></li>
              </ul>
            </div>
            <div>
              <div className="text-sm font-semibold mb-4 text-muted-foreground">COMPANY</div>
              <ul className="space-y-3 text-sm">
                <li><Link href="#" className="text-muted-foreground hover:text-primary transition-colors">About</Link></li>
                <li><Link href="#" className="text-muted-foreground hover:text-primary transition-colors">Blog</Link></li>
                <li><Link href="#" className="text-muted-foreground hover:text-primary transition-colors">Careers</Link></li>
                <li><Link href="#" className="text-muted-foreground hover:text-primary transition-colors">Contact</Link></li>
              </ul>
            </div>
            <div>
              <div className="text-sm font-semibold mb-4 text-muted-foreground">LEGAL</div>
              <ul className="space-y-3 text-sm">
                <li><Link href="#" className="text-muted-foreground hover:text-primary transition-colors">Privacy</Link></li>
                <li><Link href="#" className="text-muted-foreground hover:text-primary transition-colors">Terms</Link></li>
                <li><Link href="#" className="text-muted-foreground hover:text-primary transition-colors">Security</Link></li>
              </ul>
            </div>
          </div>

          <div className="flex items-center justify-between pt-8 border-t border-border">
            <div className="text-sm text-muted-foreground">
              © 2026 ScaleField. All rights reserved.
            </div>
            <div className="flex gap-6">
              <Link href="#" className="text-muted-foreground hover:text-primary transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                </svg>
              </Link>
              <Link href="#" className="text-muted-foreground hover:text-primary transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
                </svg>
              </Link>
              <Link href="#" className="text-muted-foreground hover:text-primary transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );  
}