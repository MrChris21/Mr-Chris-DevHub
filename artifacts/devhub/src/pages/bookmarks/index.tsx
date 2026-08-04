import React, { useState } from "react";
import { useListBookmarks, useCreateBookmark, useDeleteBookmark, getListBookmarksQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Bookmark, Plus, Trash2, ExternalLink, Search } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

export default function Bookmarks() {
  const queryClient = useQueryClient();
  const { data: bookmarks, isLoading } = useListBookmarks();
  const createBookmark = useCreateBookmark();
  const deleteBookmark = useDeleteBookmark();

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [search, setSearch] = useState("");

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !url.trim()) return;
    
    // basic url validation
    let validUrl = url;
    if (!validUrl.startsWith('http://') && !validUrl.startsWith('https://')) {
      validUrl = 'https://' + validUrl;
    }

    createBookmark.mutate({ data: { title, url: validUrl, description, tags: [] } }, {
      onSuccess: () => {
        setOpen(false);
        setTitle(""); setUrl(""); setDescription("");
        queryClient.invalidateQueries({ queryKey: getListBookmarksQueryKey() });
        toast.success("Bookmark saved");
      }
    });
  };

  const handleDelete = (id: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    deleteBookmark.mutate({ id }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListBookmarksQueryKey() })
    });
  };

  const filteredBookmarks = bookmarks?.filter(b => 
    b.title.toLowerCase().includes(search.toLowerCase()) || 
    b.url.toLowerCase().includes(search.toLowerCase()) ||
    b.description?.toLowerCase().includes(search.toLowerCase())
  ) || [];

  return (
    <div className="space-y-6 h-full flex flex-col max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-mono text-primary flex items-center gap-3">
            <Bookmark className="w-8 h-8 text-primary" />
            Bookmarks
          </h1>
          <p className="text-muted-foreground mt-1">Important links and resources.</p>
        </div>
        
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Add Bookmark
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add Bookmark</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. React Docs" autoFocus required />
              </div>
              <div className="space-y-2">
                <Label>URL</Label>
                <Input type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..." required />
              </div>
              <div className="space-y-2">
                <Label>Description (Optional)</Label>
                <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief note about this link" />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={createBookmark.isPending}>Save</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input 
          placeholder="Search bookmarks..." 
          className="pl-9 max-w-md bg-card/50 border-border/50 focus-visible:ring-primary/50"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      ) : filteredBookmarks.length === 0 ? (
        <div className="flex-1 flex items-center justify-center border-2 border-dashed border-border/50 rounded-xl bg-card/20">
          <div className="text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto">
              <Bookmark className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-lg font-medium">No bookmarks found</p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 pb-8">
          {filteredBookmarks.map(b => (
            <div key={b.id} onClick={() => window.open(b.url, "_blank")} className="block group cursor-pointer">
              <Card className="h-full bg-card/40 border-border/50 hover:border-primary/50 hover:bg-card/60 transition-all hover-elevate overflow-hidden">
                <CardContent className="p-5 flex flex-col h-full gap-2 relative">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1 min-w-0 flex-1">
                      <h3 className="font-semibold text-base leading-tight truncate group-hover:text-primary transition-colors">
                        {b.title}
                      </h3>
                      <p className="text-xs text-muted-foreground truncate">{new URL(b.url).hostname}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 -mt-2 -mr-2">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => handleDelete(b.id, e)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                      <div className="h-8 w-8 flex items-center justify-center text-muted-foreground opacity-50 group-hover:opacity-100 transition-opacity">
                        <ExternalLink className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                  {b.description && (
                    <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                      {b.description}
                    </p>
                  )}
                  {b.tags && b.tags.length > 0 && (
                    <div className="flex items-center gap-1 mt-auto pt-4">
                      {b.tags.map(t => (
                        <Badge key={t} variant="secondary" className="text-[10px] px-1.5 py-0 bg-background/50">
                          {t}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}