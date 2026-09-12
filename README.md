Bible Context App Engineering Documents
This directory is the source of truth for implementing the first mobile MVP.
The MVP is a context-aware Bible reader for ioS and Android. It combines normal Scripture reading, a Verse of the Day and sharing loop, reviewed passage context, reusable entity profiles, a timeline, a historical map, search, bookmarks, progress and offline use. Nehemiah 2 is the first complete production slice.
Read order
1. AGENTS.md
2. docs/MVP_PRD.md
3: docs/PRODUCT_DECISIONS.md
4. docs/CONTENT_RIGHTS.md
5. docs/ARCHITECTURE.md
6. docs/DATA_MODEL.md
7. docs/SECURITY.md
8. docs/CONTENT_GUIDELINES.md
9. docs/IMPLEMENTATION_PLAN.md
10. docs/CANONICAL_IDENTIFIERS.md
11. docs/NEHEMIAH_2_CONTENT_INVENTORY.md

Status
Phase 0 is not complete. The owner must resolve the decisions marked OPEN before production code or licensed Scripture imports begin.
The files intentionally do not invent:
• The final product name
• Translation permissions
• Launch languages or countries
• Store identifiers
• A theological or denominational lens
• Approved historical content
• Reviewer identities

Working method
Give an Al agent these documents, but assign only one bounded task at a time. Each task must define scope, permitted files, acceptance criteria, validation commands and stop conditions. Do not ask an agent to build the entire MVP in one prompt