import { useState, useEffect, useRef, useCallback } from "react";

// ─── Mock Data ───────────────────────────────────────────────────────────────
const MOCK_USERS = [
  { name: "Ryan Hargrove", username: "rhargrove", avatar: "RH" },
  { name: "Alina Petrov", username: "apetrov", avatar: "AP" },
  { name: "Marcus Chen", username: "mchen", avatar: "MC" },
  { name: "Sofia Reyes", username: "sreyes", avatar: "SR" },
  { name: "James Liu", username: "jliu", avatar: "JL" },
];

const MOCK_MRS = [
  {
    id: 1, iid: 342,
    title: "Fix payment reconciliation timeout on large batch files",
    description: "## Summary\nResolves timeout issues when processing batch files > 500MB through the Verituity gateway.\n\n## Changes\n- Increased connection pool size\n- Added chunked processing for large files\n- Updated retry logic with exponential backoff\n\n## JIRA\nReferences SHIP-1042 for the original bug report.",
    repo: "payments-gateway", repoUrl: "https://gitlab.com/acme/payments-gateway",
    author: MOCK_USERS[0], assignee: MOCK_USERS[0], reviewers: [MOCK_USERS[1], MOCK_USERS[2]],
    createdAt: new Date(Date.now() - 8 * 3600000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 3600000).toISOString(),
    sourceBranch: "fix/batch-timeout", targetBranch: "main",
    pipeline: { status: "success", id: 88201 },
    approvals: { required: 2, given: 2, approvers: [MOCK_USERS[1], MOCK_USERS[2]] },
    mergeable: true, draft: false, labels: ["bug", "payments", "P1"], conflicts: false, changesCount: 7,
    commits: [
      { sha: "a1b2c3d4", title: "Increase connection pool size", author: MOCK_USERS[0], date: new Date(Date.now() - 7 * 3600000).toISOString() },
      { sha: "e5f6g7h8", title: "Add chunked processing for large batch files", author: MOCK_USERS[0], date: new Date(Date.now() - 5 * 3600000).toISOString() },
      { sha: "i9j0k1l2", title: "Update retry logic with exponential backoff", author: MOCK_USERS[0], date: new Date(Date.now() - 3 * 3600000).toISOString() },
    ],
    discussions: [
      { id: "d1", file: "src/gateway/batch_processor.rs", line: 142, notes: [
        { id: "n1", author: MOCK_USERS[1], body: "Should we add a configurable max chunk size here? Hardcoding 50MB feels fragile.", createdAt: new Date(Date.now() - 4 * 3600000).toISOString() },
        { id: "n2", author: MOCK_USERS[0], body: "Good point — I'll move it to the config. Updated in e5f6g7h8.", createdAt: new Date(Date.now() - 3 * 3600000).toISOString() },
      ], resolved: true },
      { id: "d2", file: null, line: null, notes: [
        { id: "n3", author: MOCK_USERS[2], body: "Tested against our staging environment with a 2GB file — no issues. LGTM 👍", createdAt: new Date(Date.now() - 2 * 3600000).toISOString() },
      ], resolved: false },
      { id: "d5", file: "src/retry/backoff.rs", line: 8, notes: [
        { id: "n7", author: MOCK_USERS[2], body: "Nit: the max_delay constant should probably live in config alongside the chunk size.", createdAt: new Date(Date.now() - 2.5 * 3600000).toISOString() },
      ], resolved: false },
    ],
    files: [
      { path: "src/gateway/batch_processor.rs", additions: 47, deletions: 12 },
      { path: "src/gateway/connection_pool.rs", additions: 8, deletions: 3 },
      { path: "src/config/defaults.toml", additions: 5, deletions: 1 },
      { path: "tests/gateway/batch_test.rs", additions: 89, deletions: 0 },
      { path: "src/retry/backoff.rs", additions: 22, deletions: 15 },
      { path: "docs/configuration.md", additions: 12, deletions: 2 },
      { path: "CHANGELOG.md", additions: 4, deletions: 0 },
    ],
    history: [
      { type: "opened", user: MOCK_USERS[0], date: new Date(Date.now() - 8 * 3600000).toISOString(), detail: "opened merge request" },
      { type: "pipeline", user: null, date: new Date(Date.now() - 7.5 * 3600000).toISOString(), detail: "Pipeline #88199 failed — test stage" },
      { type: "commit", user: MOCK_USERS[0], date: new Date(Date.now() - 7 * 3600000).toISOString(), detail: "pushed commit a1b2c3d4" },
      { type: "comment", user: MOCK_USERS[1], date: new Date(Date.now() - 4 * 3600000).toISOString(), detail: "commented on src/gateway/batch_processor.rs:142" },
      { type: "commit", user: MOCK_USERS[0], date: new Date(Date.now() - 5 * 3600000).toISOString(), detail: "pushed commit e5f6g7h8" },
      { type: "comment", user: MOCK_USERS[0], date: new Date(Date.now() - 3 * 3600000).toISOString(), detail: "replied on src/gateway/batch_processor.rs:142" },
      { type: "resolved", user: MOCK_USERS[0], date: new Date(Date.now() - 3 * 3600000).toISOString(), detail: "resolved thread on batch_processor.rs" },
      { type: "commit", user: MOCK_USERS[0], date: new Date(Date.now() - 3 * 3600000).toISOString(), detail: "pushed commit i9j0k1l2" },
      { type: "pipeline", user: null, date: new Date(Date.now() - 2.8 * 3600000).toISOString(), detail: "Pipeline #88201 passed" },
      { type: "approved", user: MOCK_USERS[1], date: new Date(Date.now() - 2.5 * 3600000).toISOString(), detail: "approved the merge request" },
      { type: "comment", user: MOCK_USERS[2], date: new Date(Date.now() - 2 * 3600000).toISOString(), detail: "commented: LGTM 👍" },
      { type: "approved", user: MOCK_USERS[2], date: new Date(Date.now() - 2 * 3600000).toISOString(), detail: "approved the merge request" },
    ],
  },
  {
    id: 2, iid: 339,
    title: "Add SAML SSO support for enterprise tenants",
    description: "Implements SAML 2.0 SSO for enterprise tier customers.\n\nJIRA: SHIP-980",
    repo: "auth-service", repoUrl: "https://gitlab.com/acme/auth-service",
    author: MOCK_USERS[1], assignee: MOCK_USERS[1], reviewers: [MOCK_USERS[0], MOCK_USERS[3]],
    createdAt: new Date(Date.now() - 22 * 3600000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 3600000).toISOString(),
    sourceBranch: "feature/saml-sso", targetBranch: "develop",
    pipeline: { status: "running", id: 88195 },
    approvals: { required: 2, given: 1, approvers: [MOCK_USERS[3]] },
    mergeable: false, draft: false, labels: ["feature", "auth", "enterprise"], conflicts: false, changesCount: 14,
    commits: [
      { sha: "m3n4o5p6", title: "Initial SAML provider implementation", author: MOCK_USERS[1], date: new Date(Date.now() - 20 * 3600000).toISOString() },
      { sha: "q7r8s9t0", title: "Add metadata endpoint and SP config", author: MOCK_USERS[1], date: new Date(Date.now() - 14 * 3600000).toISOString() },
    ],
    discussions: [
      { id: "d3", file: "src/auth/saml_handler.py", line: 88, notes: [
        { id: "n4", author: MOCK_USERS[0], body: "We need to validate the assertion signature before extracting attributes. This is a security concern.", createdAt: new Date(Date.now() - 6 * 3600000).toISOString() },
      ], resolved: false },
    ],
    files: [
      { path: "src/auth/saml_handler.py", additions: 215, deletions: 0 },
      { path: "src/auth/providers/__init__.py", additions: 3, deletions: 1 },
      { path: "src/config/saml.py", additions: 45, deletions: 0 },
      { path: "tests/auth/test_saml.py", additions: 178, deletions: 0 },
    ],
    history: [
      { type: "opened", user: MOCK_USERS[1], date: new Date(Date.now() - 22 * 3600000).toISOString(), detail: "opened merge request" },
      { type: "commit", user: MOCK_USERS[1], date: new Date(Date.now() - 20 * 3600000).toISOString(), detail: "pushed commit m3n4o5p6" },
      { type: "comment", user: MOCK_USERS[0], date: new Date(Date.now() - 6 * 3600000).toISOString(), detail: "commented on src/auth/saml_handler.py:88 — security concern" },
      { type: "approved", user: MOCK_USERS[3], date: new Date(Date.now() - 3 * 3600000).toISOString(), detail: "approved the merge request" },
      { type: "pipeline", user: null, date: new Date(Date.now() - 1 * 3600000).toISOString(), detail: "Pipeline #88195 running" },
    ],
  },
  {
    id: 3, iid: 341,
    title: "Upgrade React to v19 and migrate class components",
    description: "Major upgrade to React 19. Migrates remaining class components to functional with hooks.",
    repo: "web-dashboard", repoUrl: "https://gitlab.com/acme/web-dashboard",
    author: MOCK_USERS[2], assignee: MOCK_USERS[2], reviewers: [MOCK_USERS[4]],
    createdAt: new Date(Date.now() - 15 * 3600000).toISOString(),
    updatedAt: new Date(Date.now() - 4 * 3600000).toISOString(),
    sourceBranch: "chore/react-19-upgrade", targetBranch: "main",
    pipeline: { status: "failed", id: 88198 },
    approvals: { required: 1, given: 0, approvers: [] },
    mergeable: false, draft: false, labels: ["chore", "frontend", "breaking"], conflicts: true, changesCount: 42,
    commits: [
      { sha: "u1v2w3x4", title: "Upgrade react and react-dom to v19", author: MOCK_USERS[2], date: new Date(Date.now() - 14 * 3600000).toISOString() },
    ],
    discussions: [],
    files: [
      { path: "package.json", additions: 4, deletions: 4 },
      { path: "src/components/Dashboard.jsx", additions: 55, deletions: 78 },
      { path: "src/components/UserProfile.jsx", additions: 32, deletions: 45 },
    ],
    history: [
      { type: "opened", user: MOCK_USERS[2], date: new Date(Date.now() - 15 * 3600000).toISOString(), detail: "opened merge request" },
      { type: "pipeline", user: null, date: new Date(Date.now() - 14 * 3600000).toISOString(), detail: "Pipeline #88198 failed — test stage" },
    ],
  },
  {
    id: 4, iid: 340,
    title: "Implement rate limiting middleware",
    description: "Adds configurable rate limiting to all public API endpoints.\n\nSee SHIP-1015 for requirements.",
    repo: "api-gateway", repoUrl: "https://gitlab.com/acme/api-gateway",
    author: MOCK_USERS[3], assignee: MOCK_USERS[3], reviewers: [MOCK_USERS[0]],
    createdAt: new Date(Date.now() - 5 * 3600000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 3600000).toISOString(),
    sourceBranch: "feature/rate-limiting", targetBranch: "main",
    pipeline: { status: "success", id: 88200 },
    approvals: { required: 1, given: 0, approvers: [] },
    mergeable: false, draft: false, labels: ["feature", "security"], conflicts: false, changesCount: 9,
    commits: [
      { sha: "y5z6a7b8", title: "Add token bucket rate limiter", author: MOCK_USERS[3], date: new Date(Date.now() - 4 * 3600000).toISOString() },
    ],
    discussions: [],
    files: [
      { path: "src/middleware/rate_limiter.go", additions: 120, deletions: 0 },
      { path: "src/config/rate_limits.go", additions: 35, deletions: 0 },
      { path: "tests/middleware/rate_limiter_test.go", additions: 95, deletions: 0 },
    ],
    history: [
      { type: "opened", user: MOCK_USERS[3], date: new Date(Date.now() - 5 * 3600000).toISOString(), detail: "opened merge request" },
      { type: "pipeline", user: null, date: new Date(Date.now() - 4 * 3600000).toISOString(), detail: "Pipeline #88200 passed" },
    ],
  },
  {
    id: 5, iid: 338,
    title: "Database migration for multi-tenant schema isolation",
    description: "Implements schema-per-tenant isolation for the analytics database.\n\nRelated: SHIP-998",
    repo: "analytics-engine", repoUrl: "https://gitlab.com/acme/analytics-engine",
    author: MOCK_USERS[4], assignee: MOCK_USERS[4], reviewers: [MOCK_USERS[0], MOCK_USERS[2]],
    createdAt: new Date(Date.now() - 30 * 3600000).toISOString(),
    updatedAt: new Date(Date.now() - 8 * 3600000).toISOString(),
    sourceBranch: "feature/tenant-isolation", targetBranch: "main",
    pipeline: { status: "success", id: 88190 },
    approvals: { required: 2, given: 2, approvers: [MOCK_USERS[0], MOCK_USERS[2]] },
    mergeable: true, draft: false, labels: ["feature", "database", "multi-tenant"], conflicts: false, changesCount: 11,
    commits: [
      { sha: "c9d0e1f2", title: "Add tenant schema migration scripts", author: MOCK_USERS[4], date: new Date(Date.now() - 28 * 3600000).toISOString() },
      { sha: "g3h4i5j6", title: "Update ORM to support schema routing", author: MOCK_USERS[4], date: new Date(Date.now() - 20 * 3600000).toISOString() },
    ],
    discussions: [
      { id: "d4", file: "migrations/003_tenant_schemas.sql", line: 15, notes: [
        { id: "n5", author: MOCK_USERS[0], body: "Consider adding an index on tenant_id in the lookup table — queries will be slow without it at scale.", createdAt: new Date(Date.now() - 18 * 3600000).toISOString() },
        { id: "n6", author: MOCK_USERS[4], body: "Added in g3h4i5j6. Good catch.", createdAt: new Date(Date.now() - 16 * 3600000).toISOString() },
      ], resolved: true },
    ],
    files: [
      { path: "migrations/003_tenant_schemas.sql", additions: 65, deletions: 0 },
      { path: "src/db/schema_router.py", additions: 48, deletions: 12 },
      { path: "src/db/tenant_manager.py", additions: 80, deletions: 5 },
      { path: "tests/db/test_schema_routing.py", additions: 110, deletions: 0 },
    ],
    history: [
      { type: "opened", user: MOCK_USERS[4], date: new Date(Date.now() - 30 * 3600000).toISOString(), detail: "opened merge request" },
      { type: "commit", user: MOCK_USERS[4], date: new Date(Date.now() - 28 * 3600000).toISOString(), detail: "pushed commit c9d0e1f2" },
      { type: "comment", user: MOCK_USERS[0], date: new Date(Date.now() - 18 * 3600000).toISOString(), detail: "commented on migrations/003_tenant_schemas.sql:15" },
      { type: "commit", user: MOCK_USERS[4], date: new Date(Date.now() - 20 * 3600000).toISOString(), detail: "pushed commit g3h4i5j6" },
      { type: "resolved", user: MOCK_USERS[4], date: new Date(Date.now() - 16 * 3600000).toISOString(), detail: "resolved thread on 003_tenant_schemas.sql" },
      { type: "pipeline", user: null, date: new Date(Date.now() - 10 * 3600000).toISOString(), detail: "Pipeline #88190 passed" },
      { type: "approved", user: MOCK_USERS[0], date: new Date(Date.now() - 9 * 3600000).toISOString(), detail: "approved the merge request" },
      { type: "approved", user: MOCK_USERS[2], date: new Date(Date.now() - 8 * 3600000).toISOString(), detail: "approved the merge request" },
    ],
  },
  {
    id: 6, iid: 343,
    title: "WIP: gRPC service mesh prototype",
    description: "Exploring gRPC for inter-service communication. Early prototype — do not merge.",
    repo: "service-mesh", repoUrl: "https://gitlab.com/acme/service-mesh",
    author: MOCK_USERS[2], assignee: MOCK_USERS[2], reviewers: [],
    createdAt: new Date(Date.now() - 2 * 3600000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 3600000).toISOString(),
    sourceBranch: "proto/grpc-mesh", targetBranch: "develop",
    pipeline: { status: "pending", id: 88205 },
    approvals: { required: 1, given: 0, approvers: [] },
    mergeable: false, draft: true, labels: ["prototype", "infra"], conflicts: false, changesCount: 5,
    commits: [
      { sha: "k7l8m9n0", title: "Initial gRPC proto definitions", author: MOCK_USERS[2], date: new Date(Date.now() - 2 * 3600000).toISOString() },
    ],
    discussions: [],
    files: [
      { path: "proto/services.proto", additions: 85, deletions: 0 },
      { path: "src/mesh/grpc_server.go", additions: 120, deletions: 0 },
    ],
    history: [
      { type: "opened", user: MOCK_USERS[2], date: new Date(Date.now() - 2 * 3600000).toISOString(), detail: "opened merge request" },
      { type: "pipeline", user: null, date: new Date(Date.now() - 1.5 * 3600000).toISOString(), detail: "Pipeline #88205 pending" },
    ],
  },
];

const CURRENT_USER = MOCK_USERS[0];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function timeAgo(ds) {
  const d = Date.now() - new Date(ds).getTime();
  const h = Math.floor(d / 3600000);
  if (h < 1) return `${Math.floor(d / 60000)}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
function hoursOld(ds) { return (Date.now() - new Date(ds).getTime()) / 3600000; }
function pipelineColor(s) { return s === "success" ? "#34d399" : s === "running" ? "#facc15" : s === "failed" ? "#f87171" : "#6b7280"; }
function pipelineLabel(s) { return s === "success" ? "Passed" : s === "running" ? "Running" : s === "failed" ? "Failed" : s === "pending" ? "Pending" : "Unknown"; }
function cardBg(ds, p) { const h = hoursOld(ds); return h > p.redHours ? "rgba(220,38,38,0.12)" : h > p.orangeHours ? "rgba(234,179,8,0.10)" : "transparent"; }

function generateMockDiff(file) {
  const ext = file.path.split(".").pop();
  const lines = [];
  const ctx = {
    rs: ["use std::io::Result;","","pub struct BatchProcessor {","    pool: ConnectionPool,","    config: ProcessorConfig,","}","","impl BatchProcessor {","    pub fn new(config: ProcessorConfig) -> Self {","        Self {","            pool: ConnectionPool::new(config.pool_size),","            config,","        }","    }",""],
    py: ["import logging","from typing import Optional","","logger = logging.getLogger(__name__)","","class Handler:","    def __init__(self):","        self.config = {}","        self.session = None",""],
    go: ["package middleware","",`import (`,'    "context"','    "sync"','    "time"','    "golang.org/x/time/rate"',")","",'func NewRateLimiter(rps int) *RateLimiter {','    return &RateLimiter{','        limiter: rate.NewLimiter(rate.Limit(rps), rps),','    }',"}",""],
    sql: ["-- Migration: tenant schema isolation","BEGIN;","","CREATE SCHEMA IF NOT EXISTS tenant_registry;","","CREATE TABLE tenant_registry.tenants (","    id SERIAL PRIMARY KEY,","    tenant_id VARCHAR(64) NOT NULL UNIQUE,","    schema_name VARCHAR(128) NOT NULL,","    created_at TIMESTAMPTZ DEFAULT NOW()",");","","CREATE INDEX idx_tenant_lookup ON tenant_registry.tenants(tenant_id);","","COMMIT;",""],
    toml: ['[gateway]','host = "0.0.0.0"','port = 8443','max_connections = 256','','[processing]','chunk_size_mb = 50','max_retries = 3','backoff_base_ms = 100',""],
    md: ["# Configuration Guide","","## Gateway Settings","","The gateway can be configured via `defaults.toml`.","Key settings include connection pool size and chunk processing limits.",""],
    json: ['{','  "name": "web-dashboard",','  "version": "2.4.1",','  "private": true,','  "dependencies": {','    "react": "^19.0.0",','    "react-dom": "^19.0.0"','  }',"}",""],
    jsx: ['import React, { useState, useEffect } from "react";','','function Dashboard({ user }) {','  const [data, setData] = useState(null);','','  useEffect(() => {','    fetchDashboardData(user.id).then(setData);','  }, [user.id]);','','  return (','    <div className="dashboard">','      {data && <DashboardGrid data={data} />}','    </div>','  );','}',''],
    proto: ['syntax = "proto3";','','package mesh;','','service MeshRouter {','  rpc RouteRequest (RouteReq) returns (RouteResp);','  rpc HealthCheck (Empty) returns (HealthStatus);','}','','message RouteReq {','  string service = 1;','  string method = 2;','  bytes payload = 3;','}',''],
  }[ext] || ["// source file","","function main() {","  // implementation","","};",""];
  let num = 1;
  const contextCount = Math.min(ctx.length, 6);
  for (let i = 0; i < contextCount; i++) lines.push({ type: "context", num: num++, content: ctx[i] });
  for (let i = 0; i < Math.min(file.deletions, 5); i++) lines.push({ type: "deletion", num: num++, content: `    // removed: old_logic_${i + 1}()` });
  for (let i = 0; i < Math.min(file.additions, 8); i++) lines.push({ type: "addition", num: num++, content: `    // added: new_implementation_${i + 1}()` });
  const remaining = ctx.slice(contextCount);
  for (let i = 0; i < Math.min(remaining.length, 5); i++) lines.push({ type: "context", num: num++, content: remaining[i] });
  return lines;
}

// ─── Icons ───────────────────────────────────────────────────────────────────
const I = {
  Anchor: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="5" r="3"/><line x1="12" y1="22" x2="12" y2="8"/><path d="M5 12H2a10 10 0 0 0 20 0h-3"/></svg>,
  Bell: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  User: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  Check: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  X: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  GitMerge: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M6 21V9a9 9 0 0 0 9 9"/></svg>,
  ChevDown: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>,
  ChevRight: () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>,
  ChevLeft: () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>,
  File: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  Folder: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>,
  Msg: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  Settings: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  LogOut: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  Pipeline: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="5" cy="12" r="2"/><circle cx="19" cy="12" r="2"/><circle cx="12" cy="5" r="2"/><circle cx="12" cy="19" r="2"/><line x1="7" y1="12" x2="17" y2="12"/><line x1="12" y1="7" x2="12" y2="17"/></svg>,
  ExtLink: () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>,
  Sort: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>,
  Sidebar: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>,
  Collapse: () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>,
  Clock: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  Comment: () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  Plus: () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  Minus: () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>,
};

// ─── CSS ─────────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Outfit:wght@300;400;500;600;700&display=swap');
:root {
  --bg-root:#0a0c10;--bg-s:#12151c;--bg-sr:#181c26;--bg-sh:#1e2330;--bg-sa:#242a38;
  --brd:#2a3040;--brd-s:#1e2430;
  --t1:#e2e8f0;--t2:#94a3b8;--tm:#5a6577;
  --acc:#38bdf8;--acc-d:rgba(56,189,248,0.15);--acc-g:rgba(56,189,248,0.08);
  --grn:#34d399;--grn-d:rgba(52,211,153,0.15);--yel:#facc15;--yel-d:rgba(250,204,21,0.12);
  --red:#f87171;--red-d:rgba(248,113,113,0.12);--org:#fb923c;--org-d:rgba(251,146,60,0.12);
  --sans:'Outfit',sans-serif;--mono:'JetBrains Mono',monospace;
  --r:8px;--rs:5px;--rl:12px;
}
*{margin:0;padding:0;box-sizing:border-box}
body,#root{font-family:var(--sans);background:var(--bg-root);color:var(--t1);height:100vh;overflow:hidden}
::-webkit-scrollbar{width:6px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:var(--brd);border-radius:3px}::-webkit-scrollbar-thumb:hover{background:var(--tm)}
.sy{display:flex;flex-direction:column;height:100vh;overflow:hidden}

/* Top Bar */
.tb{display:flex;align-items:center;justify-content:space-between;height:52px;min-height:52px;padding:0 16px;background:var(--bg-s);border-bottom:1px solid var(--brd);z-index:100}
.tb-l{display:flex;align-items:center;gap:10px}
.tb-logo{color:var(--acc);display:flex;align-items:center}
.tb-title{font-weight:700;font-size:17px;letter-spacing:-0.3px;background:linear-gradient(135deg,var(--acc),#a78bfa);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.tb-r{display:flex;align-items:center;gap:6px}
.ib{width:36px;height:36px;display:flex;align-items:center;justify-content:center;border-radius:var(--r);border:none;background:transparent;color:var(--t2);cursor:pointer;transition:all .15s;position:relative}
.ib:hover{background:var(--bg-sh);color:var(--t1)}
.bdg{position:absolute;top:4px;right:4px;width:8px;height:8px;background:var(--acc);border-radius:50%;border:2px solid var(--bg-s)}

/* Main */
.ml{display:flex;flex:1;overflow:hidden}

/* Sidebar */
.sb{width:340px;min-width:0;border-right:1px solid var(--brd);display:flex;flex-direction:column;background:var(--bg-s);transition:width .25s ease,min-width .25s ease,opacity .2s ease;overflow:hidden}
.sb.collapsed{width:0;min-width:0;border-right:none;opacity:0;pointer-events:none}
.sb-h{padding:12px 14px 10px;border-bottom:1px solid var(--brd-s);flex-shrink:0}
.sb-toggle{position:absolute;left:0;top:52px;z-index:50;background:var(--bg-sr);border:1px solid var(--brd);border-left:none;border-radius:0 var(--rs) var(--rs) 0;width:24px;height:36px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--t2);transition:all .15s}
.sb-toggle:hover{background:var(--bg-sh);color:var(--t1)}
.sb-toggle.open{left:340px}

.ft{display:flex;gap:2px;background:var(--bg-root);border-radius:var(--r);padding:3px}
.ft-b{flex:1;padding:6px 8px;border:none;border-radius:var(--rs);background:transparent;color:var(--tm);font-family:var(--sans);font-size:12px;font-weight:500;cursor:pointer;transition:all .15s;white-space:nowrap}
.ft-b.a{background:var(--bg-sr);color:var(--t1);box-shadow:0 1px 3px rgba(0,0,0,.3)}
.ft-b:hover:not(.a){color:var(--t2)}
.sr{display:flex;align-items:center;justify-content:space-between;margin-top:8px;padding:0 2px}
.sr-l{font-size:11px;color:var(--tm)}
.sr-b{display:flex;align-items:center;gap:4px;font-size:11px;color:var(--t2);background:none;border:none;cursor:pointer;font-family:var(--sans);padding:2px 6px;border-radius:var(--rs);transition:all .15s}
.sr-b:hover{background:var(--bg-sh);color:var(--t1)}
.sr-b svg{transition:transform .2s}
.sr-b.asc svg{transform:rotate(180deg)}
.mrl{flex:1;overflow-y:auto;padding:6px}

/* MR Card */
.mc{padding:10px 12px;border-radius:var(--r);cursor:pointer;transition:all .15s;border:1px solid transparent;margin-bottom:4px}
.mc:hover{background:var(--bg-sh);border-color:var(--brd-s)}
.mc.sel{background:var(--acc-g);border-color:var(--acc);box-shadow:0 0 0 1px var(--acc),inset 0 0 12px var(--acc-g)}
.mc-t{font-size:12.5px;font-weight:500;line-height:1.35;color:var(--t1);margin-bottom:2px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.mc-r{color:var(--acc);font-weight:600}
.mc-rdy{font-size:11px;font-style:italic;color:var(--grn);margin:2px 0;font-weight:500}
.mc-dft{font-size:11px;font-style:italic;color:var(--tm);margin:2px 0}
.mc-m{display:flex;align-items:center;gap:10px;margin-top:4px;font-size:11px;color:var(--tm)}
.mc-m a{color:var(--t2);text-decoration:none}.mc-m a:hover{color:var(--acc);text-decoration:underline}
.sd{display:inline-block;width:8px;height:8px;border-radius:50%;flex-shrink:0}
.sd.pu{animation:pu 1.5s infinite}
@keyframes pu{0%,100%{opacity:1}50%{opacity:.4}}
.ai{display:flex;align-items:center;gap:3px}

/* Main Content */
.mco{flex:1;display:flex;flex-direction:column;overflow:hidden;background:var(--bg-root)}
.es{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;color:var(--tm);gap:12px}
.es svg{opacity:.3}.es-t{font-size:14px}

/* Overview */
.ov{border-bottom:1px solid var(--brd);background:var(--bg-s);overflow:hidden;transition:max-height .3s ease}
.ov.c{max-height:40px}.ov.e{max-height:600px}
.ov-tg{display:flex;align-items:center;justify-content:space-between;padding:10px 16px;cursor:pointer;user-select:none}
.ov-tg:hover{background:var(--bg-sh)}
.ov-tg h2{font-size:14px;font-weight:600;color:var(--t1);display:flex;align-items:center;gap:8px}
.ov-tg svg{transition:transform .2s;color:var(--tm)}
.ov-tg.e svg{transform:rotate(180deg)}
.ov-b{padding:0 16px 14px}
.ov-title{font-size:18px;font-weight:600;margin-bottom:6px;line-height:1.3}
.ov-br{font-size:12px;color:var(--tm);font-family:var(--mono);margin-bottom:10px}
.ov-br span{color:var(--acc)}
.ov-desc{font-size:13px;color:var(--t2);line-height:1.5;margin-bottom:12px;max-height:80px;overflow-y:auto}
.ov-desc .jl{color:var(--acc);cursor:pointer;text-decoration:underline;text-decoration-style:dotted}
.ov-bdg{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px}
.bp{padding:3px 10px;border-radius:99px;font-size:11px;font-weight:500}
.ov-st{display:flex;gap:16px;font-size:12px;color:var(--t2)}.ov-st>div{display:flex;align-items:center;gap:5px}
.ov-act{display:flex;gap:8px;margin-top:12px}
.btn{padding:7px 14px;border-radius:var(--rs);border:1px solid var(--brd);background:var(--bg-sr);color:var(--t1);font-size:12px;font-weight:500;font-family:var(--sans);cursor:pointer;display:flex;align-items:center;gap:6px;transition:all .15s;text-decoration:none}
.btn:hover{background:var(--bg-sh);border-color:var(--tm)}
.btn-p{background:var(--acc);color:#0a0c10;border-color:var(--acc);font-weight:600}.btn-p:hover{background:#5cc8f8}.btn-p:disabled{opacity:.4;cursor:not-allowed}
.btn-d{border-color:var(--red);color:var(--red)}.btn-d:hover{background:var(--red-d)}
.btn-a{border-color:var(--grn);color:var(--grn)}.btn-a:hover{background:var(--grn-d)}

/* Content tabs */
.ct{display:flex;border-bottom:1px solid var(--brd);background:var(--bg-s);padding:0 16px}
.ct-b{padding:10px 16px;border:none;background:transparent;color:var(--tm);font-size:12px;font-weight:500;font-family:var(--sans);cursor:pointer;border-bottom:2px solid transparent;transition:all .15s;display:flex;align-items:center;gap:6px}
.ct-b:hover{color:var(--t2)}.ct-b.a{color:var(--acc);border-bottom-color:var(--acc)}
.tc{background:var(--bg-sa);padding:1px 6px;border-radius:99px;font-size:10px}

/* Diff layout */
.dl{display:flex;flex:1;overflow:hidden}
.ftr{width:220px;min-width:0;border-right:1px solid var(--brd);overflow-y:auto;padding:8px 0;background:var(--bg-s);transition:width .2s ease,min-width .2s ease,opacity .15s ease;flex-shrink:0}
.ftr.collapsed{width:0;min-width:0;border-right:none;opacity:0;pointer-events:none}
.ftr-toggle{display:flex;align-items:center;gap:4px;padding:6px 12px;font-size:11px;color:var(--tm);cursor:pointer;border:none;background:none;font-family:var(--sans);transition:color .15s}
.ftr-toggle:hover{color:var(--t1)}
.fts{padding:0 8px}
.ftf{display:flex;align-items:center;gap:6px;padding:4px 8px;font-size:12px;color:var(--t2);font-weight:500;cursor:pointer;border-radius:var(--rs);user-select:none}
.ftf:hover{background:var(--bg-sh)}
.ftfl{display:flex;align-items:center;gap:6px;padding:4px 8px 4px 26px;font-size:11px;color:var(--t2);cursor:pointer;border-radius:var(--rs);font-family:var(--mono);user-select:none}
.ftfl:hover{background:var(--bg-sh);color:var(--t1)}.ftfl.sel{background:var(--acc-d);color:var(--acc)}
.ftfl-s{margin-left:auto;font-size:10px;display:flex;gap:4px}
.ftfl-s .a{color:var(--grn)}.ftfl-s .d{color:var(--red)}

/* Scrollable diff */
.da{flex:1;overflow-y:auto;padding:0}
.df-sec{border-bottom:1px solid var(--brd)}
.df-hdr{position:sticky;top:0;background:var(--bg-sr);border-bottom:1px solid var(--brd);padding:8px 16px;font-size:13px;font-family:var(--mono);color:var(--t1);display:flex;align-items:center;gap:8px;z-index:10;cursor:pointer;user-select:none}
.df-hdr:hover{background:var(--bg-sh)}
.df-hdr .collapse-icon{transition:transform .2s;color:var(--tm);flex-shrink:0}
.df-hdr .collapse-icon.open{transform:rotate(90deg)}
.df-stats{font-size:11px;margin-left:auto;display:flex;gap:8px}.df-stats .a{color:var(--grn)}.df-stats .d{color:var(--red)}
.df-lines{font-family:var(--mono);font-size:12px;line-height:1.7}
.dfl{display:flex;padding:0 16px;min-height:24px;align-items:center;transition:background .1s}
.dfl:hover{background:var(--bg-sh)}
.dfl-n{width:50px;text-align:right;color:var(--tm);user-select:none;font-size:11px;padding-right:12px;flex-shrink:0}
.dfl-c{flex:1;white-space:pre;overflow-x:auto}
.dfl-cmt-btn{opacity:0;color:var(--acc);cursor:pointer;margin-left:8px;flex-shrink:0}
.dfl:hover .dfl-cmt-btn{opacity:1}
.dfl.add{background:rgba(52,211,153,.06)}.dfl.add .dfl-c::before{content:"+ ";color:var(--grn)}
.dfl.del{background:rgba(248,113,113,.06)}.dfl.del .dfl-c::before{content:"- ";color:var(--red)}
.dfl.ctx .dfl-c::before{content:"  "}

/* Inline comment threads */
.ict{border:1px solid var(--brd);border-radius:var(--r);margin:4px 16px 8px 66px;background:var(--bg-s);overflow:hidden}
.ic{padding:10px 12px;border-bottom:1px solid var(--brd-s)}.ic:last-child{border-bottom:none}
.ic-h{display:flex;align-items:center;gap:8px;margin-bottom:4px}
.cav{width:24px;height:24px;border-radius:50%;background:var(--bg-sa);display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:var(--t2);flex-shrink:0}
.c-author{font-size:12px;font-weight:600;color:var(--t1)}.c-author a{color:inherit;text-decoration:none}.c-author a:hover{color:var(--acc)}
.c-time{font-size:11px;color:var(--tm)}
.c-res{font-size:10px;color:var(--grn);background:var(--grn-d);padding:2px 6px;border-radius:99px;margin-left:auto}
.ic-body{font-size:13px;color:var(--t2);line-height:1.5;padding-left:32px}
.ic-reply{display:flex;gap:8px;padding:8px 12px;background:var(--bg-sr)}
.ic-reply input{flex:1;background:var(--bg-root);border:1px solid var(--brd);border-radius:var(--rs);padding:6px 10px;color:var(--t1);font-size:12px;font-family:var(--sans);outline:none}
.ic-reply input:focus{border-color:var(--acc)}
.ic-reply button{padding:6px 12px;background:var(--acc-d);color:var(--acc);border:1px solid rgba(56,189,248,.3);border-radius:var(--rs);font-size:12px;font-family:var(--sans);cursor:pointer}

/* Commits */
.cl{flex:1;overflow-y:auto;padding:12px 16px}
.ci{display:flex;align-items:flex-start;gap:12px;padding:10px 12px;border-radius:var(--r);transition:background .15s}
.ci:hover{background:var(--bg-sh)}
.c-sha{font-family:var(--mono);font-size:12px;color:var(--acc);cursor:pointer;flex-shrink:0;text-decoration:none}.c-sha:hover{text-decoration:underline}
.c-msg{font-size:13px;color:var(--t1);flex:1}
.c-meta{font-size:11px;color:var(--tm);margin-top:2px}.c-meta a{color:var(--t2);text-decoration:none}.c-meta a:hover{color:var(--acc)}

/* Pipeline */
.pv{flex:1;overflow-y:auto;padding:16px}
.pv-h{display:flex;align-items:center;gap:10px;margin-bottom:16px}
.pv-id{font-family:var(--mono);font-size:13px;color:var(--acc)}
.pv-stages{display:flex;gap:4px;align-items:center;flex-wrap:wrap}
.pv-stage{background:var(--bg-s);border:1px solid var(--brd);border-radius:var(--r);padding:10px 14px;min-width:120px;cursor:pointer;transition:all .15s}
.pv-stage:hover{border-color:var(--tm);background:var(--bg-sh)}.pv-stage.sel{border-color:var(--acc);background:var(--acc-g)}
.pv-sn{font-size:12px;font-weight:600;margin-bottom:4px}
.pv-ss{font-size:11px;display:flex;align-items:center;gap:5px}
.pv-con{width:20px;height:2px;background:var(--brd);flex-shrink:0}
.pv-log{margin-top:16px;background:var(--bg-s);border:1px solid var(--brd);border-radius:var(--r);overflow:hidden}
.pv-lh{padding:10px 14px;border-bottom:1px solid var(--brd);font-size:13px;font-weight:600;display:flex;align-items:center;gap:8px}
.pv-lb{padding:12px 14px;font-family:var(--mono);font-size:11px;line-height:1.8;color:var(--t2);max-height:250px;overflow-y:auto;background:var(--bg-root)}
.ll{display:flex;gap:12px}.ll-n{color:var(--tm);user-select:none;min-width:30px;text-align:right}
.ll-t{color:var(--t2)}.ll-t.s{color:var(--grn)}.ll-t.e{color:var(--red)}.ll-t.w{color:var(--yel)}

/* Discussions */
.dv{flex:1;overflow-y:auto;padding:12px 16px}
.dt{margin-bottom:16px;border:1px solid var(--brd);border-radius:var(--r);overflow:hidden;background:var(--bg-s)}
.dt-loc{padding:8px 12px;background:var(--bg-sr);font-family:var(--mono);font-size:11px;color:var(--tm);border-bottom:1px solid var(--brd-s);display:flex;align-items:center;gap:6px}
.dt-loc .lr{color:var(--acc)}
.gc-tag{background:var(--acc-d);color:var(--acc);padding:2px 8px;border-radius:99px;font-size:10px;font-family:var(--sans);font-weight:500}
.mr-ci{display:flex;gap:8px;padding:12px 16px;background:var(--bg-s);border-top:1px solid var(--brd)}
.mr-ci input{flex:1;background:var(--bg-root);border:1px solid var(--brd);border-radius:var(--rs);padding:8px 12px;color:var(--t1);font-size:13px;font-family:var(--sans);outline:none}
.mr-ci input:focus{border-color:var(--acc)}

/* History */
.hv{flex:1;overflow-y:auto;padding:16px}
.h-timeline{position:relative;padding-left:28px}
.h-timeline::before{content:"";position:absolute;left:10px;top:6px;bottom:6px;width:2px;background:var(--brd)}
.h-ev{position:relative;margin-bottom:4px;padding:8px 12px;border-radius:var(--r);transition:background .15s}
.h-ev:hover{background:var(--bg-sh)}
.h-ev::before{content:"";position:absolute;left:-22px;top:14px;width:10px;height:10px;border-radius:50%;border:2px solid var(--brd);background:var(--bg-root)}
.h-ev.ev-opened::before{background:var(--acc);border-color:var(--acc)}
.h-ev.ev-approved::before{background:var(--grn);border-color:var(--grn)}
.h-ev.ev-comment::before{background:var(--yel);border-color:var(--yel)}
.h-ev.ev-commit::before{background:var(--t2);border-color:var(--t2)}
.h-ev.ev-pipeline::before{background:var(--org);border-color:var(--org)}
.h-ev.ev-resolved::before{background:var(--grn);border-color:var(--grn)}
.h-detail{font-size:13px;color:var(--t1)}
.h-detail a{color:var(--acc);text-decoration:none}.h-detail a:hover{text-decoration:underline}
.h-meta{font-size:11px;color:var(--tm);margin-top:2px}

/* Jira Popup */
.jp-ov{position:fixed;inset:0;background:rgba(0,0,0,.6);backdrop-filter:blur(4px);z-index:1000;display:flex;align-items:center;justify-content:center;animation:fi .15s ease}
@keyframes fi{from{opacity:0}to{opacity:1}}
.jp{background:var(--bg-s);border:1px solid var(--brd);border-radius:var(--rl);width:480px;max-height:80vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.5);animation:su .2s ease}
@keyframes su{from{transform:translateY(10px);opacity:0}to{transform:translateY(0);opacity:1}}
.jp-h{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--brd)}
.jp-h h3{font-size:15px;font-weight:600;color:var(--acc)}
.jp-b{padding:20px}
.jf{margin-bottom:14px}
.jf-l{font-size:11px;font-weight:600;color:var(--tm);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px}
.jf-v{font-size:13px;color:var(--t1);line-height:1.5}

/* Toast */
.toast{position:fixed;bottom:20px;right:20px;background:var(--bg-sr);border:1px solid var(--brd);border-radius:var(--r);padding:12px 16px;box-shadow:0 8px 30px rgba(0,0,0,.4);z-index:2000;display:flex;align-items:center;gap:10px;animation:sir .3s ease;max-width:350px}
@keyframes sir{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}
.toast-i{width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.toast-b{flex:1}.toast-t{font-size:12px;font-weight:600;margin-bottom:2px}.toast-m{font-size:11px;color:var(--t2)}

/* User Menu */
.um{position:absolute;top:48px;right:8px;background:var(--bg-sr);border:1px solid var(--brd);border-radius:var(--r);box-shadow:0 8px 30px rgba(0,0,0,.4);z-index:200;overflow:hidden;min-width:180px;animation:fi .1s ease}
.um-h{padding:12px 14px;border-bottom:1px solid var(--brd-s)}
.um-n{font-size:13px;font-weight:600}.um-u{font-size:11px;color:var(--tm)}
.um-i{display:flex;align-items:center;gap:10px;padding:10px 14px;font-size:13px;color:var(--t2);cursor:pointer;transition:all .1s;border:none;background:none;width:100%;font-family:var(--sans);text-align:left}
.um-i:hover{background:var(--bg-sh);color:var(--t1)}

/* Notif Panel */
.np{position:absolute;top:48px;right:44px;width:320px;background:var(--bg-sr);border:1px solid var(--brd);border-radius:var(--r);box-shadow:0 8px 30px rgba(0,0,0,.4);z-index:200;animation:fi .1s ease;max-height:400px;overflow-y:auto}
.np-h{padding:12px 14px;border-bottom:1px solid var(--brd-s);font-size:13px;font-weight:600}
.np-i{padding:10px 14px;border-bottom:1px solid var(--brd-s);cursor:pointer;transition:background .1s}
.np-i:hover{background:var(--bg-sh)}.np-i:last-child{border-bottom:none}
.np-it{font-size:12px;font-weight:500;margin-bottom:2px}.np-tm{font-size:11px;color:var(--tm)}

/* Prefs */
.po{position:fixed;inset:0;background:rgba(0,0,0,.6);backdrop-filter:blur(4px);z-index:1000;display:flex;align-items:center;justify-content:center}
.pm{background:var(--bg-s);border:1px solid var(--brd);border-radius:var(--rl);width:440px;box-shadow:0 20px 60px rgba(0,0,0,.5);animation:su .2s ease}
.pm-h{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--brd)}.pm-h h3{font-size:15px;font-weight:600}
.pm-b{padding:20px}
.pg{margin-bottom:18px}.pg-t{font-size:12px;font-weight:600;color:var(--tm);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px}
.pr{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
.pl{font-size:13px;color:var(--t2)}
.pi{width:60px;background:var(--bg-root);border:1px solid var(--brd);border-radius:var(--rs);padding:5px 8px;color:var(--t1);font-size:13px;font-family:var(--sans);text-align:center;outline:none}
.pi:focus{border-color:var(--acc)}
.ptg{width:38px;height:20px;border-radius:10px;background:var(--bg-sa);border:none;cursor:pointer;position:relative;transition:background .2s}
.ptg.on{background:var(--acc)}
.ptg::after{content:"";position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:white;transition:transform .2s}
.ptg.on::after{transform:translateX(18px)}
.pm-f{padding:12px 20px;border-top:1px solid var(--brd);display:flex;justify-content:flex-end}
`;

// ─── Sub-components ──────────────────────────────────────────────────────────

function JiraPopup({ ticket, onClose }) {
  const d = { key: ticket, summary: `Implementation task for ${ticket}`, status: "In Progress", priority: "High", assignee: "Ryan Hargrove", reporter: "Sofia Reyes", type: "Story", sprint: "Sprint 24", description: "This ticket tracks the implementation and testing of the related feature. Acceptance criteria defined in the linked Confluence page." };
  return (
    <div className="jp-ov" onClick={onClose}>
      <div className="jp" onClick={e=>e.stopPropagation()}>
        <div className="jp-h"><h3>{ticket}</h3><button className="ib" onClick={onClose}><I.X/></button></div>
        <div className="jp-b">
          <div className="jf"><div className="jf-l">Summary</div><div className="jf-v">{d.summary}</div></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div className="jf"><div className="jf-l">Status</div><div className="jf-v"><span className="bp" style={{background:"var(--acc-d)",color:"var(--acc)"}}>{d.status}</span></div></div>
            <div className="jf"><div className="jf-l">Priority</div><div className="jf-v"><span className="bp" style={{background:"var(--org-d)",color:"var(--org)"}}>{d.priority}</span></div></div>
            <div className="jf"><div className="jf-l">Type</div><div className="jf-v">{d.type}</div></div>
            <div className="jf"><div className="jf-l">Sprint</div><div className="jf-v">{d.sprint}</div></div>
            <div className="jf"><div className="jf-l">Assignee</div><div className="jf-v">{d.assignee}</div></div>
            <div className="jf"><div className="jf-l">Reporter</div><div className="jf-v">{d.reporter}</div></div>
          </div>
          <div className="jf"><div className="jf-l">Description</div><div className="jf-v">{d.description}</div></div>
        </div>
      </div>
    </div>
  );
}

function DescWithJira({ text, onJira }) {
  if (!text) return null;
  const re = /\b([A-Z]{2,10}-\d{1,6})\b/g;
  const parts = []; let last = 0, m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const t = m[1]; parts.push(<span key={m.index} className="jl" onClick={()=>onJira(t)}>{t}</span>);
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

function FileTree({ files, onJump, activeFile }) {
  const tree = {};
  files.forEach(f => {
    const p = f.path.split("/"); let n = tree;
    p.forEach((s,i) => { if (i === p.length-1) n[s] = f; else { if (!n[s]) n[s] = {}; n = n[s]; }});
  });
  const renderNode = (node, key, depth=0) => {
    if (node.path) {
      const name = node.path.split("/").pop();
      return (
        <div key={node.path} className={`ftfl${activeFile === node.path ? " sel" : ""}`} style={{paddingLeft:12+depth*14}} onClick={()=>onJump(node.path)}>
          <I.File/><span style={{flex:1}}>{name}</span>
          <span className="ftfl-s"><span className="a">+{node.additions}</span><span className="d">-{node.deletions}</span></span>
        </div>
      );
    }
    return (
      <div key={key} className="fts">
        <div className="ftf" style={{paddingLeft:8+depth*14}}><I.Folder/>{key}</div>
        {Object.entries(node).map(([k,v])=>renderNode(v,k,depth+1))}
      </div>
    );
  };
  return <>{Object.entries(tree).map(([k,v])=>renderNode(v,k))}</>;
}

function UnifiedDiffView({ mr, onJiraClick }) {
  const scrollRef = useRef(null);
  const fileRefs = useRef({});
  const [collapsedFiles, setCollapsedFiles] = useState({});
  const [fileTreeOpen, setFileTreeOpen] = useState(true);
  const [activeFile, setActiveFile] = useState(mr.files[0]?.path || "");

  const toggleFile = (path) => setCollapsedFiles(prev => ({...prev, [path]: !prev[path]}));

  const jumpToFile = useCallback((path) => {
    const el = fileRefs.current[path];
    if (el && scrollRef.current) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveFile(path);
    }
  }, []);

  // track which file header is at the top while scrolling
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const onScroll = () => {
      const containerTop = container.getBoundingClientRect().top;
      let closest = mr.files[0]?.path;
      for (const f of mr.files) {
        const el = fileRefs.current[f.path];
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= containerTop + 10) closest = f.path;
        }
      }
      if (closest && closest !== activeFile) setActiveFile(closest);
    };
    container.addEventListener("scroll", onScroll, { passive: true });
    return () => container.removeEventListener("scroll", onScroll);
  }, [mr.files, activeFile]);

  return (
    <div className="dl">
      <div className={`ftr${fileTreeOpen ? "" : " collapsed"}`}>
        <button className="ftr-toggle" onClick={()=>setFileTreeOpen(false)} title="Collapse file tree">
          <I.ChevLeft/> <span>Files ({mr.files.length})</span>
        </button>
        <FileTree files={mr.files} onJump={jumpToFile} activeFile={activeFile}/>
      </div>
      {!fileTreeOpen && (
        <button
          onClick={()=>setFileTreeOpen(true)}
          title="Show file tree"
          style={{background:"var(--bg-s)",border:"none",borderRight:"1px solid var(--brd)",padding:"8px 6px",cursor:"pointer",color:"var(--tm)",display:"flex",alignItems:"flex-start",paddingTop:12}}
        >
          <I.ChevRight/>
        </button>
      )}
      <div className="da" ref={scrollRef}>
        {mr.files.map(file => {
          const lines = generateMockDiff(file);
          const fileDiscussions = mr.discussions.filter(d => d.file === file.path);
          const isCollapsed = collapsedFiles[file.path];
          return (
            <div key={file.path} className="df-sec" ref={el => fileRefs.current[file.path] = el}>
              <div className="df-hdr" onClick={()=>toggleFile(file.path)}>
                <span className={`collapse-icon${isCollapsed ? "" : " open"}`}><I.ChevRight/></span>
                <I.File/>{file.path}
                <span className="df-stats"><span className="a">+{file.additions}</span><span className="d">-{file.deletions}</span></span>
              </div>
              {!isCollapsed && (
                <div className="df-lines">
                  {lines.map((line, i) => (
                    <div key={i}>
                      <div className={`dfl ${line.type === "addition" ? "add" : line.type === "deletion" ? "del" : "ctx"}`}>
                        <span className="dfl-n">{line.num}</span>
                        <span className="dfl-c">{line.content}</span>
                        <span className="dfl-cmt-btn" title="Add comment"><I.Plus/></span>
                      </div>
                      {fileDiscussions.filter(d => d.line === line.num).map(d => (
                        <div key={d.id} className="ict">
                          {d.notes.map(note => (
                            <div key={note.id} className="ic">
                              <div className="ic-h">
                                <span className="cav">{note.author.avatar}</span>
                                <span className="c-author"><a href={`https://gitlab.com/${note.author.username}`} target="_blank" rel="noreferrer">{note.author.name}</a></span>
                                <span className="c-time">{timeAgo(note.createdAt)}</span>
                                {d.resolved && d.notes.indexOf(note)===0 && <span className="c-res">Resolved</span>}
                              </div>
                              <div className="ic-body">{note.body}</div>
                            </div>
                          ))}
                          <div className="ic-reply"><input placeholder="Reply..."/><button>Reply</button></div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PipelineView({ mr }) {
  const [sel, setSel] = useState(0);
  const stages = [
    { name:"build", status: mr.pipeline.status==="failed"?"failed":"success", dur:"2m 14s" },
    { name:"test", status: mr.pipeline.status==="failed"?"failed":"success", dur:"4m 32s" },
    { name:"lint", status:"success", dur:"0m 48s" },
    { name:"security", status: mr.pipeline.status==="running"?"running":"success", dur: mr.pipeline.status==="running"?"running...":"1m 15s" },
    { name:"deploy", status: mr.pipeline.status==="running"?"pending":mr.pipeline.status==="failed"?"skipped":"success", dur: mr.pipeline.status==="success"?"3m 02s":"-" },
  ];
  const logLines = [
    {text:"$ docker build -t registry/app:latest .",type:""},{text:"Step 1/12 : FROM node:20-alpine",type:""},{text:" ---> Using cache",type:""},{text:"Step 2/12 : WORKDIR /app",type:""},{text:" ---> Using cache",type:""},{text:"Step 3/12 : COPY package*.json ./",type:""},{text:"Step 4/12 : RUN npm ci --production",type:""},{text:"added 847 packages in 12.4s",type:"s"},
    ...(stages[sel]?.status==="failed"?[{text:"ERROR: test suite failed — 3 assertions failed",type:"e"},{text:"  FAIL src/gateway/batch_test.rs::test_large_file",type:"e"},{text:"  Expected: 200, Got: 408 (Request Timeout)",type:"e"}]:[{text:"All checks passed",type:"s"},{text:`Job succeeded in ${stages[sel]?.dur||"1m"}`,type:"s"}]),
  ];
  return (
    <div className="pv">
      <div className="pv-h"><I.Pipeline/><span style={{fontSize:14,fontWeight:600}}>Pipeline</span><span className="pv-id">#{mr.pipeline.id}</span><span className="sd" style={{background:pipelineColor(mr.pipeline.status),marginLeft:4}}/><span style={{fontSize:12,color:"var(--t2)"}}>{pipelineLabel(mr.pipeline.status)}</span></div>
      <div className="pv-stages">
        {stages.map((s,i)=>(
          <div key={s.name} style={{display:"flex",alignItems:"center"}}>
            {i>0&&<div className="pv-con"/>}
            <div className={`pv-stage${sel===i?" sel":""}`} onClick={()=>setSel(i)}>
              <div className="pv-sn">{s.name}</div>
              <div className="pv-ss"><span className="sd" style={{background:pipelineColor(s.status)}}/>{s.dur}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="pv-log">
        <div className="pv-lh"><span className="sd" style={{background:pipelineColor(stages[sel].status)}}/>{stages[sel].name}<span style={{fontSize:11,color:"var(--tm)",marginLeft:"auto"}}>{stages[sel].dur}</span></div>
        <div className="pv-lb">{logLines.map((l,i)=>(<div key={i} className="ll"><span className="ll-n">{i+1}</span><span className={`ll-t ${l.type}`}>{l.text}</span></div>))}</div>
      </div>
    </div>
  );
}

function CommitsView({ mr }) {
  return (
    <div className="cl">
      {mr.commits.map(c=>(
        <div key={c.sha} className="ci">
          <a className="c-sha" href={`${mr.repoUrl}/-/commit/${c.sha}`} target="_blank" rel="noreferrer">{c.sha.slice(0,8)}</a>
          <div><div className="c-msg">{c.title}</div><div className="c-meta"><a href={`https://gitlab.com/${c.author.username}`} target="_blank" rel="noreferrer">{c.author.name}</a> · {timeAgo(c.date)}</div></div>
        </div>
      ))}
    </div>
  );
}

function DiscussionsView({ mr }) {
  return (
    <div className="dv">
      {mr.discussions.length===0&&<div style={{padding:30,textAlign:"center",color:"var(--tm)"}}>No discussions yet</div>}
      {mr.discussions.map(d=>(
        <div key={d.id} className="dt">
          <div className="dt-loc">
            {d.file?(<><I.File/><span style={{fontFamily:"var(--mono)"}}>{d.file}</span>{d.line&&<span className="lr">:{d.line}</span>}</>):(<span className="gc-tag">General Comment</span>)}
            {d.resolved&&<span className="c-res" style={{marginLeft:"auto"}}>Resolved</span>}
          </div>
          {d.notes.map(note=>(
            <div key={note.id} className="ic">
              <div className="ic-h"><span className="cav">{note.author.avatar}</span><span className="c-author"><a href={`https://gitlab.com/${note.author.username}`} target="_blank" rel="noreferrer">{note.author.name}</a></span><span className="c-time">{timeAgo(note.createdAt)}</span></div>
              <div className="ic-body">{note.body}</div>
            </div>
          ))}
          <div className="ic-reply"><input placeholder="Reply to thread..."/><button>Reply</button></div>
        </div>
      ))}
      <div className="mr-ci" style={{border:"1px solid var(--brd)",borderRadius:"var(--r)",marginTop:8,padding:10}}>
        <input placeholder="Add a general comment on this MR..."/>
        <button className="btn" style={{padding:"6px 14px"}}>Comment</button>
      </div>
    </div>
  );
}

function HistoryView({ mr }) {
  const events = [...(mr.history||[])].sort((a,b) => new Date(b.date) - new Date(a.date));
  const iconForType = (t) => {
    switch(t) {
      case "opened": return "ev-opened";
      case "approved": return "ev-approved";
      case "comment": case "resolved": return "ev-comment";
      case "commit": return "ev-commit";
      case "pipeline": return "ev-pipeline";
      default: return "";
    }
  };
  return (
    <div className="hv">
      <div className="h-timeline">
        {events.map((ev,i)=>(
          <div key={i} className={`h-ev ${iconForType(ev.type)}`}>
            <div className="h-detail">
              {ev.user ? (
                <><a href={`https://gitlab.com/${ev.user.username}`} target="_blank" rel="noreferrer">{ev.user.name}</a> {ev.detail}</>
              ) : (
                <span>{ev.detail}</span>
              )}
            </div>
            <div className="h-meta">{timeAgo(ev.date)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main App ───────────────────────────────────────────────────────────────
export default function ShipyardApp() {
  const [selectedMR, setSelectedMR] = useState(null);
  const [filter, setFilter] = useState("all");
  const [sortBy, setSortBy] = useState("age");
  const [sortAsc, setSortAsc] = useState(true);
  const [overviewOpen, setOverviewOpen] = useState(true);
  const [activeTab, setActiveTab] = useState("changes");
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);
  const [showPrefs, setShowPrefs] = useState(false);
  const [jiraPopup, setJiraPopup] = useState(null);
  const [toast, setToast] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [prefs, setPrefs] = useState({ orangeHours:10, redHours:20, soundEnabled:true, toastEnabled:true, newMRNotif:true, assignedNotif:true, readyNotif:true });

  const notifications = [
    { title:"New MR: service-mesh: WIP: gRPC service mesh prototype", time:"2h ago" },
    { title:"payments-gateway: Fix payment reconciliation… is ready to merge", time:"3h ago" },
    { title:"MR assigned to you: api-gateway: Implement rate limiting…", time:"5h ago" },
  ];

  useEffect(()=>{
    const t = setTimeout(()=>{ setToast({title:"New MR Opened",message:"service-mesh: WIP: gRPC service mesh prototype"}); setTimeout(()=>setToast(null),4000); },2000);
    return ()=>clearTimeout(t);
  },[]);

  const filtered = MOCK_MRS.filter(mr => {
    if (filter==="mine") return mr.assignee.username===CURRENT_USER.username;
    if (filter==="review") return mr.assignee.username!==CURRENT_USER.username;
    return true;
  }).sort((a,b) => {
    if (sortBy==="age") { const d = new Date(a.createdAt)-new Date(b.createdAt); return sortAsc?d:-d; }
    const d = a.repo.localeCompare(b.repo); return sortAsc?d:-d;
  });

  const selectMR = (mr) => { setSelectedMR(mr); setActiveTab("changes"); setOverviewOpen(true); };

  return (
    <>
      <style>{CSS}</style>
      <div className="sy">
        {/* Top Bar */}
        <div className="tb">
          <div className="tb-l">
            <span className="tb-logo"><I.Anchor/></span>
            <span className="tb-title">Shipyard</span>
          </div>
          <div className="tb-r">
            <button className="ib" onClick={()=>{setShowNotifs(!showNotifs);setShowUserMenu(false)}}><I.Bell/><span className="bdg"/></button>
            <button className="ib" onClick={()=>{setShowUserMenu(!showUserMenu);setShowNotifs(false)}}><I.User/></button>
          </div>
          {showNotifs&&<div className="np"><div className="np-h">Notifications</div>{notifications.map((n,i)=>(<div key={i} className="np-i"><div className="np-it">{n.title}</div><div className="np-tm">{n.time}</div></div>))}</div>}
          {showUserMenu&&<div className="um"><div className="um-h"><div className="um-n">{CURRENT_USER.name}</div><div className="um-u">@{CURRENT_USER.username}</div></div><button className="um-i" onClick={()=>{setShowPrefs(true);setShowUserMenu(false)}}><I.Settings/> Preferences</button><button className="um-i"><I.LogOut/> Sign Out</button></div>}
        </div>

        <div className="ml" style={{position:"relative"}}>
          {/* Sidebar toggle */}
          <button className={`sb-toggle${sidebarOpen?" open":""}`} onClick={()=>setSidebarOpen(!sidebarOpen)} title={sidebarOpen?"Collapse MR list":"Expand MR list"}>
            {sidebarOpen?<I.ChevLeft/>:<I.ChevRight/>}
          </button>

          {/* Sidebar */}
          <div className={`sb${sidebarOpen?"":" collapsed"}`}>
            <div className="sb-h">
              <div className="ft">
                {[{key:"mine",label:"Mine"},{key:"review",label:"To Review"},{key:"all",label:"All Open"}].map(f=>(
                  <button key={f.key} className={`ft-b${filter===f.key?" a":""}`} onClick={()=>setFilter(f.key)}>{f.label}</button>
                ))}
              </div>
              <div className="sr">
                <span className="sr-l">{filtered.length} merge requests</span>
                <button className={`sr-b${sortAsc?" asc":""}`} onClick={()=>{if(sortBy==="age"){if(!sortAsc)setSortBy("repo");setSortAsc(!sortAsc)}else{if(!sortAsc)setSortBy("age");setSortAsc(!sortAsc)}}}>
                  {sortBy==="age"?"Age":"Repo"} <I.Sort/>
                </button>
              </div>
            </div>
            <div className="mrl">
              {filtered.map(mr=>(
                <div key={mr.id} className={`mc${selectedMR?.id===mr.id?" sel":""}`} style={{background:selectedMR?.id===mr.id?undefined:cardBg(mr.createdAt,prefs)}} onClick={()=>selectMR(mr)}>
                  <div className="mc-t"><span className="mc-r">{mr.repo}</span>: {mr.title}</div>
                  {mr.draft&&<div className="mc-dft">Draft</div>}
                  {mr.mergeable&&!mr.draft&&<div className="mc-rdy">✓ Ready to merge</div>}
                  <div className="mc-m">
                    <a href={`https://gitlab.com/${mr.assignee.username}`} target="_blank" rel="noreferrer">@{mr.assignee.username}</a>
                    <span>{timeAgo(mr.createdAt)}</span>
                    <span className={`sd${mr.pipeline.status==="running"?" pu":""}`} style={{background:pipelineColor(mr.pipeline.status)}} title={`Pipeline: ${mr.pipeline.status}`}/>
                    <span className="ai"><span className="sd" style={{background:mr.approvals.given>=mr.approvals.required?"#34d399":"#f87171"}}/><span>{mr.approvals.given}/{mr.approvals.required}</span></span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Main content */}
          <div className="mco">
            {!selectedMR?(
              <div className="es"><I.Anchor/><div className="es-t">Select a merge request to get started</div></div>
            ):(
              <>
                {/* Overview */}
                <div className={`ov ${overviewOpen?"e":"c"}`}>
                  <div className={`ov-tg${overviewOpen?" e":""}`} onClick={()=>setOverviewOpen(!overviewOpen)}>
                    <h2><I.GitMerge/>!{selectedMR.iid} · {selectedMR.repo}</h2><I.ChevDown/>
                  </div>
                  {overviewOpen&&(
                    <div className="ov-b">
                      <div className="ov-title">{selectedMR.title}</div>
                      <div className="ov-br"><span>{selectedMR.sourceBranch}</span> → <span>{selectedMR.targetBranch}</span></div>
                      <div className="ov-desc"><DescWithJira text={selectedMR.description} onJira={setJiraPopup}/></div>
                      <div className="ov-bdg">
                        {selectedMR.labels.map(l=>(<span key={l} className="bp" style={{background:"var(--bg-sa)",color:"var(--t2)"}}>{l}</span>))}
                        {selectedMR.draft&&<span className="bp" style={{background:"var(--yel-d)",color:"var(--yel)"}}>Draft</span>}
                        {selectedMR.conflicts&&<span className="bp" style={{background:"var(--red-d)",color:"var(--red)"}}>Conflicts</span>}
                      </div>
                      <div className="ov-st">
                        <div><span className="sd" style={{background:pipelineColor(selectedMR.pipeline.status)}}/> Pipeline {pipelineLabel(selectedMR.pipeline.status)}</div>
                        <div>Approvals: {selectedMR.approvals.given}/{selectedMR.approvals.required}{selectedMR.approvals.given>=selectedMR.approvals.required?<span style={{color:"var(--grn)"}}><I.Check/></span>:<span style={{color:"var(--red)"}}><I.X/></span>}</div>
                        <div>{selectedMR.changesCount} files changed</div>
                        <div>Opened by <a href={`https://gitlab.com/${selectedMR.author.username}`} target="_blank" rel="noreferrer" style={{color:"var(--acc)",textDecoration:"none"}}>@{selectedMR.author.username}</a></div>
                      </div>
                      <div className="ov-act">
                        <button className="btn btn-a"><I.Check/> Approve</button>
                        <button className="btn btn-d"><I.X/> Request Changes</button>
                        <button className="btn btn-p" disabled={!selectedMR.mergeable}><I.GitMerge/> {selectedMR.mergeable?"Merge":"Not Mergeable"}</button>
                        <a href={`${selectedMR.repoUrl}/-/merge_requests/${selectedMR.iid}`} target="_blank" rel="noreferrer" className="btn" style={{marginLeft:"auto"}}>Open in GitLab <I.ExtLink/></a>
                      </div>
                    </div>
                  )}
                </div>

                {/* Tabs */}
                <div className="ct">
                  {[
                    {key:"changes",label:"Changes",count:selectedMR.files.length},
                    {key:"commits",label:"Commits",count:selectedMR.commits.length},
                    {key:"discussions",label:"Discussions",count:selectedMR.discussions.length},
                    {key:"pipeline",label:"Pipeline"},
                    {key:"history",label:"History",count:selectedMR.history?.length},
                  ].map(t=>(
                    <button key={t.key} className={`ct-b${activeTab===t.key?" a":""}`} onClick={()=>setActiveTab(t.key)}>
                      {t.label}{t.count!==undefined&&<span className="tc">{t.count}</span>}
                    </button>
                  ))}
                </div>

                {activeTab==="changes"&&<UnifiedDiffView mr={selectedMR} onJiraClick={setJiraPopup}/>}
                {activeTab==="commits"&&<CommitsView mr={selectedMR}/>}
                {activeTab==="discussions"&&<DiscussionsView mr={selectedMR}/>}
                {activeTab==="pipeline"&&<PipelineView mr={selectedMR}/>}
                {activeTab==="history"&&<HistoryView mr={selectedMR}/>}
              </>
            )}
          </div>
        </div>

        {/* Modals */}
        {jiraPopup&&<JiraPopup ticket={jiraPopup} onClose={()=>setJiraPopup(null)}/>}
        {showPrefs&&(
          <div className="po" onClick={()=>setShowPrefs(false)}>
            <div className="pm" onClick={e=>e.stopPropagation()}>
              <div className="pm-h"><h3>Preferences</h3><button className="ib" onClick={()=>setShowPrefs(false)}><I.X/></button></div>
              <div className="pm-b">
                <div className="pg"><div className="pg-t">Notifications</div>
                  <div className="pr"><span className="pl">Sound effects</span><button className={`ptg${prefs.soundEnabled?" on":""}`} onClick={()=>setPrefs({...prefs,soundEnabled:!prefs.soundEnabled})}/></div>
                  <div className="pr"><span className="pl">Toast notifications</span><button className={`ptg${prefs.toastEnabled?" on":""}`} onClick={()=>setPrefs({...prefs,toastEnabled:!prefs.toastEnabled})}/></div>
                  <div className="pr"><span className="pl">New MR alerts</span><button className={`ptg${prefs.newMRNotif?" on":""}`} onClick={()=>setPrefs({...prefs,newMRNotif:!prefs.newMRNotif})}/></div>
                  <div className="pr"><span className="pl">Assigned to me alerts</span><button className={`ptg${prefs.assignedNotif?" on":""}`} onClick={()=>setPrefs({...prefs,assignedNotif:!prefs.assignedNotif})}/></div>
                  <div className="pr"><span className="pl">Ready to merge alerts</span><button className={`ptg${prefs.readyNotif?" on":""}`} onClick={()=>setPrefs({...prefs,readyNotif:!prefs.readyNotif})}/></div>
                </div>
                <div className="pg"><div className="pg-t">MR Age Thresholds (hours)</div>
                  <div className="pr"><span className="pl">Warning (orange)</span><input className="pi" type="number" value={prefs.orangeHours} onChange={e=>setPrefs({...prefs,orangeHours:Number(e.target.value)})}/></div>
                  <div className="pr"><span className="pl">Critical (red)</span><input className="pi" type="number" value={prefs.redHours} onChange={e=>setPrefs({...prefs,redHours:Number(e.target.value)})}/></div>
                </div>
              </div>
              <div className="pm-f"><button className="btn btn-p" onClick={()=>setShowPrefs(false)}>Save</button></div>
            </div>
          </div>
        )}

        {toast&&(
          <div className="toast">
            <div className="toast-i" style={{background:"var(--acc-d)"}}><I.Bell/></div>
            <div className="toast-b"><div className="toast-t">{toast.title}</div><div className="toast-m">{toast.message}</div></div>
          </div>
        )}
      </div>
    </>
  );
}
