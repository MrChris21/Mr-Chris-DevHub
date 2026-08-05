import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster as SonnerToaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ThemeProvider } from '@/components/theme-provider';
import { ReminderAlarmWatcher } from '@/components/reminder-alarm-watcher';
import { AlarmClockOverlay } from '@/components/alarm-clock-overlay';
import NotFound from '@/pages/not-found';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { Layout } from '@/components/layout/layout';

import Dashboard from '@/pages/dashboard';
import Notes from '@/pages/notes/index';
import NoteEditor from '@/pages/notes/editor';
import Reminders from '@/pages/reminders/index';
import Meetings from '@/pages/meetings/index';
import Tasks from '@/pages/tasks/index';
import Prompts from '@/pages/prompts/index';
import Snippets from '@/pages/snippets/index';
import Bookmarks from '@/pages/bookmarks/index';

const queryClient = new QueryClient();

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/notes" component={Notes} />
        <Route path="/notes/:id" component={NoteEditor} />
        <Route path="/reminders" component={Reminders} />
        <Route path="/meetings" component={Meetings} />
        <Route path="/tasks" component={Tasks} />
        <Route path="/prompts" component={Prompts} />
        <Route path="/snippets" component={Snippets} />
        <Route path="/bookmarks" component={Bookmarks} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <Router />
            {/* Runs on every route so due reminders still alarm when not on /reminders */}
            <ReminderAlarmWatcher />
          </WouterRouter>
          {/* Full-screen alarm clock until user dismisses */}
          <AlarmClockOverlay />
          {/* Sonner is used by pages via `import { toast } from "sonner"` */}
          <SonnerToaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;