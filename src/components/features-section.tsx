"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// Feature data
const features = [
  {
    icon: "⚡",
    title: "Lightning Fast",
    description: "Deploy your applications in seconds with our optimized infrastructure and CDN network.",
  },
  {
    icon: "🔒",
    title: "Secure by Default",
    description: "Enterprise-grade security with automatic SSL, DDoS protection, and data encryption.",
  },
  {
    icon: "📊",
    title: "Real-time Analytics",
    description: "Monitor your application performance with detailed metrics and insights.",
  },
  {
    icon: "🔄",
    title: "Auto-Scaling",
    description: "Automatically scale your resources based on traffic without manual intervention.",
  },
  {
    icon: "🌍",
    title: "Global CDN",
    description: "Serve your content from 200+ edge locations worldwide for optimal performance.",
  },
  {
    icon: "🛠️",
    title: "Developer Tools",
    description: "Comprehensive CLI, APIs, and integrations with your favorite development tools.",
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="py-20 md:py-32 bg-muted/30">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <div className="inline-flex items-center px-4 py-1.5 bg-primary/10 rounded-full text-sm font-medium text-primary mb-4">
            Features
          </div>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight">
            Everything You Need to{" "}
            <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Scale Fast
            </span>
          </h2>
          <p className="text-lg text-muted-foreground">
            Powerful features designed to help you build and scale your SaaS without the complexity.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {features.map((feature, index) => (
            <Card
              key={index}
              className="group relative overflow-hidden border-border hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:-translate-y-1"
            >
              {/* Hover gradient effect */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

              <CardHeader className="relative">
                {/* Icon */}
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 text-2xl group-hover:scale-110 transition-transform duration-300">
                  {feature.icon}
                </div>

                <CardTitle className="text-xl font-semibold">{feature.title}</CardTitle>
              </CardHeader>

              <CardContent className="relative">
                <CardDescription className="text-muted-foreground leading-relaxed">
                  {feature.description}
                </CardDescription>
              </CardContent>

              {/* Bottom accent line */}
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-primary/60 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
            </Card>
          ))}
        </div>

        {/* Additional CTA */}
        <div className="mt-16 text-center">
          <p className="text-muted-foreground mb-4">
            Need something specific? We have custom solutions for enterprise needs.
          </p>
          <button className="text-primary font-medium hover:underline inline-flex items-center">
            Contact Sales
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
        </div>
      </div>
    </section>
  );
}
