require('dotenv').config({
  path: require('path').resolve(__dirname, '../../.env')
});
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { pool } = require('./db');
const { registerExtendedRoutes } = require('./extended-routes');
const app = express();
const port = Number(process.env.API_PORT || 4000);
const webUrl = process.env.WEB_URL || 'http://localhost:5173';
const activityUrl = process.env.ACTIVITY_URL || 'http://localhost:5174';
const adminIds = new Set((process.env.LEGACY_ADMIN_IDS || '').split(',').map(x=>x.trim()).filter(Boolean));
const discordClientId = String(process.env.DISCORD_CLIENT_ID || '').trim();
const discordClientSecret = String(process.env.DISCORD_CLIENT_SECRET || '').trim();
const discordRedirectUri = String(process.env.DISCORD_REDIRECT_URI || '').trim();
const discordActivityRedirectUri = String(process.env.DISCORD_ACTIVITY_REDIRECT_URI || discordRedirectUri).trim();
const jwtSecret = String(process.env.JWT_SECRET || '').trim();

function oauthMissing(activity=false){
  const missing=[];
  if(!discordClientId) missing.push('DISCORD_CLIENT_ID');
  if(!discordClientSecret) missing.push('DISCORD_CLIENT_SECRET');
  if(!discordRedirectUri) missing.push('DISCORD_REDIRECT_URI');
  if(activity && !discordActivityRedirectUri) missing.push('DISCORD_ACTIVITY_REDIRECT_URI');
  if(!jwtSecret) missing.push('JWT_SECRET');
  return [...new Set(missing)];
}

app.use(cors({origin:[webUrl,activityUrl],credentials:true}));
app.use(express.json({limit:'2mb'}));
function sign(user){
  if(!jwtSecret) throw new Error('JWT_SECRET غير مضبوط في .env');
  return jwt.sign({userId:user.id,discordId:user.discordId,admin:adminIds.has(user.discordId)},jwtSecret,{expiresIn:'7d'});
}
function auth(req,res,next){const v=req.headers.authorization||'';if(!v.startsWith('Bearer '))return res.status(401).json({error:'غير مصرح'});try{req.auth=jwt.verify(v.slice(7),jwtSecret);next();}catch{return res.status(401).json({error:'الجلسة منتهية'});}}
function admin(req,res,next){if(!req.auth?.admin)return res.status(403).json({error:'هذه الصفحة للإدارة فقط'});next();}
function internal(req,res,next){if(!process.env.LEGACY_INTERNAL_KEY||req.get('x-legacy-internal-key')!==process.env.LEGACY_INTERNAL_KEY)return res.status(401).json({error:'internal unauthorized'});next();}
app.get('/health',async(_req,res)=>{try{await pool.query('SELECT 1');res.json({ok:true,service:'legacy-api'});}catch{res.status(503).json({ok:false,service:'legacy-api'});}});

app.get('/auth/discord',(_req,res)=>{
  const missing=oauthMissing(false);
  if(missing.length)return res.status(500).send(`إعدادات Discord OAuth ناقصة في .env: ${missing.join(', ')}`);
  const p=new URLSearchParams({client_id:discordClientId,redirect_uri:discordRedirectUri,response_type:'code',scope:'identify'});
  return res.redirect(`https://discord.com/oauth2/authorize?${p.toString()}`);
});

async function exchangeDiscordCode(code,redirectUri){
  const missing=oauthMissing(false);
  if(missing.length)throw new Error(`Discord OAuth configuration missing: ${missing.join(', ')}`);
  if(!code)throw new Error('Missing Discord OAuth code');
  if(!redirectUri)throw new Error('Missing Discord OAuth redirect URI');
  const body=new URLSearchParams({client_id:discordClientId,client_secret:discordClientSecret,grant_type:'authorization_code',code,redirect_uri:redirectUri});
  const tr=await fetch('https://discord.com/api/v10/oauth2/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});
  if(!tr.ok){const details=await tr.text().catch(()=> '');throw new Error(`OAuth token exchange failed (${tr.status})${details?`: ${details}`:''}`);}
  const token=await tr.json();
  const mr=await fetch('https://discord.com/api/v10/users/@me',{headers:{Authorization:`Bearer ${token.access_token}`}});
  if(!mr.ok)throw new Error('Discord identity lookup failed');
  return await mr.json();
}

async function upsertDiscordUser(me){const c=await pool.connect();try{await c.query('BEGIN');const e=await c.query('SELECT user_id FROM discord_accounts WHERE discord_id=$1',[me.id]);let id;if(e.rowCount)id=e.rows[0].user_id;else{const x=await c.query('INSERT INTO users DEFAULT VALUES RETURNING id');id=x.rows[0].id;await c.query('INSERT INTO profiles(user_id,display_name,avatar_url) VALUES($1,$2,$3)',[id,me.global_name||me.username,me.avatar?`https://cdn.discordapp.com/avatars/${me.id}/${me.avatar}.png?size=256`:null]);}await c.query(`INSERT INTO discord_accounts(user_id,discord_id,username,global_name,avatar_url) VALUES($1,$2,$3,$4,$5) ON CONFLICT(discord_id) DO UPDATE SET username=EXCLUDED.username,global_name=EXCLUDED.global_name,avatar_url=EXCLUDED.avatar_url`,[id,me.id,me.username,me.global_name||null,me.avatar?`https://cdn.discordapp.com/avatars/${me.id}/${me.avatar}.png?size=256`:null]);await c.query('COMMIT');return{id,discordId:me.id};}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}

app.get('/auth/discord/callback',async(req,res)=>{if(!req.query.code)return res.status(400).send('Missing OAuth code');try{const me=await exchangeDiscordCode(req.query.code,discordRedirectUri);const user=await upsertDiscordUser(me);return res.redirect(`${webUrl}/?token=${encodeURIComponent(sign(user))}`);}catch(e){console.error('[LEGACY:oauth]',e);return res.status(500).send('فشل تسجيل الدخول عبر Discord. تحقق من إعدادات OAuth في .env وDiscord Developer Portal.');}});

app.post('/activity/auth',async(req,res)=>{if(!req.body?.code)return res.status(400).json({error:'Missing Activity code'});const missing=oauthMissing(true);if(missing.length)return res.status(500).json({error:`إعدادات Discord OAuth ناقصة: ${missing.join(', ')}`});try{const me=await exchangeDiscordCode(req.body.code,discordActivityRedirectUri);const user=await upsertDiscordUser(me);const p=await pool.query(`SELECT d.discord_id,d.username,d.global_name,d.avatar_url,p.display_name,p.level,p.experience,p.premium_until,COALESCE((SELECT SUM(amount) FROM point_transactions WHERE user_id=u.id),0)::bigint AS points FROM users u JOIN discord_accounts d ON d.user_id=u.id JOIN profiles p ON p.user_id=u.id WHERE u.id=$1`,[user.id]);res.json({token:sign(user),discordUser:me,me:p.rows[0]||null});}catch(e){console.error('[LEGACY:activity-oauth]',e);res.status(500).json({error:'فشل ربط Activity. تحقق من إعدادات OAuth في .env وDiscord Developer Portal.'});}});

app.get('/api/me',auth,async(req,res)=>{const r=await pool.query(`SELECT u.id,d.discord_id,d.username,d.global_name,d.avatar_url,p.display_name,p.bio,p.banner_url,p.level,p.experience,p.premium_until,COALESCE((SELECT SUM(amount) FROM point_transactions WHERE user_id=u.id),0)::bigint AS points FROM users u JOIN discord_accounts d ON d.user_id=u.id JOIN profiles p ON p.user_id=u.id WHERE u.id=$1`,[req.auth.userId]);if(!r.rowCount)return res.status(404).json({error:'المستخدم غير موجود'});res.json({...r.rows[0],admin:!!req.auth.admin});});
app.get('/api/inventory',auth,async(req,res)=>{const r=await pool.query(`SELECT i.quantity,i.acquired_at,c.* FROM inventory_items i JOIN catalog_items c ON c.id=i.item_id WHERE i.user_id=$1 ORDER BY i.acquired_at DESC`,[req.auth.userId]);res.json(r.rows);});
app.get('/api/shop',async(_req,res)=>{const r=await pool.query('SELECT * FROM catalog_items WHERE active=true ORDER BY created_at DESC');res.json(r.rows);});
app.get('/api/leaderboards/points',async(_req,res)=>{const r=await pool.query(`SELECT d.username,d.global_name,d.avatar_url,COALESCE(SUM(t.amount),0)::bigint AS points,p.level FROM users u JOIN discord_accounts d ON d.user_id=u.id JOIN profiles p ON p.user_id=u.id LEFT JOIN point_transactions t ON t.user_id=u.id GROUP BY u.id,d.username,d.global_name,d.avatar_url,p.level ORDER BY points DESC LIMIT 50`);res.json(r.rows);});
app.get('/api/admin/users',auth,admin,async(req,res)=>{const q=`%${String(req.query.q||'').slice(0,80)}%`;const r=await pool.query(`SELECT u.id,d.discord_id,d.username,d.global_name,p.display_name,p.level,COALESCE((SELECT SUM(amount) FROM point_transactions WHERE user_id=u.id),0)::bigint AS points FROM users u JOIN discord_accounts d ON d.user_id=u.id JOIN profiles p ON p.user_id=u.id WHERE d.username ILIKE $1 OR d.global_name ILIKE $1 OR d.discord_id=$2 ORDER BY u.created_at DESC LIMIT 50`,[q,String(req.query.q||'')]);res.json(r.rows);});
app.post('/api/admin/points',auth,admin,async(req,res)=>{const amount=Number(req.body.amount),target=String(req.body.userId||''),reason=String(req.body.reason||'تعديل إداري').slice(0,200);if(!Number.isSafeInteger(amount)||!target)return res.status(400).json({error:'بيانات غير صحيحة'});await pool.query('INSERT INTO point_transactions(user_id,amount,reason,actor_user_id) VALUES($1,$2,$3,$4)',[target,amount,reason,req.auth.userId]);await pool.query('INSERT INTO audit_logs(actor_user_id,action,target_user_id,payload) VALUES($1,$2,$3,$4)',[req.auth.userId,'points.adjust',target,JSON.stringify({amount,reason})]);res.json({ok:true});});
app.post('/api/admin/catalog',auth,admin,async(req,res)=>{const{type,slug,name,description='',price=0,metadata={}}=req.body;if(!type||!slug||!name)return res.status(400).json({error:'النوع والاسم والمعرف مطلوبة'});const r=await pool.query('INSERT INTO catalog_items(type,slug,name,description,price,metadata) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',[type,slug,name,description,Number(price),JSON.stringify(metadata)]);await pool.query('INSERT INTO audit_logs(actor_user_id,action,payload) VALUES($1,$2,$3)',[req.auth.userId,'catalog.create',JSON.stringify({itemId:r.rows[0].id})]);res.status(201).json(r.rows[0]);});
app.get('/api/admin/audit',auth,admin,async(_req,res)=>{const r=await pool.query('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 100');res.json(r.rows);});
app.get('/internal/user/:discordId',internal,async(req,res)=>{const r=await pool.query(`SELECT u.id,d.discord_id,d.username,d.global_name,d.avatar_url,p.display_name,p.bio,p.level,p.experience,p.premium_until,COALESCE((SELECT SUM(amount) FROM point_transactions WHERE user_id=u.id),0)::bigint AS points FROM users u JOIN discord_accounts d ON d.user_id=u.id JOIN profiles p ON p.user_id=u.id WHERE d.discord_id=$1`,[req.params.discordId]);if(!r.rowCount)return res.status(404).json({error:'المستخدم غير مرتبط بـ LEGACY بعد'});res.json(r.rows[0]);});
app.get('/internal/user/:discordId/inventory',internal,async(req,res)=>{const r=await pool.query(`SELECT i.quantity,i.acquired_at,c.id,c.type,c.slug,c.name,c.description,c.metadata FROM inventory_items i JOIN catalog_items c ON c.id=i.item_id JOIN discord_accounts d ON d.user_id=i.user_id WHERE d.discord_id=$1 ORDER BY i.acquired_at DESC`,[req.params.discordId]);res.json(r.rows);});
app.get('/internal/shop',internal,async(_req,res)=>{const r=await pool.query('SELECT * FROM catalog_items WHERE active=true ORDER BY created_at DESC');res.json(r.rows);});
app.get('/internal/audit',internal,async(_req,res)=>{const r=await pool.query('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 100');res.json(r.rows);});
app.post('/internal/admin/points',internal,async(req,res)=>{const actor=String(req.body.actorDiscordId||''),target=String(req.body.targetDiscordId||''),amount=Number(req.body.amount),reason=String(req.body.reason||'تعديل إداري').slice(0,200);if(!adminIds.has(actor))return res.status(403).json({error:'الإدارة فقط'});if(!target||!Number.isSafeInteger(amount)||amount===0)return res.status(400).json({error:'بيانات غير صحيحة'});const t=await pool.query('SELECT user_id FROM discord_accounts WHERE discord_id=$1',[target]),a=await pool.query('SELECT user_id FROM discord_accounts WHERE discord_id=$1',[actor]);if(!t.rowCount||!a.rowCount)return res.status(404).json({error:'الحساب غير مرتبط'});await pool.query('INSERT INTO point_transactions(user_id,amount,reason,actor_user_id) VALUES($1,$2,$3,$4)',[t.rows[0].user_id,amount,reason,a.rows[0].user_id]);await pool.query('INSERT INTO audit_logs(actor_user_id,action,target_user_id,payload) VALUES($1,$2,$3,$4)',[a.rows[0].user_id,'points.adjust',t.rows[0].user_id,JSON.stringify({amount,reason,source:'discord'})]);res.json({ok:true});});
app.post('/internal/admin/catalog',internal,async(req,res)=>{const actor=String(req.body.actorDiscordId||'');if(!adminIds.has(actor))return res.status(403).json({error:'الإدارة فقط'});const{type,slug,name,description='',price=0,metadata={}}=req.body;if(!type||!slug||!name||!Number.isSafeInteger(Number(price))||Number(price)<0)return res.status(400).json({error:'بيانات العنصر غير صحيحة'});const a=await pool.query('SELECT user_id FROM discord_accounts WHERE discord_id=$1',[actor]);if(!a.rowCount)return res.status(404).json({error:'حساب الإدارة غير مرتبط'});const r=await pool.query('INSERT INTO catalog_items(type,slug,name,description,price,metadata) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',[type,slug,name,description,Number(price),JSON.stringify(metadata)]);await pool.query('INSERT INTO audit_logs(actor_user_id,action,payload) VALUES($1,$2,$3)',[a.rows[0].user_id,'catalog.create',JSON.stringify({itemId:r.rows[0].id,source:'discord'})]);res.status(201).json(r.rows[0]);});
registerExtendedRoutes(app,{pool,auth,admin,internal,adminIds});
app.listen(port,()=>console.log(`LEGACY API listening on :${port}`));
