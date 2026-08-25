# Testing Strategy

## Levels

1. Unit tests
2. API/integration tests
3. Database/RLS tests
4. RAG evaluation
5. Security tests
6. Frontend component tests
7. End-to-end tests
8. Performance tests

## CRUD testing

Every CRUD resource must test:
- create
- list
- retrieve
- update
- partial update
- delete
- validation
- authorization
- tenant isolation

## RLS testing

Use separate tenants and users.

Expected:
- A → A allowed
- A → B denied
- B → B allowed
- B → A denied

Also test direct object-ID access and manipulated tenant context.

## RAG evaluation

Compare:
- dense retrieval
- hybrid dense + lexical
- hybrid + concept graph

Metrics:
- Precision@K
- Recall@K
- MRR
- source/citation correctness
- answer faithfulness

## Email tests

Use a local/test email backend during development. Test:
- verification delivery
- expiration
- wrong code
- resend
- password reset
- token reuse
- password-change notification

## Performance

Measure representative concurrency levels and report:
- latency
- throughput
- error rate
- resource usage

Do not present target thresholds as measured results until tests are executed.
