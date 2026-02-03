"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

/**
 * Settings Page
 *
 * Workflow: Navigate settings → Modify → Save → Verify
 * Primary states: Saved, Modified, Saving, Error
 * Decision points: Update settings, manage API keys, configure notifications
 *
 * Using stacked blocks pattern - NO cards
 */

export default function SettingsPage() {
  const [hasChanges, setHasChanges] = React.useState(false);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl font-semibold mb-1">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your account and preferences</p>
      </div>

      {/* Save indicator */}
      {hasChanges && (
        <div className="mb-6 p-3 bg-yellow-500/10 border-l-2 border-yellow-500 text-sm text-yellow-700 dark:text-yellow-400">
          You have unsaved changes
        </div>
      )}

      {/* Account Settings - Stacked Block */}
      <div className="mb-8 pb-8 border-b border-border">
        <h2 className="text-sm font-semibold mb-1">Account</h2>
        <p className="text-xs text-muted-foreground mb-6">
          Basic account information and preferences
        </p>

        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm">
              Full Name
            </Label>
            <Input
              id="name"
              type="text"
              defaultValue="John Doe"
              onChange={() => setHasChanges(true)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              defaultValue="john@company.com"
              onChange={() => setHasChanges(true)}
            />
            <p className="text-xs text-muted-foreground">
              Used for login and notifications
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="company" className="text-sm">
              Company Name
            </Label>
            <Input
              id="company"
              type="text"
              defaultValue="Acme Inc."
              onChange={() => setHasChanges(true)}
            />
          </div>
        </div>
      </div>

      {/* API Keys - Stacked Block */}
      <div className="mb-8 pb-8 border-b border-border">
        <h2 className="text-sm font-semibold mb-1">API Keys</h2>
        <p className="text-xs text-muted-foreground mb-6">
          Manage API keys for programmatic access
        </p>

        <div className="space-y-4">
          {/* Existing API keys list */}
          <div className="space-y-2">
            <div className="px-4 py-3 border border-border rounded-lg">
              <div className="flex items-start justify-between gap-4 mb-2">
                <div className="flex-1">
                  <p className="text-sm font-medium mb-1">Production Key</p>
                  <p className="text-xs font-mono text-muted-foreground">
                    sk_live_***************abc123
                  </p>
                </div>
                <Button variant="outline" size="sm">
                  Revoke
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Created 2 months ago • Last used 5 min ago
              </p>
            </div>

            <div className="px-4 py-3 border border-border rounded-lg">
              <div className="flex items-start justify-between gap-4 mb-2">
                <div className="flex-1">
                  <p className="text-sm font-medium mb-1">Development Key</p>
                  <p className="text-xs font-mono text-muted-foreground">
                    sk_test_***************def456
                  </p>
                </div>
                <Button variant="outline" size="sm">
                  Revoke
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Created 3 months ago • Last used 2 hours ago
              </p>
            </div>
          </div>

          <Button size="sm" variant="outline">
            Create New API Key
          </Button>
        </div>
      </div>

      {/* Notifications - Stacked Block */}
      <div className="mb-8 pb-8 border-b border-border">
        <h2 className="text-sm font-semibold mb-1">Notifications</h2>
        <p className="text-xs text-muted-foreground mb-6">
          Configure how you receive notifications
        </p>

        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4 py-2">
            <div className="flex-1">
              <p className="text-sm font-medium mb-1">Deployment notifications</p>
              <p className="text-xs text-muted-foreground">
                Receive email when deployments complete
              </p>
            </div>
            <Switch defaultChecked onCheckedChange={() => setHasChanges(true)} />
          </div>

          <div className="flex items-start justify-between gap-4 py-2 border-t border-border">
            <div className="flex-1">
              <p className="text-sm font-medium mb-1">Error alerts</p>
              <p className="text-xs text-muted-foreground">
                Get notified when error rate exceeds threshold
              </p>
            </div>
            <Switch defaultChecked onCheckedChange={() => setHasChanges(true)} />
          </div>

          <div className="flex items-start justify-between gap-4 py-2 border-t border-border">
            <div className="flex-1">
              <p className="text-sm font-medium mb-1">Performance warnings</p>
              <p className="text-xs text-muted-foreground">
                Alert when response times are degraded
              </p>
            </div>
            <Switch defaultChecked onCheckedChange={() => setHasChanges(true)} />
          </div>

          <div className="flex items-start justify-between gap-4 py-2 border-t border-border">
            <div className="flex-1">
              <p className="text-sm font-medium mb-1">Billing updates</p>
              <p className="text-xs text-muted-foreground">
                Receive invoices and payment confirmations
              </p>
            </div>
            <Switch defaultChecked onCheckedChange={() => setHasChanges(true)} />
          </div>

          <div className="flex items-start justify-between gap-4 py-2 border-t border-border">
            <div className="flex-1">
              <p className="text-sm font-medium mb-1">Weekly reports</p>
              <p className="text-xs text-muted-foreground">
                Summary of your projects and usage
              </p>
            </div>
            <Switch onCheckedChange={() => setHasChanges(true)} />
          </div>
        </div>
      </div>

      {/* Security - Stacked Block */}
      <div className="mb-8 pb-8 border-b border-border">
        <h2 className="text-sm font-semibold mb-1">Security</h2>
        <p className="text-xs text-muted-foreground mb-6">
          Password and authentication settings
        </p>

        <div className="space-y-6">
          <div>
            <Button variant="outline" size="sm">
              Change Password
            </Button>
          </div>

          <div className="flex items-start justify-between gap-4 py-2 border-t border-border">
            <div className="flex-1">
              <p className="text-sm font-medium mb-1">Two-factor authentication</p>
              <p className="text-xs text-muted-foreground">
                Add an extra layer of security to your account
              </p>
            </div>
            <Switch onCheckedChange={() => setHasChanges(true)} />
          </div>

          <div className="border-t border-border pt-4">
            <p className="text-sm font-medium mb-2">Active Sessions</p>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="font-medium">Current session</p>
                  <p className="text-xs text-muted-foreground">
                    Windows • Chrome • New York, US
                  </p>
                </div>
                <span className="text-xs text-green-600">Active now</span>
              </div>
              <div className="flex items-center justify-between py-2 border-t border-border">
                <div>
                  <p className="font-medium">MacBook Pro</p>
                  <p className="text-xs text-muted-foreground">
                    macOS • Safari • San Francisco, US
                  </p>
                </div>
                <Button variant="outline" size="sm">
                  Revoke
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Billing - Stacked Block */}
      <div className="mb-8 pb-8 border-b border-border">
        <h2 className="text-sm font-semibold mb-1">Billing</h2>
        <p className="text-xs text-muted-foreground mb-6">
          Manage your subscription and payment methods
        </p>

        <div className="space-y-4">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Current Plan</span>
              <span className="font-medium">Professional</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Billing Cycle</span>
              <span className="font-medium">Monthly</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Next Billing Date</span>
              <span className="font-medium">January 28, 2026</span>
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button variant="outline" size="sm">
              Upgrade Plan
            </Button>
            <Button variant="outline" size="sm">
              Update Payment Method
            </Button>
          </div>
        </div>
      </div>

      {/* Danger Zone - Stacked Block */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold mb-1 text-red-600">Danger Zone</h2>
        <p className="text-xs text-muted-foreground mb-6">
          Irreversible and destructive actions
        </p>

        <div className="space-y-4">
          <div className="p-4 border border-red-200 dark:border-red-900 rounded-lg">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium mb-1">Delete Account</p>
                <p className="text-xs text-muted-foreground">
                  Permanently delete your account and all associated data
                </p>
              </div>
              <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950">
                Delete
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      {hasChanges && (
        <div className="flex items-center gap-3 pt-6 border-t border-border sticky bottom-0 bg-background py-4">
          <Button onClick={() => setHasChanges(false)}>Save Changes</Button>
          <Button variant="outline" onClick={() => setHasChanges(false)}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}
