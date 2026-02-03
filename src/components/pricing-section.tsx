"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// Pricing tier data
const pricingTiers = [
  {
    name: "Starter",
    price: "$0",
    period: "forever",
    description: "Perfect for hobby projects and getting started",
    features: [
      "Up to 3 projects",
      "5 GB storage",
      "100 GB bandwidth",
      "Community support",
      "Basic analytics",
    ],
    cta: "Get Started",
    popular: false,
  },
  {
    name: "Professional",
    price: "$29",
    period: "per month",
    description: "Best for growing teams and businesses",
    features: [
      "Unlimited projects",
      "100 GB storage",
      "1 TB bandwidth",
      "Priority support",
      "Advanced analytics",
      "Custom domains",
      "Team collaboration",
    ],
    cta: "Start Free Trial",
    popular: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "contact us",
    description: "For large-scale applications with custom needs",
    features: [
      "Everything in Professional",
      "Unlimited storage",
      "Unlimited bandwidth",
      "24/7 dedicated support",
      "Custom SLA",
      "Advanced security",
      "On-premise deployment",
    ],
    cta: "Contact Sales",
    popular: false,
  },
];

export function PricingSection() {
  return (
    <section id="pricing" className="py-20 md:py-32 bg-muted/30">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <div className="inline-flex items-center px-4 py-1.5 bg-primary/10 rounded-full text-sm font-medium text-primary mb-4">
            Pricing
          </div>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight">
            Simple,{" "}
            <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Transparent Pricing
            </span>
          </h2>
          <p className="text-lg text-muted-foreground">
            Choose the perfect plan for your needs. No hidden fees, cancel anytime.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 max-w-6xl mx-auto">
          {pricingTiers.map((tier, index) => (
            <Card
              key={index}
              className={`relative overflow-hidden transition-all duration-300 ${
                tier.popular
                  ? "border-primary shadow-lg scale-105 md:scale-110"
                  : "border-border hover:border-primary/50 hover:shadow-lg"
              }`}
            >
              {/* Popular badge */}
              {tier.popular && (
                <div className="absolute top-0 right-0 left-0">
                  <div className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground text-xs font-semibold py-2 text-center">
                    MOST POPULAR
                  </div>
                </div>
              )}

              <CardHeader className={tier.popular ? "pt-10" : ""}>
                <CardTitle className="text-2xl">{tier.name}</CardTitle>
                <CardDescription className="text-base">{tier.description}</CardDescription>
              </CardHeader>

              <CardContent className="space-y-6">
                {/* Price */}
                <div className="space-y-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl md:text-5xl font-bold tracking-tight">{tier.price}</span>
                    {tier.price !== "Custom" && <span className="text-muted-foreground text-sm">USD</span>}
                  </div>
                  <p className="text-sm text-muted-foreground">{tier.period}</p>
                </div>

                {/* Features list */}
                <ul className="space-y-3">
                  {tier.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-start gap-3">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-primary flex-shrink-0 mt-0.5"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      <span className="text-sm text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>

              <CardFooter>
                <Button
                  className={`w-full ${tier.popular ? "bg-primary hover:bg-primary/90" : ""}`}
                  variant={tier.popular ? "default" : "outline"}
                  size="lg"
                >
                  {tier.cta}
                </Button>
              </CardFooter>

              {/* Gradient decoration for popular card */}
              {tier.popular && (
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
              )}
            </Card>
          ))}
        </div>

        {/* FAQ or Additional Info */}
        <div className="mt-16 text-center space-y-4">
          <p className="text-muted-foreground">
            All plans include 14-day free trial. No credit card required.
          </p>
          <div className="flex flex-wrap justify-center gap-6 text-sm">
            <button className="text-primary hover:underline inline-flex items-center">
              Compare plans
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="ml-1"
              >
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
            <span className="text-muted-foreground">•</span>
            <button className="text-primary hover:underline">View FAQ</button>
            <span className="text-muted-foreground">•</span>
            <button className="text-primary hover:underline">Contact us</button>
          </div>
        </div>
      </div>
    </section>
  );
}
