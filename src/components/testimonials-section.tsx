"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

// Testimonial data
const testimonials = [
  {
    name: "Sarah Johnson",
    role: "CTO at TechFlow",
    avatar: "/avatars/sarah.jpg",
    fallback: "SJ",
    content:
      "Scalefield transformed how we deploy and manage our infrastructure. What used to take days now takes minutes. The auto-scaling feature alone saved us thousands in operational costs.",
    rating: 5,
  },
  {
    name: "Michael Chen",
    role: "Founder at StartupHub",
    avatar: "/avatars/michael.jpg",
    fallback: "MC",
    content:
      "As a startup, we needed a solution that could grow with us. Scalefield delivered exactly that. The developer experience is phenomenal, and the support team is incredibly responsive.",
    rating: 5,
  },
  {
    name: "Emily Rodriguez",
    role: "VP Engineering at DataCorp",
    avatar: "/avatars/emily.jpg",
    fallback: "ER",
    content:
      "The real-time analytics and monitoring capabilities gave us insights we never had before. We can now proactively address issues before they impact our customers. Highly recommended!",
    rating: 5,
  },
];

export function TestimonialsSection() {
  return (
    <section id="testimonials" className="py-20 md:py-32">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <div className="inline-flex items-center px-4 py-1.5 bg-primary/10 rounded-full text-sm font-medium text-primary mb-4">
            Testimonials
          </div>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight">
            Loved by{" "}
            <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Developers & Teams
            </span>
          </h2>
          <p className="text-lg text-muted-foreground">
            See what our customers have to say about their experience with Scalefield.
          </p>
        </div>

        {/* Testimonials Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {testimonials.map((testimonial, index) => (
            <Card
              key={index}
              className="group relative overflow-hidden border-border hover:border-primary/50 transition-all duration-300 hover:shadow-lg"
            >
              <CardContent className="p-6 space-y-4">
                {/* Rating Stars */}
                <div className="flex gap-1">
                  {Array.from({ length: testimonial.rating }).map((_, i) => (
                    <svg
                      key={i}
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="text-yellow-500"
                    >
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                  ))}
                </div>

                {/* Testimonial Content */}
                <p className="text-muted-foreground leading-relaxed">{testimonial.content}</p>

                {/* Author Info */}
                <div className="flex items-center gap-3 pt-4 border-t border-border">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={testimonial.avatar} alt={testimonial.name} />
                    <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                      {testimonial.fallback}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold text-sm">{testimonial.name}</p>
                    <p className="text-xs text-muted-foreground">{testimonial.role}</p>
                  </div>
                </div>

                {/* Quote icon decoration */}
                <div className="absolute top-4 right-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="40"
                    height="40"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="text-primary"
                  >
                    <path d="M4.583 17.321C3.553 16.227 3 15 3 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 01-3.5 3.5c-1.073 0-2.099-.49-2.748-1.179zm10 0C13.553 16.227 13 15 13 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 01-3.5 3.5c-1.073 0-2.099-.49-2.748-1.179z" />
                  </svg>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Additional Social Proof */}
        <div className="mt-16 text-center space-y-6">
          <p className="text-muted-foreground">Trusted by industry leaders</p>
          <div className="flex flex-wrap justify-center items-center gap-8 md:gap-12 opacity-50">
            {/* Logo placeholders - replace with actual logos */}
            <div className="text-2xl font-bold">TechFlow</div>
            <div className="text-2xl font-bold">StartupHub</div>
            <div className="text-2xl font-bold">DataCorp</div>
            <div className="text-2xl font-bold">CloudBase</div>
            <div className="text-2xl font-bold">DevOps+</div>
          </div>
        </div>
      </div>
    </section>
  );
}
