// Reviewed one-time release step. Runs before the new application replaces the old one.
// The deployment tool inlines this file and the SQL into the existing container.
const {Pool}=require('pg');
const fs=require('node:fs');
const path=require('node:path');
const migration='010_acquisition_reporting.sql';
const sql=fs.readFileSync(path.join(__dirname,'../migrations',migration),'utf8');
const target=new URL(process.env.DATABASE_URL);
if(target.hostname!=='kw000s8kcgscww0gc8wogsok'||target.pathname!=='/simple_tradie_2_db') throw Error('Wrong release database');
const pool=new Pool({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:5000});
(async()=>{
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s'");
    await client.query('SELECT pg_advisory_xact_lock(63798142)');
    if((await client.query('SELECT 1 FROM schema_migrations WHERE name=$1',[migration])).rowCount) {
      await client.query('COMMIT');console.log('Measurement migration already applied');return;
    }
    await client.query('LOCK TABLE callback_requests IN ACCESS EXCLUSIVE MODE');
    const snapshot=async()=> (await client.query("SELECT COUNT(*)::int AS count, md5(COALESCE(string_agg(md5(concat_ws('|',id,name,phone,email,message,created_at)),'' ORDER BY id),'')) AS fingerprint FROM callback_requests")).rows[0];
    const before=await snapshot();
    await client.query(sql);
    const after=await snapshot();
    if(JSON.stringify(before)!==JSON.stringify(after)) throw Error('Existing enquiry preservation check failed');
    await client.query('INSERT INTO schema_migrations(name) VALUES($1)',[migration]);
    await client.query('COMMIT');
    console.log(JSON.stringify({migration,existing_enquiries:after.count,existing_records_preserved:true}));
  } catch(error) { await client.query('ROLLBACK');throw error; }
  finally { client.release();await pool.end(); }
})().catch(error=>{console.error('Measurement migration failed',error.code||'verification error');process.exitCode=1;});
