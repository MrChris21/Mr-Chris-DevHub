import React, { useState } from "react";
import { useListPrompts, useCreatePrompt, useDeletePrompt, getListPromptsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Plus, Copy, Trash2, Check, Search } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

export default function Prompts() {
  const queryClient = useQueryClient();
  const { data: prompts, isLoading } = useListPrompts();
  const createPrompt = useCreatePrompt();
  const deletePrompt = useDeletePrompt();

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [model, setModel] = useState("gpt-4");
  const [search, setSearch] = useState("");

  const [copiedId, setCopiedId] = useState<number | null>(null);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    
    createPrompt.mutate({ data: { title, content, model, tags: [] } }, {
      onSuccess: () => {
        setOpen(false);
        setTitle(""); setContent("");
        queryClient.invalidateQueries({ queryKey: getListPromptsQueryKey() });
        toast.success("Prompt saved");
      }
    });
  };

  const handleDelete = (id: number) => {
    deletePrompt.mutate({ id }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListPromptsQueryKey() })
    });
  };

  const copyToClipboard = (id: number, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredPrompts = prompts?.filter(p => 
    p.title.toLowerCase().includes(search.toLowerCase()) || 
    p.content.toLowerCase().includes(search.toLowerCase()) ||
    p.model?.toLowerCase().includes(search.toLowerCase())
  ) || [];

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight font-mono text-primary flex items-center gap-3">
            <Sparkles className="w-8 h-8 text-primary" />
            AI Prompts
          </h1>
          <p className="text-muted-foreground mt-1">Your personal library of effective prompts.</p>
        </div>
        
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 w-full sm:w-auto">
              <Plus className="w-4 h-4" />
              New Prompt
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Save AI Prompt</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Code Reviewer" autoFocus required />
              </div>
              <div className="space-y-2">
                <Label>Optimized For</Label>
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gpt-4">GPT-4</SelectItem>
                    <SelectItem value="claude-3">Claude 3</SelectItem>
                    <SelectItem value="gemini">Gemini</SelectItem>
                    <SelectItem value="midjourney">Midjourney</SelectItem>
                    <SelectItem value="general">General / Any</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Prompt Content</Label>
                <Textarea 
                  value={content} 
                  onChange={e => setContent(e.target.value)} 
                  placeholder="You are an expert software engineer..."
                  className="min-h-[150px] font-mono text-sm"
                  required 
                />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={createPrompt.isPending}>Save</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input 
          placeholder="Search prompts..." 
          className="pl-9 max-w-md bg-card/50 border-border/50 focus-visible:ring-primary/50"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-64 rounded-xl" />)}
        </div>
      ) : filteredPrompts.length === 0 ? (
        <div className="flex-1 flex items-center justify-center border-2 border-dashed border-border/50 rounded-xl bg-card/20">
          <div className="text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto">
              <Sparkles className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-lg font-medium">No prompts found</p>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3 pb-8">
          {filteredPrompts.map(p => (
            <Card key={p.id} className="flex flex-col h-full bg-card/40 border-border/50 hover:border-primary/30 transition-colors">
              <CardHeader className="pb-3 flex flex-row items-start justify-between gap-4">
                <div className="space-y-1">
                  <CardTitle className="text-lg line-clamp-1">{p.title}</CardTitle>
                  <Badge variant="outline" className="text-[10px] font-mono bg-background/50">
                    {p.model || "general"}
                  </Badge>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0 -mr-2 -mt-2" onClick={() => handleDelete(p.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col gap-4">
                <div className="relative flex-1 bg-background/50 rounded-md border border-border/50 p-3 overflow-hidden group">
                  <p className="text-sm font-mono text-muted-foreground whitespace-pre-wrap line-clamp-6 group-hover:line-clamp-none transition-all">
                    {p.content}
                  </p>
                  
                  {/* Fade out at bottom if it's long and clamped, but we just use line-clamp above */}
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button 
                      size="sm" 
                      variant="secondary" 
                      className="h-7 shadow-sm gap-1"
                      onClick={() => copyToClipboard(p.id, p.content)}
                    >
                      {copiedId === p.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedId === p.id ? "Copied" : "Copy"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}