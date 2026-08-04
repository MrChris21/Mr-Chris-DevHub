import React from "react";
import { Link, useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  TerminalSquare,
  LayoutDashboard,
  FileText,
  BellRing,
  CalendarDays,
  CheckSquare,
  Sparkles,
  Code2,
  Bookmark,
} from "lucide-react";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const navItems = [
    { label: "Dashboard", href: "/", icon: LayoutDashboard },
    { label: "Notes", href: "/notes", icon: FileText },
    { label: "Reminders", href: "/reminders", icon: BellRing },
    { label: "Meetings", href: "/meetings", icon: CalendarDays },
    { label: "Tasks", href: "/tasks", icon: CheckSquare },
    { label: "Prompts", href: "/prompts", icon: Sparkles },
    { label: "Snippets", href: "/snippets", icon: Code2 },
    { label: "Bookmarks", href: "/bookmarks", icon: Bookmark },
  ];

  return (
    <SidebarProvider>
      <div className="flex h-[100dvh] w-full overflow-hidden bg-background text-foreground">
        <Sidebar className="border-r border-border">
          <SidebarHeader className="border-b border-border py-4 px-4 flex items-center gap-2 font-mono font-bold tracking-tight text-primary">
            <TerminalSquare className="w-5 h-5" />
            <span>DevHub</span>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel className="text-xs font-mono tracking-wider text-muted-foreground uppercase mt-4 mb-2 px-4">
                Modules
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navItems.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={location === item.href || (item.href !== "/" && location.startsWith(item.href))}
                      >
                        <Link href={item.href} className="flex items-center gap-3">
                          <item.icon className="w-4 h-4" />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>

        <main className="flex-1 flex flex-col h-full min-w-0 overflow-hidden relative">
          <header className="h-14 border-b border-border flex items-center px-4 gap-4 sticky top-0 bg-background/80 backdrop-blur z-10">
            <SidebarTrigger />
          </header>
          <div className="flex-1 overflow-auto bg-muted/20">
            <div className="p-6 md:p-8 max-w-7xl mx-auto h-full">
              {children}
            </div>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}