import React, { useState } from "react";
import { useListMeetings, useCreateMeeting, useDeleteMeeting, getListMeetingsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { formatDateTime, formatTime, formatDate, isOverdue } from "@/lib/date-utils";
import { CalendarDays, Plus, Trash2, Video, Clock } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

export default function Meetings() {
  const queryClient = useQueryClient();
  const { data: meetings, isLoading } = useListMeetings();
  const createMeeting = useCreateMeeting();
  const deleteMeeting = useDeleteMeeting();

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [meetLink, setMeetLink] = useState("");

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !startAt) return;
    
    createMeeting.mutate({ 
      data: { 
        title, 
        startAt: new Date(startAt).toISOString(), 
        endAt: endAt ? new Date(endAt).toISOString() : undefined,
        meetLink 
      } 
    }, {
      onSuccess: () => {
        setOpen(false);
        setTitle(""); setStartAt(""); setEndAt(""); setMeetLink("");
        queryClient.invalidateQueries({ queryKey: getListMeetingsQueryKey() });
        toast.success("Meeting scheduled");
      }
    });
  };

  const handleDelete = (id: number) => {
    deleteMeeting.mutate({ id }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListMeetingsQueryKey() })
    });
  };

  // Grouping
  const now = new Date();
  const upcoming = meetings?.filter(m => new Date(m.startAt) >= now).sort((a,b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()) || [];
  const past = meetings?.filter(m => new Date(m.startAt) < now).sort((a,b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime()) || [];

  const MeetingCard = ({ m, isPast }: { m: any, isPast: boolean }) => (
    <Card className={`border-border/50 bg-card/40 ${isPast ? 'opacity-60' : 'hover:bg-card/70'} transition-all`}>
      <CardContent className="p-5 flex flex-col sm:flex-row gap-4 justify-between">
        <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
          <div className="flex flex-col items-center justify-center bg-background/50 rounded-lg p-3 min-w-[80px] border border-border/30">
            <span className="text-xs text-muted-foreground uppercase">{formatDate(m.startAt).split(' ')[0]}</span>
            <span className="text-xl font-bold font-mono">{new Date(m.startAt).getDate()}</span>
          </div>
          <div>
            <h3 className="font-semibold text-lg">{m.title}</h3>
            <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {formatTime(m.startAt)} {m.endAt && `- ${formatTime(m.endAt)}`}
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2 mt-2 sm:mt-0 sm:self-center">
          {m.meetLink && (
            <Button asChild variant={isPast ? "outline" : "default"} className="gap-2 w-full sm:w-auto">
              <a href={m.meetLink} target="_blank" rel="noreferrer">
                <Video className="w-4 h-4" />
                {isPast ? "Link" : "Join"}
              </a>
            </Button>
          )}
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => handleDelete(m.id)}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-8">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight font-mono text-primary">Meetings</h1>
          <p className="text-muted-foreground mt-1">Your schedule and links in one place.</p>
        </div>
        
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Schedule Meeting
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Schedule Meeting</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Sync with team..." autoFocus required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start</Label>
                  <Input type="datetime-local" value={startAt} onChange={e => setStartAt(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>End (Optional)</Label>
                  <Input type="datetime-local" value={endAt} onChange={e => setEndAt(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Meeting Link</Label>
                <Input value={meetLink} onChange={e => setMeetLink(e.target.value)} placeholder="https://meet.google.com/..." />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={createMeeting.isPending}>Save</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      ) : (
        <div className="space-y-10">
          {upcoming.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-sm font-mono tracking-widest text-primary uppercase">Upcoming</h2>
              <div className="space-y-3">
                {upcoming.map(m => <MeetingCard key={m.id} m={m} isPast={false} />)}
              </div>
            </div>
          )}

          {past.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-sm font-mono tracking-widest text-muted-foreground uppercase">Past</h2>
              <div className="space-y-3">
                {past.map(m => <MeetingCard key={m.id} m={m} isPast={true} />)}
              </div>
            </div>
          )}

          {upcoming.length === 0 && past.length === 0 && (
            <div className="py-12 text-center text-muted-foreground border-2 border-dashed border-border/50 rounded-xl bg-card/20">
              No meetings scheduled.
            </div>
          )}
        </div>
      )}
    </div>
  );
}