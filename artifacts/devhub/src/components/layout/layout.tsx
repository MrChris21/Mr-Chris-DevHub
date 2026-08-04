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
  useSidebar,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  FileText,
  BellRing,
  CalendarDays,
  CheckSquare,
  Sparkles,
  Code2,
  Bookmark,
} from "lucide-react";

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

function BrandMark({ className = "w-7 h-7" }: { className?: string }) {
  return (
    <img
      src="/icon-192.png"
      alt="Mr. Chris DevHub"
      className={`${className} rounded-md shadow-sm ring-1 ring-border/50 object-cover shrink-0`}
      width={28}
      height={28}
      decoding="async"
    />
  );
}

function AppShell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { isMobile, setOpenMobile } = useSidebar();

  const currentLabel =
    navItems.find(
      (item) =>
        location === item.href ||
        (item.href !== "/" && location.startsWith(item.href)),
    )?.label ?? "DevHub";

  const handleNav = () => {
    if (isMobile) setOpenMobile(false);
  };

  return (
    <div className="flex h-[100dvh] w-full max-w-[100vw] overflow-hidden bg-background text-foreground safe-area-pad">
      <Sidebar className="border-r border-border">
        <SidebarHeader className="border-b border-border py-4 px-4 flex items-center gap-2.5 font-mono font-bold tracking-tight text-primary min-w-0">
          <BrandMark />
          <span className="truncate text-sm sm:text-base">Mr. Chris DevHub</span>
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
                      isActive={
                        location === item.href ||
                        (item.href !== "/" && location.startsWith(item.href))
                      }
                    >
                      <Link
                        href={item.href}
                        onClick={handleNav}
                        className="flex items-center gap-3"
                      >
                        <item.icon className="w-4 h-4 shrink-0" />
                        <span className="truncate">{item.label}</span>
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
        <header className="h-14 min-h-14 border-b border-border flex items-center px-3 sm:px-4 gap-2 sm:gap-3 sticky top-0 bg-background/80 backdrop-blur z-10 safe-area-top">
          <SidebarTrigger className="shrink-0" />
          <div className="flex items-center gap-2 min-w-0 md:hidden">
            <BrandMark className="w-6 h-6" />
            <span className="font-mono text-sm font-semibold text-primary truncate">
              {currentLabel}
            </span>
          </div>
          <div className="hidden md:flex items-center gap-2 min-w-0">
            <span className="font-mono text-sm text-muted-foreground truncate">
              {currentLabel}
            </span>
          </div>
        </header>

        <div className="flex-1 overflow-auto overflow-x-hidden bg-muted/20 overscroll-contain">
          <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto w-full min-h-full">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppShell>{children}</AppShell>
    </SidebarProvider>
  );
}
