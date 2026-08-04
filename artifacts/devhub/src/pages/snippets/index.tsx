import React, { useState } from "react";
import { useListSnippets, useCreateSnippet, useDeleteSnippet, getListSnippetsQueryKey } from "@workspace/api-client-react";
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
import { Code2, Plus, Copy, Trash2, Check, Search } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

export default function Snippets() {
  const queryClient = useQueryClient();
  const { data: snippets, isLoading } = useListSnippets();
  const createSnippet = useCreateSnippet();
  const deleteSnippet = useDeleteSnippet();

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [code, setCode] = useState("");
  const [language, setLanguage] = useState("typescript");
  const [search, setSearch] = useState("");

  const [copiedId, setCopiedId] = useState<number | null>(null);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !code.trim()) return;
    
    createSnippet.mutate({ data: { title, code, language, tags: [] } }, {
      onSuccess: () => {
        setOpen(false);
        setTitle(""); setCode("");
        queryClient.invalidateQueries({ queryKey: getListSnippetsQueryKey() });
        toast.success("Snippet saved");
      }
    });
  };

  const handleDelete = (id: number) => {
    deleteSnippet.mutate({ id }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListSnippetsQueryKey() })
    });
  };

  const copyToClipboard = (id: number, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredSnippets = snippets?.filter(s => 
    s.title.toLowerCase().includes(search.toLowerCase()) || 
    s.code.toLowerCase().includes(search.toLowerCase()) ||
    s.language?.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const languages = ["typescript", "javascript", "python", "bash", "html", "css", "json", "rust", "go", "sql", "yaml", "markdown"];

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-mono text-primary flex items-center gap-3">
            <Code2 className="w-8 h-8 text-primary" />
            Snippets
          </h1>
          <p className="text-muted-foreground mt-1">Reusable code blocks and configurations.</p>
        </div>
        
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              New Snippet
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>Save Code Snippet</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="flex-1 overflow-auto space-y-4 py-4 pr-1">
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2 space-y-2">
                  <Label>Title</Label>
                  <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. React Query Setup" autoFocus required />
                </div>
                <div className="col-span-1 space-y-2">
                  <Label>Language</Label>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {languages.map(lang => (
                        <SelectItem key={lang} value={lang}>{lang}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2 flex-1 flex flex-col min-h-[250px]">
                <Label>Code</Label>
                <Textarea 
                  value={code} 
                  onChange={e => setCode(e.target.value)} 
                  placeholder="Paste your code here..."
                  className="flex-1 font-mono text-xs p-4 bg-muted/30"
                  required 
                  spellCheck={false}
                />
              </div>
              <DialogFooter className="mt-4">
                <Button type="submit" disabled={createSnippet.isPending}>Save Snippet</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input 
          placeholder="Search snippets..." 
          className="pl-9 max-w-md bg-card/50 border-border/50 focus-visible:ring-primary/50"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-64 rounded-xl" />)}
        </div>
      ) : filteredSnippets.length === 0 ? (
        <div className="flex-1 flex items-center justify-center border-2 border-dashed border-border/50 rounded-xl bg-card/20">
          <div className="text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto">
              <Code2 className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-lg font-medium">No snippets found</p>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 pb-8">
          {filteredSnippets.map(s => (
            <Card key={s.id} className="flex flex-col h-full bg-card/40 border-border/50 hover:border-primary/30 transition-colors overflow-hidden">
              <CardHeader className="py-3 px-4 bg-muted/20 border-b border-border/50 flex flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3 overflow-hidden">
                  <Badge variant="outline" className="text-[10px] font-mono bg-background text-primary border-primary/20 shrink-0">
                    {s.language}
                  </Badge>
                  <CardTitle className="text-sm line-clamp-1">{s.title}</CardTitle>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    onClick={() => copyToClipboard(s.id, s.code)}
                  >
                    {copiedId === s.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-7 w-7 text-muted-foreground hover:text-destructive" 
                    onClick={() => handleDelete(s.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0 flex-1 relative group">
                <div className="h-full max-h-[300px] overflow-auto no-scrollbar bg-[#0d1117] p-4 text-xs font-mono text-slate-300">
                  <pre><code className="whitespace-pre">{s.code}</code></pre>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}