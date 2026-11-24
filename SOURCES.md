# Official references and verification notes

Reviewed 23 November 2026. These sources support technical choices and requirements; they are not evidence that Kazi is implemented. Use current stable documentation for the exact versions selected at setup. This pack contains original project requirements, not copied provider guides.

- Next.js authentication and server authorization: https://nextjs.org/docs/app/guides/authentication
- Next.js route handlers: https://nextjs.org/docs/app/getting-started/route-handlers
- Better Auth phone-number capability: https://better-auth.com/docs/plugins/phone-number
- Better Auth two-factor capability: https://better-auth.com/docs/plugins/2fa
- Prisma transaction concepts: https://www.prisma.io/docs/orm/fundamentals/transactions
- W3C text contrast guidance: https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
- W3C target size guidance: https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum
- WCAG 2.2: https://www.w3.org/TR/WCAG22/

Provider APIs, auth-generated tables and ORM transaction APIs can change. Verify compatibility rather than copying snippets across major versions. Phone-number sign-in capability does not establish SMS deliverability in Gabon; test the actual selected vendor. This document does not give Gabon legal, tax or labor-law advice or assert legal approval. Obtain the relevant owner/professional decisions before live operations.
