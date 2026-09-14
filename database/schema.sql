CREATE TABLE IF NOT EXISTS users (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS discord_accounts (user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, discord_id TEXT NOT NULL UNIQUE, username TEXT NOT NULL, global_name TEXT, avatar_url TEXT, connected_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS profiles (user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, display_name TEXT, bio TEXT NOT NULL DEFAULT '', banner_url TEXT, avatar_url TEXT, level INTEGER NOT NULL DEFAULT 1 CHECK(level>0), experience BIGINT NOT NULL DEFAULT 0 CHECK(experience>=0), premium_until TIMESTAMPTZ, settings JSONB NOT NULL DEFAULT '{}'::jsonb, selected_title_id UUID);
CREATE TABLE IF NOT EXISTS point_transactions (id BIGSERIAL PRIMARY KEY, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, amount BIGINT NOT NULL, reason TEXT NOT NULL, actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS point_transactions_user_idx ON point_transactions(user_id,created_at DESC);
CREATE TABLE IF NOT EXISTS catalog_items (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), type TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', price BIGINT NOT NULL DEFAULT 0 CHECK(price>=0), metadata JSONB NOT NULL DEFAULT '{}'::jsonb, active BOOLEAN NOT NULL DEFAULT true, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS inventory_items (user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, item_id UUID NOT NULL REFERENCES catalog_items(id) ON DELETE CASCADE, quantity INTEGER NOT NULL DEFAULT 1 CHECK(quantity>0), acquired_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY(user_id,item_id));
CREATE TABLE IF NOT EXISTS purchases (id BIGSERIAL PRIMARY KEY, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, item_id UUID NOT NULL REFERENCES catalog_items(id) ON DELETE RESTRICT, price BIGINT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS user_roles (user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, role TEXT NOT NULL, granted_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY(user_id,role));
CREATE INDEX IF NOT EXISTS user_roles_role_idx ON user_roles(role);
CREATE TABLE IF NOT EXISTS redeem_codes (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), code TEXT NOT NULL UNIQUE, rewards JSONB NOT NULL DEFAULT '[]'::jsonb, max_uses INTEGER, uses INTEGER NOT NULL DEFAULT 0, per_user_limit INTEGER NOT NULL DEFAULT 1, expires_at TIMESTAMPTZ, active BOOLEAN NOT NULL DEFAULT true, created_by UUID REFERENCES users(id) ON DELETE SET NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS code_redemptions (code_id UUID NOT NULL REFERENCES redeem_codes(id) ON DELETE CASCADE, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, redeemed_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY(code_id,user_id));
CREATE TABLE IF NOT EXISTS friendships (user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, other_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, status TEXT NOT NULL CHECK(status IN('pending','accepted','blocked')), created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY(user_id,other_user_id));
CREATE INDEX IF NOT EXISTS friendships_other_idx ON friendships(other_user_id,status);
CREATE TABLE IF NOT EXISTS groups (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', settings JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS group_members (group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, role TEXT NOT NULL DEFAULT 'member', joined_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY(group_id,user_id));
CREATE TABLE IF NOT EXISTS notifications (id BIGSERIAL PRIMARY KEY, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, type TEXT NOT NULL, payload JSONB NOT NULL DEFAULT '{}'::jsonb, read_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications(user_id,created_at DESC);
CREATE TABLE IF NOT EXISTS conversations (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), kind TEXT NOT NULL CHECK(kind IN('direct','group')), title TEXT, created_by UUID REFERENCES users(id) ON DELETE SET NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS conversation_members (conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, role TEXT NOT NULL DEFAULT 'member', joined_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY(conversation_id,user_id));
CREATE TABLE IF NOT EXISTS messages (id BIGSERIAL PRIMARY KEY, conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE, sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, content TEXT NOT NULL CHECK(length(content) BETWEEN 1 AND 4000), created_at TIMESTAMPTZ NOT NULL DEFAULT now(), edited_at TIMESTAMPTZ);
CREATE INDEX IF NOT EXISTS messages_conversation_idx ON messages(conversation_id,id DESC);
CREATE TABLE IF NOT EXISTS blocks (user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, blocked_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY(user_id,blocked_user_id), CHECK(user_id<>blocked_user_id));
CREATE TABLE IF NOT EXISTS audit_logs (id BIGSERIAL PRIMARY KEY, actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL, action TEXT NOT NULL, target_user_id UUID REFERENCES users(id) ON DELETE SET NULL, payload JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS audit_logs_created_idx ON audit_logs(created_at DESC);

INSERT INTO catalog_items(type,slug,name,description,price,metadata) VALUES
('title','title-founder','مؤسس LEGACY','لقب حصري للمؤسس',0,'{"exclusive":true,"color":"gold"}'),
('title','title-developer','المطور','لقب مطوري LEGACY',0,'{"exclusive":true,"color":"cyan"}'),
('title','title-legend','الأسطورة','لقب أسطوري',25000,'{"rarity":"legendary"}'),
('title','title-elite','النخبة','لقب للنخبة',15000,'{"rarity":"epic"}'),
('title','title-veteran','المخضرم','لقب للمستخدمين المميزين',8000,'{"rarity":"rare"}'),
('title','title-creator','صانع LEGACY','لقب لصنّاع المحتوى',12000,'{"rarity":"epic"}'),
('badge','badge-developer','المطور','شارة مطور LEGACY',0,'{"exclusive":true,"icon":"🛠️"}'),
('badge','badge-founder','المؤسس','شارة مؤسس LEGACY',0,'{"exclusive":true,"icon":"👑"}'),
('badge','badge-early','عضو مبكر','شارة للأعضاء الأوائل',0,'{"exclusive":true,"icon":"🌟"}'),
('badge','badge-premium','Premium','شارة العضوية المميزة',0,'{"premium":true,"icon":"💎"}')
ON CONFLICT(slug) DO NOTHING;
