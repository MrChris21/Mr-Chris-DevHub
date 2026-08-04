import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import { useListNotes, useCreateNote, useDeleteNote, useUpdateNote, getListNotesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getRelativeTime } from "@/lib/date-utils";
import { Plus, Search, Pin, Trash2, Edit3, FileText } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

export default function NotesList() {
  const [_, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: notes, isLoading } = useListNotes();
  const createNote = useCreateNote();
  const deleteNote = useDeleteNote();
  const updateNote = useUpdateNote();

  const [search, setSearch] = useState("");

  const handleCreate = () => {
    createNote.mutate({ data: { title: "Untitled Note", content: "", tags: [] } }, {
      onSuccess: (newNote) => {
        queryClient.invalidateQueries({ queryKey: getListNotesQueryKey() });
        setLocation(`/notes/${newNote.id}`);
      },
      onError: () => toast.error("Failed to create note"),
    });
  };

  const handleTogglePin = (id: number, currentPinned: boolean, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    updateNote.mutate({ id, data: { pinned: !currentPinned } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListNotesQueryKey() });
      }
    });
  };

  const handleDelete = (id: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this note?")) {
      deleteNote.mutate({ id }, {
        onSuccess: () => {
          toast.success("Note deleted");
          queryClient.invalidateQueries({ queryKey: getListNotesQueryKey() });
        }
      });
    }
  };

  const filteredNotes = notes?.filter(n => 
    n.title.toLowerCase().includes(search.toLowerCase()) || 
    n.content?.toLowerCase().includes(search.toLowerCase()) ||
    n.tags?.some(t => t.toLowerCase().includes(search.toLowerCase()))
  ) || [];

  const pinnedNotes = filteredNotes.filter(n => n.pinned);
  const unpinnedNotes = filteredNotes.filter(n => !n.pinned);

  const NoteCard = ({ note }: { note: any }) => (
    <Card 
      onClick={() => setLocation(`/notes/${note.id}`)}
      className="h-full flex flex-col hover-elevate cursor-pointer border-border/50 hover:border-primary/50 transition-all bg-card/40 hover:bg-card/80"
    >
      <CardContent className="p-5 flex flex-col h-full gap-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-lg line-clamp-1 group-hover:text-primary transition-colors">{note.title || "Untitled"}</h3>
          <div className="flex items-center gap-1 shrink-0">
            <Button 
              variant="ghost" 
              size="icon" 
              className={`h-7 w-7 ${note.pinned ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
              onClick={(e) => handleTogglePin(note.id, note.pinned, e)}
            >
              <Pin className="w-3.5 h-3.5" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={(e) => handleDelete(note.id, e)}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
        
        <p className="text-sm text-muted-foreground line-clamp-3 flex-1 break-words">
          {note.content || "No content"}
        </p>

        <div className="flex items-center justify-between mt-auto pt-4 border-t border-border/50">
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            {note.tags?.slice(0,3).map((tag: string) => (
              <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0 rounded-sm bg-secondary/50 shrink-0">
                {tag}
              </Badge>
            ))}
            {(note.tags?.length || 0) > 3 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 rounded-sm bg-secondary/50 shrink-0">
                +{(note.tags?.length || 0) - 3}
              </Badge>
            )}
          </div>
          <span className="text-[10px] text-muted-foreground font-mono shrink-0 ml-2">
            {getRelativeTime(note.updatedAt)}
          </span>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 h-full flex flex-col">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight font-mono text-primary">Notes</h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">Capture your thoughts and code.</p>
        </div>
        <Button onClick={handleCreate} className="gap-2 w-full sm:w-auto shrink-0" disabled={createNote.isPending}>
          <Plus className="w-4 h-4" />
          {createNote.isPending ? "Creating..." : "New Note"}
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input 
          placeholder="Search notes..." 
          className="pl-9 w-full max-w-md bg-card/50 border-border/50 focus-visible:ring-primary/50"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({length: 8}).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      ) : filteredNotes.length === 0 ? (
        <div className="flex-1 flex items-center justify-center border-2 border-dashed border-border/50 rounded-xl bg-card/20">
          <div className="text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto">
              <FileText className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-lg font-medium">No notes found</p>
            <p className="text-sm text-muted-foreground">Create a new note to get started.</p>
            {search && <Button variant="link" onClick={() => setSearch("")}>Clear search</Button>}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-auto -mx-1 px-1 pb-4">
          <div className="space-y-8">
            {pinnedNotes.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-mono tracking-widest text-muted-foreground uppercase flex items-center gap-2">
                  <Pin className="w-3.5 h-3.5" /> Pinned
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {pinnedNotes.map(n => <NoteCard key={n.id} note={n} />)}
                </div>
              </div>
            )}
            
            {unpinnedNotes.length > 0 && (
              <div className="space-y-3">
                {pinnedNotes.length > 0 && (
                  <h2 className="text-sm font-mono tracking-widest text-muted-foreground uppercase">
                    All Notes
                  </h2>
                )}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {unpinnedNotes.map(n => <NoteCard key={n.id} note={n} />)}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}