import { db, notesTable, remindersTable, meetingsTable, tasksTable, promptsTable, snippetsTable, bookmarksTable } from "@workspace/db";

async function seed() {
  console.log("Seeding database...");

  // Notes
  await db.insert(notesTable).values([
    {
      title: "System Design: Microservices vs Monolith",
      content: `# Microservices vs Monolith\n\n## When to choose Monolith\n- Early-stage startups\n- Small teams (< 10 engineers)\n- Unclear domain boundaries\n\n## When to choose Microservices\n- Independent scaling requirements\n- Multiple teams owning separate domains\n- Different tech stacks per service\n\n\`\`\`typescript\n// Example: API Gateway pattern\nconst gateway = createGateway({\n  services: ['auth', 'users', 'orders'],\n  timeout: 5000,\n});\n\`\`\`\n\n> **Key insight:** Start with a well-structured monolith. Extract services when you hit real bottlenecks, not imagined ones.`,
      tags: ["architecture", "backend", "design"],
      pinned: true,
    },
    {
      title: "RAG Pipeline Notes",
      content: `# Retrieval-Augmented Generation (RAG)\n\n## Core Components\n1. **Document Ingestion** – chunking, embedding, indexing\n2. **Vector Store** – pgvector, Pinecone, Chroma\n3. **Retrieval** – cosine similarity, MMR\n4. **Generation** – context injection into LLM prompt\n\n## Chunking strategies\n- Fixed-size: 512 tokens, 50-token overlap\n- Semantic: split on sentence boundaries\n- Hierarchical: parent-child chunks\n\n## Evaluation metrics\n- Faithfulness, Answer relevancy, Context recall`,
      tags: ["ai", "rag", "llm"],
      pinned: false,
    },
    {
      title: "PostgreSQL Performance Tips",
      content: `# PostgreSQL Performance\n\n## Index strategies\n\`\`\`sql\n-- Partial index for active records only\nCREATE INDEX idx_users_active ON users(email) WHERE deleted_at IS NULL;\n\n-- Composite index for common query pattern\nCREATE INDEX idx_orders_user_status ON orders(user_id, status);\n\`\`\`\n\n## EXPLAIN ANALYZE tips\n- Look for Seq Scan on large tables\n- Watch out for high row estimates vs actual\n- Check buffer hit ratios`,
      tags: ["database", "postgresql", "performance"],
      pinned: false,
    },
  ]).onConflictDoNothing();

  // Reminders
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);

  const inThreeDays = new Date();
  inThreeDays.setDate(inThreeDays.getDate() + 3);
  inThreeDays.setHours(15, 0, 0, 0);

  await db.insert(remindersTable).values([
    {
      title: "Review PR: Add vector search to API",
      description: "Check the embedding model choice and latency benchmarks before approving.",
      dueAt: tomorrow,
      done: false,
    },
    {
      title: "Update dependencies — security audit",
      description: "Run pnpm audit and patch any high/critical vulnerabilities.",
      dueAt: inThreeDays,
      done: false,
    },
  ]).onConflictDoNothing();

  // Meetings
  const todayMeeting = new Date();
  todayMeeting.setHours(14, 0, 0, 0);
  const todayMeetingEnd = new Date(todayMeeting.getTime() + 60 * 60 * 1000);

  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  nextWeek.setHours(10, 0, 0, 0);

  await db.insert(meetingsTable).values([
    {
      title: "AI Product Roadmap Q3 Review",
      description: "Review progress on AI features, discuss LLM cost optimization strategies.",
      startAt: todayMeeting,
      endAt: todayMeetingEnd,
      meetLink: "https://meet.google.com/abc-defg-hij",
    },
    {
      title: "Architecture Review: RAG System v2",
      description: "Deep dive into the new retrieval pipeline. Bring benchmarks.",
      startAt: nextWeek,
      endAt: new Date(nextWeek.getTime() + 90 * 60 * 1000),
      meetLink: "https://zoom.us/j/1234567890",
    },
  ]).onConflictDoNothing();

  // Tasks
  await db.insert(tasksTable).values([
    {
      title: "Implement streaming responses for AI chat",
      description: "Use Server-Sent Events or WebSockets to stream LLM output token by token.",
      status: "in_progress",
      priority: "high",
      tags: ["ai", "backend", "streaming"],
    },
    {
      title: "Set up pgvector for semantic search",
      description: "Add pgvector extension, create embeddings table, index with HNSW.",
      status: "todo",
      priority: "high",
      tags: ["database", "ai", "search"],
    },
    {
      title: "Write API rate limiting middleware",
      description: "Token bucket or sliding window algorithm. Redis-backed for distributed env.",
      status: "todo",
      priority: "medium",
      tags: ["backend", "security"],
    },
    {
      title: "Refactor auth to use refresh token rotation",
      description: "Current implementation has security gap with long-lived access tokens.",
      status: "done",
      priority: "high",
      tags: ["auth", "security"],
    },
  ]).onConflictDoNothing();

  // AI Prompts
  await db.insert(promptsTable).values([
    {
      title: "Code Review Assistant",
      content: `You are a senior software engineer conducting a thorough code review. Analyze the following code for:\n\n1. **Security vulnerabilities** (injection, auth issues, exposed secrets)\n2. **Performance concerns** (N+1 queries, memory leaks, unnecessary re-renders)\n3. **Code quality** (naming, complexity, duplication)\n4. **Edge cases** not handled\n\nBe specific and actionable. Prioritize findings as Critical / High / Medium / Low.\n\nCode to review:\n\`\`\`\n{{CODE}}\n\`\`\``,
      model: "claude-3-5-sonnet",
      tags: ["code-review", "engineering"],
    },
    {
      title: "System Design Explainer",
      content: `Explain the system design for {{SYSTEM}} as if you're a staff engineer presenting to a mixed audience of junior engineers and business stakeholders.\n\nCover:\n- Core components and their responsibilities\n- Data flow (sequence diagram in text if helpful)\n- Scale considerations (what breaks first, how to fix it)\n- Trade-offs made and why\n\nKeep it clear, avoid jargon where possible, define it when unavoidable.`,
      model: "gpt-4o",
      tags: ["system-design", "architecture"],
    },
    {
      title: "SQL Query Optimizer",
      content: `Analyze this SQL query and suggest optimizations:\n\n\`\`\`sql\n{{QUERY}}\n\`\`\`\n\nContext:\n- Database: {{DB_TYPE}}\n- Approximate row counts: {{TABLE_SIZES}}\n- Current execution time: {{EXEC_TIME}}\n\nProvide:\n1. Diagnosis of the bottleneck\n2. Optimized query with explanation\n3. Index recommendations if applicable`,
      model: "gpt-4o",
      tags: ["database", "sql", "performance"],
    },
  ]).onConflictDoNothing();

  // Code Snippets
  await db.insert(snippetsTable).values([
    {
      title: "Debounce hook (TypeScript)",
      code: `import { useEffect, useRef, useCallback } from 'react';\n\nexport function useDebounce<T extends (...args: unknown[]) => void>(\n  fn: T,\n  delay: number\n): T {\n  const timer = useRef<ReturnType<typeof setTimeout>>();\n\n  useEffect(() => () => clearTimeout(timer.current), []);\n\n  return useCallback(\n    (...args: Parameters<T>) => {\n      clearTimeout(timer.current);\n      timer.current = setTimeout(() => fn(...args), delay);\n    },\n    [fn, delay]\n  ) as T;\n}`,
      language: "typescript",
      description: "React hook for debouncing a callback function.",
      tags: ["react", "hooks", "utility"],
    },
    {
      title: "Exponential backoff retry",
      code: `async function withRetry<T>(\n  fn: () => Promise<T>,\n  maxAttempts = 3,\n  baseDelay = 1000\n): Promise<T> {\n  let lastError: unknown;\n\n  for (let attempt = 0; attempt < maxAttempts; attempt++) {\n    try {\n      return await fn();\n    } catch (err) {\n      lastError = err;\n      if (attempt < maxAttempts - 1) {\n        const delay = baseDelay * Math.pow(2, attempt);\n        await new Promise(resolve => setTimeout(resolve, delay));\n      }\n    }\n  }\n\n  throw lastError;\n}`,
      language: "typescript",
      description: "Retry a promise-returning function with exponential backoff.",
      tags: ["utility", "async", "resilience"],
    },
    {
      title: "OpenAI streaming response",
      code: `import OpenAI from 'openai';\n\nconst client = new OpenAI();\n\nasync function streamChat(userMessage: string) {\n  const stream = await client.chat.completions.create({\n    model: 'gpt-4o',\n    messages: [{ role: 'user', content: userMessage }],\n    stream: true,\n  });\n\n  for await (const chunk of stream) {\n    const delta = chunk.choices[0]?.delta?.content ?? '';\n    process.stdout.write(delta);\n  }\n}`,
      language: "typescript",
      description: "Stream chat completions from OpenAI API.",
      tags: ["ai", "openai", "streaming"],
    },
  ]).onConflictDoNothing();

  // Bookmarks
  await db.insert(bookmarksTable).values([
    {
      title: "pgvector: Open-source vector similarity search for PostgreSQL",
      url: "https://github.com/pgvector/pgvector",
      description: "Add vector search to your existing Postgres database. Supports L2, inner product, and cosine similarity.",
      tags: ["database", "ai", "vectors"],
    },
    {
      title: "Drizzle ORM Documentation",
      url: "https://orm.drizzle.team/docs/overview",
      description: "TypeScript ORM with a SQL-like syntax. Excellent DX and performance.",
      tags: ["typescript", "database", "orm"],
    },
    {
      title: "LangChain JS Documentation",
      url: "https://js.langchain.com/docs/introduction/",
      description: "Framework for building LLM-powered applications in TypeScript.",
      tags: ["ai", "llm", "langchain"],
    },
    {
      title: "tRPC — End-to-end typesafe APIs",
      url: "https://trpc.io",
      description: "Build fully typesafe APIs without schemas or code generation. Great for internal tools.",
      tags: ["typescript", "api", "fullstack"],
    },
  ]).onConflictDoNothing();

  console.log("Seed complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
