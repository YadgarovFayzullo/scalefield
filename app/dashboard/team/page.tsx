"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Add01Icon,
  Delete02Icon,
  Mail01Icon,
  UserIcon,
  Time01Icon,
} from "@hugeicons/core-free-icons";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: "owner" | "admin" | "developer" | "viewer";
  status: "active" | "invited";
  joinedAt: string;
  lastActive: string;
  avatar?: string;
}

interface AuditLogEntry {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  target?: string;
}

const mockTeamMembers: TeamMember[] = [
  {
    id: "1",
    name: "Alex Johnson",
    email: "alex@company.com",
    role: "owner",
    status: "active",
    joinedAt: "6 months ago",
    lastActive: "2 min ago",
  },
  {
    id: "2",
    name: "Sarah Chen",
    email: "sarah@company.com",
    role: "admin",
    status: "active",
    joinedAt: "4 months ago",
    lastActive: "15 min ago",
  },
  {
    id: "3",
    name: "Michael Torres",
    email: "michael@company.com",
    role: "developer",
    status: "active",
    joinedAt: "2 months ago",
    lastActive: "1 hour ago",
  },
  {
    id: "4",
    name: "Emma Wilson",
    email: "emma@company.com",
    role: "developer",
    status: "active",
    joinedAt: "1 month ago",
    lastActive: "3 hours ago",
  },
  {
    id: "5",
    name: "james.brown@company.com",
    email: "james.brown@company.com",
    role: "viewer",
    status: "invited",
    joinedAt: "Invited 2 days ago",
    lastActive: "—",
  },
];

const mockAuditLog: AuditLogEntry[] = [
  {
    id: "1",
    timestamp: "2026-01-14 14:20",
    user: "Alex Johnson",
    action: "Invited james.brown@company.com as Viewer",
  },
  {
    id: "2",
    timestamp: "2026-01-14 10:15",
    user: "Sarah Chen",
    action: "Changed role for Michael Torres",
    target: "Developer → Admin",
  },
  {
    id: "3",
    timestamp: "2026-01-13 16:40",
    user: "Alex Johnson",
    action: "Removed user lisa.anderson@company.com",
  },
  {
    id: "4",
    timestamp: "2026-01-13 09:22",
    user: "Emma Wilson",
    action: "Updated API key permissions",
  },
  {
    id: "5",
    timestamp: "2026-01-12 14:55",
    user: "Michael Torres",
    action: "Created new project",
    target: "mobile-app-v2",
  },
];

export default function TeamPage() {
  const [members, setMembers] = React.useState<TeamMember[]>(mockTeamMembers);
  const [showAuditLog, setShowAuditLog] = React.useState(false);

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "owner":
        return "bg-purple-500/10 text-purple-700 dark:text-purple-400";
      case "admin":
        return "bg-blue-500/10 text-blue-700 dark:text-blue-400";
      case "developer":
        return "bg-green-500/10 text-green-700 dark:text-green-400";
      case "viewer":
        return "bg-gray-500/10 text-gray-700 dark:text-gray-400";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold mb-1">Team</h1>
          <p className="text-sm text-muted-foreground">
            Manage team members and access permissions
          </p>
        </div>
        <Button size="sm" className="gap-2">
          <HugeiconsIcon icon={Add01Icon} className="h-4 w-4" />
          Invite Member
        </Button>
      </div>

      {/* Status overview */}
      <div className="mb-6 pb-6 border-b border-border">
        <div className="space-y-1.5 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Active members:</span>
            <span className="font-medium">
              {members.filter((m) => m.status === "active").length}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Pending invites:</span>
            <span className="font-medium">
              {members.filter((m) => m.status === "invited").length}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Team plan:</span>
            <span className="font-medium">Pro (10 seats)</span>
          </div>
        </div>
      </div>

      {/* Team members list */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
          Members
        </h2>

        <div className="space-y-4">
          {members.map((member) => (
            <div key={member.id}>
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  {/* Avatar placeholder */}
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                    <HugeiconsIcon
                      icon={member.status === "invited" ? Mail01Icon : UserIcon}
                      className="h-5 w-5 text-muted-foreground"
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium truncate">
                        {member.name}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${getRoleBadge(
                          member.role
                        )}`}
                      >
                        {member.role}
                      </span>
                      {member.status === "invited" && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-700 dark:text-yellow-400">
                          pending
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      <div>{member.email}</div>
                      <div className="flex items-center gap-4">
                        <span>{member.joinedAt}</span>
                        {member.lastActive !== "—" && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <HugeiconsIcon
                                icon={Time01Icon}
                                className="h-3 w-3"
                              />
                              {member.lastActive}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-4">
                  {member.role !== "owner" && (
                    <>
                      <select
                        value={member.role}
                        onChange={(e) => {
                          // Handle role change
                          console.log("Role changed to:", e.target.value);
                        }}
                        className="text-xs border border-border rounded px-2 py-1 bg-background"
                      >
                        <option value="admin">Admin</option>
                        <option value="developer">Developer</option>
                        <option value="viewer">Viewer</option>
                      </select>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <HugeiconsIcon icon={Delete02Icon} className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Divider */}
              {member.id !== members[members.length - 1].id && (
                <div className="mt-4 border-b border-border" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Audit log toggle */}
      <div className="pt-6 border-t border-border">
        <button
          onClick={() => setShowAuditLog(!showAuditLog)}
          className="text-sm font-semibold text-muted-foreground uppercase tracking-wide hover:text-foreground transition-colors mb-4"
        >
          {showAuditLog ? "Hide" : "Show"} Audit Log
        </button>

        {showAuditLog && (
          <div className="space-y-0">
            {mockAuditLog.map((entry, index) => (
              <div
                key={entry.id}
                className={`py-2.5 border-b border-border ${index === 0 ? "border-t" : ""
                  }`}
              >
                <div className="flex items-start gap-4">
                  <span className="text-xs text-muted-foreground font-mono whitespace-nowrap">
                    {entry.timestamp}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm">
                      <span className="font-medium">{entry.user}</span>{" "}
                      {entry.action}
                    </span>
                    {entry.target && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {entry.target}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
