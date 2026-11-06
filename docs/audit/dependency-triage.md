# AI-Assisted Self-Assessment

## Dependency gate — FAIL

On 2026-11-05 the npm advisory service returned exit 1 for
`npm audit --omit=dev --registry=https://registry.npmjs.org --fetch-retries=0 --fetch-timeout=20000`
against the generated lockfile in a Windows staging directory. The result was
15 dependency findings, comprising 10 high and 5 moderate. These are advisory
counts. Application exploitability requires separate triage.

| Dependency | Review surface |
| --- | --- |
| Hono and its Node adapter | Framework HTTP parsing and middleware. The app defines JSON GET routes and a static HTML template. Framework-level routes and middleware require separate review. |
| Drizzle and Kysely | SQL construction and identifier escaping. Snapshot query uses a fixed CTE name and typed query parameters. Review Ponder schema configuration and internal database paths. |
| GraphQL Yoga and GraphQL Tools | The application registers no GraphQL route. Confirm packaged server route exposure before relying on this boundary. |
| viem/ws | Runtime RPC transport. Test configuration uses loopback HTTP. Review WebSocket use before enabling it. |
| esbuild, Vite, glob and minimatch | Toolchain and file discovery. Keep development interfaces local and review framework upgrade compatibility. |

The automated forced-fix proposal includes downgrading Ponder to 0.0.1.
Resolve transitive findings through a compatible framework upgrade or verified
narrow overrides, then repeat the audit, build, and reorganization tests.
Public deployment remains blocked. This record covers dependency screening
and preliminary reachability review. External audit and executable exploit
PoCs have not been performed.
