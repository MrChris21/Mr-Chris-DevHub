import React, { useEffect, useState, useRef, useCallback } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { useGetNote, useUpdateNote, getGetNoteQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Save, Pin, Check, X, Tag } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { ShareButton } from "@/components/share-button";
import { formatNoteShare } from "@/lib/share";

export default function NoteEditor() {
  const [match, params] = useRoute("/notes/:id");
  const id = params?.id ? parseInt(params.id) : 0;
  const [_, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: note, isLoading } = useGetNote(id, { query: { enabled: !!id, queryKey: getGetNoteQueryKey(id) } });
  const updateNote = useUpdateNote();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [isEditingTags, setIsEditingTags] = useState(false);

  const initializedForId = useRef<number | null>(null);
  const lastSaved = useRef({ title: "", content: "", tags: [] as string[] });

  useEffect(() => {
    if (note && initializedForId.current !== id) {
      initializedForId.current = id;
      setTitle(note.title || "");
      setContent(note.content || "");
      setTags(note.tags || []);
      lastSaved.current = { title: note.title || "", content: note.content || "", tags: note.tags || [] };
    }
  }, [note, id]);

  const mutateFnRef = useRef(updateNote.mutate);
  mutateFnRef.current = updateNote.mutate;

  const saveNote = useCallback((data: { title?: string, content?: string, tags?: string[], pinned?: boolean }, silent = true) => {
    mutateFnRef.current({ id, data }, {
      onSuccess: (updatedNote) => {
        if (!silent) toast.success("Saved");
        queryClient.setQueryData(getGetNoteQueryKey(id), updatedNote);
      },
      onError: () => {
        if (!silent) toast.error("Failed to save");
      }
    });
  }, [id, queryClient]);

  // Debounced auto-save
  useEffect(() => {
    if (initializedForId.current !== id) return;
    const timer = setTimeout(() => {
      const changed = 
        title !== lastSaved.current.title || 
        content !== lastSaved.current.content ||
        JSON.stringify(tags) !== JSON.stringify(lastSaved.current.tags);

      if (changed) {
        saveNote({ title, content, tags });
        lastSaved.current = { title, content, tags };
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [title, content, tags, id, saveNote]);

  const togglePin = () => {
    if (!note) return;
    saveNote({ pinned: !note.pinned }, false);
  };

  const addTag = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && tagInput.trim()) {
      e.preventDefault();
      if (!tags.includes(tagInput.trim())) {
        setTags([...tags, tagInput.trim()]);
      }
      setTagInput("");
    }
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  if (isLoading || !note) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto h-full flex flex-col">
        <div className="flex items-center gap-4">
          <Skeleton className="w-8 h-8 rounded-full" />
          <Skeleton className="h-10 w-1/2" />
        </div>
        <Skeleton className="flex-1 rounded-xl" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full min-h-0 flex flex-col max-w-5xl mx-auto gap-3 sm:gap-4 w-full min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-1 sm:mb-2 min-w-0">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Link href="/notes">
            <Button variant="ghost" size="icon" className="shrink-0 -ml-2 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <Input 
            value={title} 
            onChange={(e) => setTitle(e.target.value)} 
            className="text-xl sm:text-2xl font-bold bg-transparent border-transparent px-2 h-11 sm:h-12 focus-visible:ring-0 focus-visible:bg-muted/20 min-w-0"
            placeholder="Note title..."
          />
        </div>
        <div className="flex items-center gap-2 shrink-0 sm:ml-auto pl-8 sm:pl-0">
          <ShareButton
            payload={formatNoteShare({ title, content, tags })}
            size="icon"
            title="Share note"
          />
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={togglePin}
            className={note.pinned ? 'text-primary' : 'text-muted-foreground'}
            title={note.pinned ? "Unpin" : "Pin"}
          >
            <Pin className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => saveNote({title, content, tags}, false)}>
            <Save className="w-4 h-4" />
            Save
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 px-2">
        <Tag className="w-4 h-4 text-muted-foreground" />
        {tags.map(tag => (
          <Badge key={tag} variant="secondary" className="gap-1 bg-secondary/50">
            {tag}
            <button onClick={() => removeTag(tag)} className="hover:text-destructive transition-colors">
              <X className="w-3 h-3" />
            </button>
          </Badge>
        ))}
        {isEditingTags ? (
          <Input 
            autoFocus
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={addTag}
            onBlur={() => {
              if (tagInput.trim() && !tags.includes(tagInput.trim())) setTags([...tags, tagInput.trim()]);
              setTagInput("");
              setIsEditingTags(false);
            }}
            className="h-6 text-xs w-32 px-2 py-0"
            placeholder="Type & Enter"
          />
        ) : (
          <Button variant="ghost" size="sm" className="h-6 text-xs px-2 text-muted-foreground" onClick={() => setIsEditingTags(true)}>
            + Add tag
          </Button>
        )}
      </div>

      <Tabs defaultValue="write" className="flex-1 flex flex-col mt-2 min-h-0">
        <div className="flex justify-end px-2 mb-2">
          <TabsList className="h-8">
            <TabsTrigger value="write" className="text-xs">Write</TabsTrigger>
            <TabsTrigger value="preview" className="text-xs">Preview</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="write" className="flex-1 m-0 min-h-[50vh] sm:min-h-0">
          <Textarea 
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full h-full min-h-[50vh] sm:min-h-full resize-none font-mono text-sm leading-relaxed p-4 sm:p-6 bg-card/30 border-border/50 focus-visible:ring-1 focus-visible:ring-primary/30"
            placeholder="Write using markdown..."
          />
        </TabsContent>
        <TabsContent value="preview" className="flex-1 m-0 min-h-[50vh] overflow-auto bg-card/30 border border-border/50 rounded-md p-4 sm:p-6">
          <div className="prose prose-sm dark:prose-invert max-w-none">
            {/* Extremely naive markdown rendering for preview - in a real app we'd use react-markdown */}
            {content ? content.split('\n').map((line, i) => {
              if (line.startsWith('# ')) return <h1 key={i}>{line.slice(2)}</h1>;
              if (line.startsWith('## ')) return <h2 key={i}>{line.slice(3)}</h2>;
              if (line.startsWith('### ')) return <h3 key={i}>{line.slice(4)}</h3>;
              if (line.startsWith('> ')) return <blockquote key={i}>{line.slice(2)}</blockquote>;
              if (line.startsWith('- ')) return <li key={i}>{line.slice(2)}</li>;
              if (line === '') return <br key={i}/>;
              return <p key={i}>{line}</p>;
            }) : <p className="text-muted-foreground italic">No content to preview.</p>}
          </div>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}