# AcademiAI agent sync

Local `dev` commits (push via git CLI may need credentials):

1. `f3c1ccf` feat(foundation): Phase 1-2 monorepo, models, auth, academics CRUD
2. `23f07db` feat(api-ai-rag): chat, quizzes, notes, hybrid RAG, ingestion pipeline
3. `b61cd76` feat(security-ops): RLS policies, async summary, chat UI, isolation tests
4. `1dc66a4` feat(jobs-ui): job status API, resources and quizzes pages, seed_demo

Repo: KhalifahMB/Final-year-Project-AcademiAI
Branch: dev

To pull full tree from agent workspace path `/home/workdir/artifacts/academiai` or re-push with a PAT:

```bash
git remote add origin https://github.com/KhalifahMB/Final-year-Project-AcademiAI.git
git push -u origin dev
```
