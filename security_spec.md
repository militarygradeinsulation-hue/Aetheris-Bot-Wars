# ForgeClash Security Rules Architecture & Threat Model

## Data Invariants
1. **PII Isolation**: User email addresses and private progression inventories live strictly inside `/users/{userId}/private/account` and are readable/writable only by `request.auth.uid == userId` or verified admin (`militarygradeinsulation@gmail.com`). Public `/pilots/{pilotId}` documents NEVER store emails.
2. **Email Verification Mandate**: All standard client writes require `request.auth != null && request.auth.token.email != null && request.auth.token.email_verified == true`.
3. **Immutable Ownership & Timestamps**: `uid`, `requesterId`, `leaderId`, `senderId`, and `createdAt` cannot be forged or altered post-creation; timestamps must equal `request.time`.
4. **Master Gate for Clan Comms**: `/clans/{clanId}/messages/{msgId}` checks `exists(/databases/$(database)/documents/clans/$(clanId)/members/$(request.auth.uid))`.
5. **Bounded Arrays & Strict Keys**: Every create enforces `hasAll` + `hasOnly`, and every update uses action-specific `affectedKeys().hasOnly(...)` and bounded list sizes (`<= 6` for team members, `<= 120` for owned parts/arenas).
6. **Secure List Queries**: No blanket `allow list: if isSignedIn();` rules; `connections` list requires `request.auth.uid in resource.data.users`, and public directory lists validate `resource.data.isPublic == true`.

## Dirty Dozen Adversarial Payloads (Must Return PERMISSION_DENIED)
1. **Unauthenticated read of private account**: `GET /users/userA/private/account` with `auth = null`.
2. **Cross-user PII peek**: `GET /users/userA/private/account` signed in as `userB`.
3. **Privilege escalation on account creation**: `CREATE /users/userA/private/account` by `userA` with `{ ..., isAdmin: true }`.
4. **Shadow/Ghost field injection on pilot update**: `UPDATE /pilots/userA` with `{ level: 5, shadowBypass: true }`.
5. **Identity spoofing on pilot creation**: `CREATE /pilots/userB` signed in as `userA` with `uid: "userB"`.
6. **Unverified email spoofing as admin**: `READ /users/userA/private/account` with `email: "militarygradeinsulation@gmail.com", email_verified: false`.
7. **ID poisoning attack**: `CREATE /pilots/${'x'.repeat(300)}` or path with invalid characters (`../bad`).
8. **Connection forgery**: `CREATE /connections/a_b` by `userC` attempting to link `userA` and `userB`.
9. **Terminal status tampering on connection**: `UPDATE /connections/a_b` by `requesterId` trying to self-accept `status: "pending" -> "accepted"`.
10. **Blanket username directory scrape**: `LIST /usernames` attempting to dump all reserved usernames.
11. **Non-member clan chat injection**: `CREATE /clans/clan_aether/messages/m1` by a user not present in `/clans/clan_aether/members/{uid}`.
12. **Client-forged timestamp**: `CREATE /teams/team1` with client-supplied `createdAt` not matching `request.time`.
