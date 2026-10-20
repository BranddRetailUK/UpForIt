// Isolated local preview; never connects to a production database or email provider.
import pg from 'pg';import bcrypt from 'bcryptjs';import {randomUUID,randomBytes} from 'node:crypto';import {readFile} from 'node:fs/promises';import {spawn} from 'node:child_process';
const u=new URL(process.env.DATABASE_URL);if(!['localhost','127.0.0.1'].includes(u.hostname))throw Error('Local PostgreSQL required');
const root=new pg.Client({connectionString:u.href});await root.connect();const name='upforit_campaign_preview_'+Date.now();await root.query(`CREATE DATABASE ${name}`);u.pathname='/'+name;const db=new pg.Client({connectionString:u.href});await db.connect();
for(const f of ['001_native_ticketing.sql','009_single_general_release_ticket.sql','010_mix_competition.sql'])await db.query(await readFile(new URL('../../frontend-next/migrations/'+f,import.meta.url),'utf8'));
await db.query('CREATE TABLE signups(id serial PRIMARY KEY,email text UNIQUE NOT NULL,created_at timestamptz DEFAULT now())');
await db.query("INSERT INTO users(id,email,display_name,password_hash,role,email_verified_at) VALUES($1,'preview@example.com','Local Preview',$2,'admin',now())",[randomUUID(),await bcrypt.hash('CampaignPreview-Only-2026!',10)]);
await db.query("INSERT INTO signups(email) VALUES('sample-one@example.com'),('sample-two@example.com')");
const server=spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url),stdio:'inherit',env:{DATABASE_URL:u.href,AUTH_RATE_LIMIT_SECRET:randomBytes(32).toString('hex'),PORT:'4312',ADMIN_ORIGIN:'http://127.0.0.1:4312',NODE_ENV:'test',PATH:process.env.PATH}});
console.log('Local preview: http://127.0.0.1:4312 — preview@example.com / CampaignPreview-Only-2026! (test fixtures only)');
process.on('SIGTERM',()=>server.kill('SIGTERM'));process.on('SIGINT',()=>server.kill('SIGTERM'));server.on('exit',async()=>{await db.end();await root.query(`DROP DATABASE ${name} WITH(FORCE)`);await root.end();});
