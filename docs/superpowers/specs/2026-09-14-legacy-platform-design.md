# LEGACY Platform Design

## 1. Product direction

LEGACY is a shared social platform for Discord, the website, and a Discord Activity. All three clients use the same backend, account identity, database, economy, inventory, profile customization, social features, and administration system.

The primary Discord UX is intentionally minimal for normal users:

- A normal user types only `legacy`.
- The bot responds with the normal-user LEGACY dashboard.
- Profile, subscription, points, inventory, shop, leaderboard, friends/following, and account settings are reached through buttons/select menus from that dashboard.
- Normal users do not need separate Discord commands for each feature.

Administrators/owner also type `legacy`, but the bot detects their permissions and presents the complete administration dashboard. Administration is where the large set of controls lives.

## 2. Discord UX

### Normal user dashboard

The normal dashboard exposes only user-owned functions:

- Profile
- Subscription / Premium
- Points
- Inventory
- Shop
- Leaderboards
- Friends / following
- Notifications
- Account settings

All sensitive responses are private where appropriate, using interaction responses and permission checks so user data is not exposed in public channels.

### Administration dashboard

The administration dashboard is permission-gated and exposes controls for:

- User search and profile inspection
- Points: add, subtract, set, and transaction history
- Inventory: grant, remove, inspect ownership
- Premium/subscriptions: grant, revoke, inspect
- Catalog/shop management
- Frames, backgrounds, badges, effects, name styles, colors, and other cosmetics
- Codes and dynamic rewards
- Groups and permissions
- Platform settings
- Statistics and leaderboards
- Audit logs
- Dynamic content creation, editing, activation/deactivation, and deletion

The administration system is also primarily navigated through the `legacy` dashboard rather than requiring a separate command for every operation.

## 3. Shared backend

The backend is the single source of truth. Discord bot, website, and Activity never maintain separate copies of user state.

Core domains:

- auth
- users
- profiles
- economy
- inventory
- catalog/shop
- premium
- codes
- social/friends/following
- chat and private messaging
- groups
- leaderboards
- notifications
- administration/audit
- media/assets

## 4. Identity

Discord is the primary identity link for Discord-facing use. Website authentication uses Discord OAuth2 so the same Discord account maps to the same LEGACY user. The Activity uses the appropriate Discord identity/authentication flow and talks to the same backend.

The backend owns sessions/tokens and authorization. Discord bot credentials and backend secrets are never exposed to browser clients.

## 5. Data architecture

Use PostgreSQL as the primary database. Prefer a hosted PostgreSQL service such as Supabase for the initial deployment.

Important entities include:

- users
- discord_accounts
- profiles
- profile_customizations
- point_transactions
- inventories
- catalog_items
- purchases
- premium_subscriptions
- redeem_codes
- code_redemptions
- groups
- group_members
- friendships/follows
- conversations
- messages
- notifications
- admin_roles/permissions
- audit_logs
- media_assets

Economy changes use transaction records so administrative grants/deductions and user earnings are auditable instead of relying only on a mutable balance.

## 6. Dynamic catalog

Cosmetics and shop content are data-driven. Adding a frame, background, badge, effect, name style, bundle, or similar item should not require changing source code.

Each catalog item contains its type, display metadata, price/reward information, availability, and configuration needed by the clients.

## 7. Codes

Administrators create codes through the administration dashboard. Codes can contain one or multiple rewards, such as points, an exclusive cosmetic, and a Premium period.

Codes support:

- maximum total uses
- per-user redemption limits
- expiry
- enabled/disabled state
- multiple reward types
- redemption history
- administrative audit logging

## 8. Premium and media

Premium is an account entitlement shared by all clients. Premium can unlock additional customization/features while ordinary cosmetics may also be obtainable through points where configured.

Custom profile media such as banners is stored in object storage rather than in the database itself. The backend controls upload authorization, validation, and ownership.

## 9. Social system

The platform supports public profiles, friends/following, private conversations, groups, group roles/permissions, notifications, block/mute controls, and reporting/moderation controls.

Privacy is enforced server-side; hiding or blocking a user must not depend only on client UI.

## 10. Clients

### Discord bot

- Node.js
- discord.js
- Prefix command handling
- `legacy` as the main entry point
- Buttons, select menus, modals, embeds, and images for navigation
- Permission-aware dashboard routing

### Website

Responsive web client for desktop and mobile, backed by the same API and account system.

### Discord Activity

A social application rather than a game. It uses the same backend, account, profiles, economy, inventory, social graph, and chat system as the website and bot.

## 11. Suggested repository structure

```text
legacy/
├── apps/
│   ├── bot/
│   ├── web/
│   └── activity/
├── backend/
│   ├── auth/
│   ├── users/
│   ├── profiles/
│   ├── economy/
│   ├── inventory/
│   ├── shop/
│   ├── premium/
│   ├── codes/
│   ├── social/
│   ├── chat/
│   ├── groups/
│   ├── leaderboard/
│   ├── notifications/
│   └── admin/
├── database/
├── shared/
├── assets/
└── docs/
```

## 12. Initial implementation order

1. Repository foundation and shared configuration
2. PostgreSQL schema and backend core
3. Discord authentication and account linking
4. Discord bot `legacy` dashboard with normal/admin routing
5. Profile, points, inventory, and catalog/shop
6. Premium and media uploads
7. Codes and administration tools
8. Social/chat/groups/notifications
9. Website
10. Discord Activity
11. Integration, security, rate limits, moderation, and deployment

## 13. Explicit scope decision

The normal user experience must stay command-light. Do not create a separate Discord command for profile, points, inventory, subscription, shop, or similar personal features. These are pages/actions inside the `legacy` dashboard.

The large Discord control surface belongs to administration and is permission-gated.

## 14. Non-goals for the first implementation

- No separate command explosion for normal users.
- No independent databases for the three clients.
- No hardcoded catalog that requires source edits for every new cosmetic.
- No exposure of private user data in public dashboard messages.
- No claim that LEGACY cosmetic settings change a user's actual Discord profile; they are LEGACY profile customizations.
