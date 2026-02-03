"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Download01Icon,
  CreditCardIcon,
  ArrowRight01Icon,
} from "@hugeicons/core-free-icons";

interface UsageMetric {
  name: string;
  current: number;
  limit: number;
  unit: string;
  percentage: number;
}

interface Invoice {
  id: string;
  date: string;
  amount: number;
  status: "paid" | "pending" | "failed";
  period: string;
  invoiceNumber: string;
}

interface PaymentMethod {
  id: string;
  type: "card" | "bank";
  last4: string;
  brand?: string;
  expiryDate?: string;
  isDefault: boolean;
}

const mockUsage: UsageMetric[] = [
  {
    name: "API Requests",
    current: 847230,
    limit: 1000000,
    unit: "requests",
    percentage: 84.7,
  },
  {
    name: "Storage",
    current: 42.3,
    limit: 100,
    unit: "GB",
    percentage: 42.3,
  },
  {
    name: "Bandwidth",
    current: 156.8,
    limit: 500,
    unit: "GB",
    percentage: 31.4,
  },
  {
    name: "Team Members",
    current: 5,
    limit: 10,
    unit: "seats",
    percentage: 50,
  },
];

const mockInvoices: Invoice[] = [
  {
    id: "1",
    date: "2026-01-01",
    amount: 149.0,
    status: "paid",
    period: "Dec 2025",
    invoiceNumber: "INV-2026-001",
  },
  {
    id: "2",
    date: "2025-12-01",
    amount: 149.0,
    status: "paid",
    period: "Nov 2025",
    invoiceNumber: "INV-2025-012",
  },
  {
    id: "3",
    date: "2025-11-01",
    amount: 149.0,
    status: "paid",
    period: "Oct 2025",
    invoiceNumber: "INV-2025-011",
  },
  {
    id: "4",
    date: "2025-10-01",
    amount: 99.0,
    status: "paid",
    period: "Sep 2025",
    invoiceNumber: "INV-2025-010",
  },
];

const mockPaymentMethod: PaymentMethod = {
  id: "1",
  type: "card",
  last4: "4242",
  brand: "Visa",
  expiryDate: "12/2027",
  isDefault: true,
};

export default function BillingPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-xl sm:text-2xl font-semibold mb-1">Billing</h1>
        <p className="text-sm text-muted-foreground">
          Manage your subscription and billing information
        </p>
      </div>

      {/* Current plan */}
      <div className="mb-8 pb-8 border-b border-border">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
          Current Plan
        </h2>

        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="text-lg font-semibold mb-1">Pro Plan</div>
            <div className="text-sm text-muted-foreground">
              $149.00 / month • Renews Feb 1, 2026
            </div>
          </div>
          <Button variant="outline" size="sm">
            Change Plan
          </Button>
        </div>

        <div className="space-y-1.5 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Billing cycle:</span>
            <span className="font-medium">Monthly</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Next payment:</span>
            <span className="font-medium">$149.00 on Feb 1, 2026</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Payment method:</span>
            <span className="font-medium">
              {mockPaymentMethod.brand} •••• {mockPaymentMethod.last4}
            </span>
          </div>
        </div>
      </div>

      {/* Usage */}
      <div className="mb-8 pb-8 border-b border-border">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
          Usage This Month
        </h2>

        <div className="space-y-4">
          {mockUsage.map((metric) => (
            <div key={metric.name}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">{metric.name}</span>
                <span className="text-sm text-muted-foreground">
                  {metric.current.toLocaleString()} / {metric.limit.toLocaleString()}{" "}
                  {metric.unit}
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    metric.percentage >= 90
                      ? "bg-red-500"
                      : metric.percentage >= 75
                      ? "bg-yellow-500"
                      : "bg-green-500"
                  }`}
                  style={{ width: `${Math.min(metric.percentage, 100)}%` }}
                />
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {metric.percentage.toFixed(1)}% used
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Payment method */}
      <div className="mb-8 pb-8 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Payment Method
          </h2>
          <Button variant="outline" size="sm">
            Update
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-12 h-8 rounded border border-border bg-muted flex items-center justify-center">
            <HugeiconsIcon
              icon={CreditCardIcon}
              className="h-5 w-5 text-muted-foreground"
            />
          </div>
          <div>
            <div className="text-sm font-medium">
              {mockPaymentMethod.brand} ending in {mockPaymentMethod.last4}
            </div>
            <div className="text-xs text-muted-foreground">
              Expires {mockPaymentMethod.expiryDate}
            </div>
          </div>
        </div>
      </div>

      {/* Invoices */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
          Invoice History
        </h2>

        <div className="space-y-0">
          {mockInvoices.map((invoice, index) => (
            <div
              key={invoice.id}
              className={`py-3 border-b border-border hover:bg-muted/30 transition-colors ${
                index === 0 ? "border-t" : ""
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-medium">
                        {invoice.period}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          invoice.status === "paid"
                            ? "bg-green-500/10 text-green-700 dark:text-green-400"
                            : invoice.status === "pending"
                            ? "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400"
                            : "bg-red-500/10 text-red-700 dark:text-red-400"
                        }`}
                      >
                        {invoice.status}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {invoice.invoiceNumber} • Issued {invoice.date}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium">
                    ${invoice.amount.toFixed(2)}
                  </span>
                  <Button variant="ghost" size="sm" className="gap-2">
                    <HugeiconsIcon icon={Download01Icon} className="h-4 w-4" />
                    PDF
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4">
          <Button variant="outline" size="sm" className="gap-2">
            View All Invoices
            <HugeiconsIcon icon={ArrowRight01Icon} className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
