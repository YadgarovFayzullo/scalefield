"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Projects Page
 *
 * Workflow: Browse projects → Select → View details → Manage
 * Primary states: Active, Paused, Archived
 * Decision points: Create new, view details, pause/resume, configure
 */

// Mock project data
const projects = [
  {
    id: "1",
    name: "api-gateway",
    status: "active",
    environment: "production",
    lastDeployment: "2 min ago",
    version: "v2.1.4",
    requests: "245K/day",
  },
  {
    id: "2",
    name: "user-service",
    status: "building",
    environment: "staging",
    lastDeployment: "5 min ago",
    version: "v1.3.2",
    requests: "89K/day",
  },
  {
    id: "3",
    name: "payment-processor",
    status: "active",
    environment: "production",
    lastDeployment: "12 min ago",
    version: "v3.0.1",
    requests: "156K/day",
  },
  {
    id: "4",
    name: "auth-service",
    status: "active",
    environment: "production",
    lastDeployment: "1 hour ago",
    version: "v1.8.2",
    requests: "432K/day",
  },
  {
    id: "5",
    name: "frontend-app",
    status: "active",
    environment: "production",
    lastDeployment: "2 hours ago",
    version: "v3.2.1",
    requests: "1.2M/day",
  },
  {
    id: "6",
    name: "analytics-engine",
    status: "paused",
    environment: "development",
    lastDeployment: "3 days ago",
    version: "v0.9.0",
    requests: "0/day",
  },
];

const statusColors = {
  active: "bg-green-500/10 text-green-700 dark:text-green-400",
  building: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  paused: "bg-gray-500/10 text-gray-700 dark:text-gray-400",
};

export default function ProjectsPage() {
  const [selectedProject, setSelectedProject] = React.useState<string | null>(null);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [isPanelVisible, setIsPanelVisible] = React.useState(false);
  const [displayedProject, setDisplayedProject] = React.useState<string | null>(null);
  const [newProject, setNewProject] = React.useState({
    name: "",
    environment: "production",
    region: "us-east-1",
  });

  React.useEffect(() => {
    if (selectedProject) {
      setDisplayedProject(selectedProject);
      setTimeout(() => setIsPanelVisible(true), 10);
    } else {
      setIsPanelVisible(false);
      setTimeout(() => setDisplayedProject(null), 300);
    }
  }, [selectedProject]);

  const filteredProjects = projects.filter((project) =>
    project.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selected = projects.find((p) => p.id === displayedProject);

  const handleCreateProject = () => {
    // Here you would typically make an API call to create the project
    console.log("Creating project:", newProject);
    setIsDialogOpen(false);
    setNewProject({ name: "", environment: "production", region: "us-east-1" });
    // Show success message or redirect
  };

  return (
    <div className="relative flex flex-col md:flex-row h-[calc(100vh-57px)]">
      {/* Main list - vertical flow */}
      <div className="flex-1 overflow-y-auto md:border-r border-border">
        <div className="px-6 py-6">
          {/* Header with search */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-2xl font-semibold mb-1">Projects</h1>
                <p className="text-sm text-muted-foreground">{filteredProjects.length} total</p>
              </div>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <Button size="sm" onClick={() => setIsDialogOpen(true)}>
                  New Project
                </Button>
                <DialogContent className="sm:max-w-125">
                  <DialogHeader>
                    <DialogTitle>Create New Project</DialogTitle>
                    <DialogDescription>
                      Deploy a new project to your infrastructure. Configure the basic settings below.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="project-name">Project Name</Label>
                      <Input
                        id="project-name"
                        placeholder="my-awesome-project"
                        value={newProject.name}
                        onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                      />
                      <p className="text-xs text-muted-foreground">
                        Use lowercase letters, numbers, and hyphens only
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="environment">Environment</Label>
                      <Select
                        value={newProject.environment || "production"}
                        onValueChange={(value) => {
                          if (value !== null) {
                            setNewProject({ ...newProject, environment: value });
                          }
                        }}
                      >
                        <SelectTrigger id="environment">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="production">Production</SelectItem>
                          <SelectItem value="staging">Staging</SelectItem>
                          <SelectItem value="development">Development</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="region">Region</Label>
                      <Select
                        value={newProject.region || "us-east-1"}
                        onValueChange={(value) => {
                          if (value !== null) {
                            setNewProject({ ...newProject, region: value });
                          }
                        }}
                      >
                        <SelectTrigger id="region">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="us-east-1">US East (N. Virginia)</SelectItem>
                          <SelectItem value="us-west-2">US West (Oregon)</SelectItem>
                          <SelectItem value="eu-west-1">EU West (Ireland)</SelectItem>
                          <SelectItem value="eu-central-1">EU Central (Frankfurt)</SelectItem>
                          <SelectItem value="ap-southeast-1">Asia Pacific (Singapore)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleCreateProject} disabled={!newProject.name}>
                      Create Project
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <Input
              type="search"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-md"
            />
          </div>

          {/* Projects list - stacked blocks */}
          <div className="space-y-2">
            {filteredProjects.map((project) => (
              <button
                key={project.id}
                onClick={() => setSelectedProject(selectedProject === project.id ? null : project.id)}
                className={`w-full text-left px-4 py-3 border border-border rounded-lg hover:bg-muted/30 transition-colors cursor-pointer ${selectedProject === project.id ? "bg-muted/50" : ""
                  }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-medium">{project.name}</h3>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${statusColors[project.status as keyof typeof statusColors]
                          }`}
                      >
                        {project.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>{project.environment}</span>
                      <span>•</span>
                      <span>{project.version}</span>
                      <span>•</span>
                      <span>{project.requests}</span>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground whitespace-nowrap">
                    {project.lastDeployment}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {selected && (
        <div className={`absolute right-0 top-0 h-full w-full md:w-96 overflow-y-auto bg-background border-l border-border shadow-xl z-20 transition-transform duration-300 ease-out ${isPanelVisible ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className="px-6 py-6">
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">{selected.name}</h2>
                <button
                  onClick={() => setSelectedProject(null)}
                  className="text-muted-foreground hover:text-foreground cursor-pointer"
                >
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
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              {/* Quick actions */}
              <div className="flex gap-2 mb-6">
                <Button size="sm" variant="outline">
                  Deploy
                </Button>
                <Button size="sm" variant="outline">
                  Settings
                </Button>
                <Button size="sm" variant="outline">
                  Logs
                </Button>
              </div>
            </div>

            {/* Project details - status lines */}
            <div className="space-y-4">
              <div className="pb-4 border-b border-border">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  Status
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">State</span>
                    <span className="font-medium capitalize">{selected.status}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Environment</span>
                    <span className="font-medium">{selected.environment}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Version</span>
                    <span className="font-medium">{selected.version}</span>
                  </div>
                </div>
              </div>

              <div className="pb-4 border-b border-border">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  Performance
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Requests</span>
                    <span className="font-medium">{selected.requests}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Response Time</span>
                    <span className="font-medium">124ms avg</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Error Rate</span>
                    <span className="font-medium text-green-600">0.01%</span>
                  </div>
                </div>
              </div>

              <div className="pb-4 border-b border-border">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  Resources
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">CPU Usage</span>
                    <span className="font-medium">34%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Memory</span>
                    <span className="font-medium">512 MB / 1 GB</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Instances</span>
                    <span className="font-medium">3 running</span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  Recent Deploys
                </h3>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{selected.version}</p>
                      <p className="text-xs text-muted-foreground">{selected.lastDeployment}</p>
                    </div>
                    <span className="text-xs text-green-600">Success</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">v2.1.3</p>
                      <p className="text-xs text-muted-foreground">3 hours ago</p>
                    </div>
                    <span className="text-xs text-green-600">Success</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">v2.1.2</p>
                      <p className="text-xs text-muted-foreground">1 day ago</p>
                    </div>
                    <span className="text-xs text-green-600">Success</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
