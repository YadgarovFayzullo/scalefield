"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Database02Icon,
  Add01Icon,
  Search01Icon,
  Table01Icon,
  FilterIcon,
  LayoutTable02Icon,
  LockPasswordIcon,
} from "@hugeicons/core-free-icons";

/**
 * Table Editor Page
 *
 * Workflow: Browse tables → Select table → Edit/View
 * Styled like professional DB tools (DataGrip, TablePlus)
 */

interface DatabaseTable {
  id: string;
  name: string;
  schema: string;
}

const mockTables: DatabaseTable[] = [
  { id: "1", name: "achievements", schema: "public" },
  { id: "2", name: "affiliations", schema: "public" },
  { id: "3", name: "article_authors", schema: "public" },
  { id: "4", name: "article_interactions", schema: "public" },
  { id: "5", name: "articles", schema: "public" },
  { id: "6", name: "issues", schema: "public" },
  { id: "7", name: "journal_admins", schema: "public" },
  { id: "8", name: "journal_stats_view", schema: "public" },
  { id: "9", name: "journals", schema: "public" },
  { id: "10", name: "profile_stats", schema: "public" },
  { id: "11", name: "profiles", schema: "public" },
  { id: "12", name: "research_interests", schema: "public" },
  { id: "13", name: "social_links", schema: "public" },
];

export default function TableEditorPage() {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedSchema, setSelectedSchema] = React.useState("public");
  const [selectedTableId, setSelectedTableId] = React.useState<string | null>(null);

  const filteredTables = mockTables.filter(
    (table) =>
      table.schema === selectedSchema &&
      table.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-[calc(100vh-57px)]">
      {/* Left sidebar - table list */}
      <div className="w-80 border-r border-border flex flex-col bg-background">
        {/* Schema selector */}
        <div className="p-4 border-b border-border">
          <div className="relative">
            <select
              value={selectedSchema}
              onChange={(e) => setSelectedSchema(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background appearance-none pr-8"
            >
              <option value="public">schema public</option>
              <option value="auth">schema auth</option>
              <option value="storage">schema storage</option>
            </select>
            <svg
              className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        {/* New table button */}
        <div className="p-3 border-b border-border">
          <Button size="sm" variant="outline" className="w-full justify-start gap-2 cursor-pointer">
            <HugeiconsIcon icon={Add01Icon} className="h-4 w-4" />
            New table
          </Button>
        </div>

        {/* Search tables */}
        <div className="p-3 border-b border-border">
          <div className="relative">
            <HugeiconsIcon
              icon={Search01Icon}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
            />
            <Input
              type="search"
              placeholder="Search tables..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
            <button className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer">
              <HugeiconsIcon icon={FilterIcon} className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Tables list */}
        <div className="flex-1 overflow-y-auto">
          {filteredTables.map((table) => (
            <button
              key={table.id}
              onClick={() => setSelectedTableId(table.id)}
              className={`w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-muted/50 transition-colors text-left cursor-pointer ${
                selectedTableId === table.id ? "bg-muted" : ""
              }`}
            >
              <HugeiconsIcon icon={LayoutTable02Icon} className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="truncate">{table.name}</span>
              <HugeiconsIcon icon={Database02Icon} className="h-3.5 w-3.5 text-muted-foreground/50 ml-auto shrink-0" />
            </button>
          ))}
        </div>
      </div>

      {/* Main content area */}
      {/* Main content area */}
      {selectedTableId ? (
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
          {/* Tabs Header */}
          <div className="flex items-center border-b border-border bg-muted/20">
            <div className="flex items-center px-4 py-2 border-r border-border bg-background border-t-2 border-t-primary text-sm font-medium">
              <HugeiconsIcon icon={LayoutTable02Icon} className="h-4 w-4 mr-2 text-primary" />
              {mockTables.find((t) => t.id === selectedTableId)?.name}
              <button className="ml-3 hover:text-foreground text-muted-foreground cursor-pointer">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M9 3L3 9M3 3L9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
            <button className="px-3 text-muted-foreground hover:text-foreground cursor-pointer">
              <HugeiconsIcon icon={Add01Icon} className="h-4 w-4" />
            </button>
          </div>

          {/* Toolbar */}
          <div className="border-b border-border p-2 flex items-center gap-2 bg-background">
            <div className="flex items-center gap-1 border-r border-border pr-2 mr-2">
              <Button size="sm" variant="ghost" className="h-8 gap-2 text-muted-foreground font-normal">
                <HugeiconsIcon icon={FilterIcon} className="h-4 w-4" />
                Filter
              </Button>
              <Button size="sm" variant="ghost" className="h-8 gap-2 text-muted-foreground font-normal">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="21" y1="10" x2="3" y2="10" />
                  <line x1="21" y1="6" x2="3" y2="6" />
                  <line x1="21" y1="14" x2="3" y2="14" />
                  <line x1="21" y1="18" x2="3" y2="18" />
                </svg>
                Sort
              </Button>
            </div>
            
            <Button size="sm" className="h-8 bg-green-600 hover:bg-green-700 text-white gap-2">
              <HugeiconsIcon icon={Add01Icon} className="h-4 w-4" />
              Insert
            </Button>

            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-muted-foreground mr-2">Role: postgres</span>
              <Button size="sm" variant="outline" className="h-8 gap-2">
                <HugeiconsIcon icon={Database02Icon} className="h-3.5 w-3.5" />
                Realtime
              </Button>
            </div>
          </div>

          {/* Data Grid */}
          <div className="flex-1 overflow-auto bg-muted/5 relative">
            <table className="w-full text-sm text-left border-collapse table-fixed">
              <thead className="bg-muted/40 sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="w-10 border-b border-r border-border px-2 py-2 bg-muted/30 text-center">
                    <input type="checkbox" className="rounded border-border" />
                  </th>
                  <th className="w-45 border-b border-r border-border px-3 py-2 bg-muted/30">
                    <div className="flex items-center gap-2 group cursor-pointer">
                      <HugeiconsIcon icon={LockPasswordIcon} className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-medium">id</span>
                      <span className="text-xs text-muted-foreground ml-auto">uuid</span>
                    </div>
                  </th>
                  <th className="w-50 border-b border-r border-border px-3 py-2 bg-muted/30">
                    <div className="flex items-center gap-2 group cursor-pointer">
                      <HugeiconsIcon icon={LayoutTable02Icon} className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-medium">created_at</span>
                      <span className="text-xs text-muted-foreground ml-auto">timestamptz</span>
                    </div>
                  </th>
                  <th className="w-37.5 border-b border-r border-border px-3 py-2 bg-muted/30">
                    <div className="flex items-center gap-2 group cursor-pointer">
                      <HugeiconsIcon icon={LayoutTable02Icon} className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-medium">status</span>
                      <span className="text-xs text-muted-foreground ml-auto">text</span>
                    </div>
                  </th>
                  <th className="w-75 border-b border-r border-border px-3 py-2 bg-muted/30">
                     <div className="flex items-center gap-2 group cursor-pointer">
                      <HugeiconsIcon icon={LayoutTable02Icon} className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-medium">metadata</span>
                      <span className="text-xs text-muted-foreground ml-auto">jsonb</span>
                    </div>
                  </th>
                  <th className="border-b border-border bg-muted/30"></th>
                </tr>
              </thead>
              <tbody className="bg-background">
                {Array.from({ length: 30 }).map((_, i) => (
                  <tr key={i} className="group hover:bg-muted/10">
                    <td className="border-b border-r border-border px-2 py-1.5 text-center bg-muted/5">
                      <input type="checkbox" className="rounded border-border" />
                    </td>
                    <td className="border-b border-r border-border px-3 py-1.5 font-mono text-xs text-muted-foreground truncate">
                      {Math.random().toString(36).substring(2, 10)}-...
                    </td>
                    <td className="border-b border-r border-border px-3 py-1.5 text-muted-foreground truncate">
                      2024-03-{Math.floor(Math.random() * 30) + 1} 14:30:00+00
                    </td>
                    <td className="border-b border-r border-border px-3 py-1.5 text-muted-foreground truncate">
                      active
                    </td>
                    <td className="border-b border-r border-border px-3 py-1.5 text-muted-foreground font-mono text-xs truncate">
                      {`{"source": "web", "v": 1}`}
                    </td>
                    <td className="border-b border-border"></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="border-t border-border px-4 py-2 flex items-center justify-between bg-muted/20 text-xs text-muted-foreground">
            <div className="flex items-center gap-4">
              <button className="flex items-center gap-1 hover:text-foreground cursor-pointer">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" className="rotate-180">
                  <path d="M4 2L8 6L4 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Page 1
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M4 2L8 6L4 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              <span>of 1</span>
              <div className="h-4 w-px bg-border mx-2"></div>
              <select className="bg-transparent border-none outline-none hover:text-foreground cursor-pointer">
                <option>100 rows</option>
                <option>50 rows</option>
                <option>25 rows</option>
              </select>
            </div>
            <div>
              30 records
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center bg-muted/20">
          <div className="max-w-md w-full px-6">
            {/* Create table card */}
            <button className="w-full p-6 border border-border rounded-lg bg-background hover:bg-muted/30 transition-colors text-left mb-8">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <HugeiconsIcon icon={LayoutTable02Icon} className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold mb-1">Create a table</h3>
                  <p className="text-sm text-muted-foreground">
                    Design and create a new database table
                  </p>
                </div>
              </div>
            </button>

            {/* Recent items */}
            <div>
              <h3 className="text-sm font-semibold mb-4">Recent items</h3>
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <HugeiconsIcon icon={Table01Icon} className="h-12 w-12 text-muted-foreground/30 mb-3" />
                <p className="text-sm font-medium text-muted-foreground mb-1">No recent items yet</p>
                <p className="text-xs text-muted-foreground">
                  Items will appear here as you browse through your project
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
