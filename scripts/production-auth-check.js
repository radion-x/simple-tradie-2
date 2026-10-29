// One-off release verification. No tokens or existing customer records leave the container.
const crypto=require('node:crypto');
const auth=require('/app/services/adminAuth');
const pool=require('/app/db/pool');
const run=process.env.TRADIE_RELEASE_RUN;
const owner='jack6nimble@gmail.com';
if(new URL(process.env.DATABASE_URL).pathname!=='/simple_tradie_2_db'||!/^release-20261029-[a-f0-9]{6}$/.test(run||''))throw Error('Wrong release test target');
(async()=>{
 if(!auth.getAllowedAdminEmails().has(owner))throw Error('Existing owner is not authorised');
 const token=await auth.issueMagicLink(owner);
 const consumed=await fetch('http://127.0.0.1:3000/api/admin/magic-link?token='+encodeURIComponent(token),{redirect:'manual'});
 const cookie=consumed.headers.get('set-cookie')?.split(';')[0];if(!cookie)throw Error('No session issued');
 const headers={cookie};
 const session=await fetch('http://127.0.0.1:3000/api/admin/session',{headers});if(session.status!==200)throw Error('Session denied');
 const replay=await fetch('http://127.0.0.1:3000/api/admin/magic-link?token='+encodeURIComponent(token),{redirect:'manual'});
 const leadResponse=await fetch('http://127.0.0.1:3000/api/callbacks?search='+encodeURIComponent(run),{headers});const leads=await leadResponse.json();
 const records=leads.data||[];if(records.length!==3||records.some(x=>!x.name.startsWith('CONTROLLED OWNER TEST '+run)))throw Error('Controlled records missing');
 const evidence=records.map(x=>({id:x.id,source:x.source,notification_status:x.notification_status,utm_source:x.utm_source,utm_campaign:x.utm_campaign,conversation_characters:(x.conversation_context||'').length}));
 for(const record of records){const updated=await fetch('http://127.0.0.1:3000/api/callbacks/'+record.id,{method:'PATCH',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({status:'completed'})});if(updated.status!==200)throw Error('Could not close controlled record');}
 await fetch('http://127.0.0.1:3000/api/admin/logout',{method:'POST',headers});
 const revoked=await fetch('http://127.0.0.1:3000/api/admin/session',{headers});
 const original=(await pool.query("SELECT COUNT(*)::int AS leads,md5(COALESCE(string_agg(md5(concat_ws('|',id,name,phone,email,message,created_at)),'' ORDER BY id),'')) AS fingerprint FROM callback_requests WHERE id<=7")).rows[0];
 const hash=crypto.createHash('sha256').update(process.env.OPENROUTER_API_KEY).digest('hex');
 console.log(JSON.stringify({staff_login:consumed.status===302,session_verified:session.status===200,single_use_link:replay.headers.get('location')?.includes('auth=invalid'),logout_revoked:revoked.status===401,approved_model_active:process.env.OPENROUTER_MODEL==='openai/gpt-5.4-mini',approved_key_active:hash===process.env.TRADIE_APPROVED_KEY_HASH,existing_seven_preserved:original.leads===7&&original.fingerprint==='97d69c2df16f24a6b93e6f30857a451f',controlled_records:evidence,controlled_records_closed:true}));
 await pool.end();
})().catch(async error=>{console.error('Release authentication check failed',error.message);await pool.end();process.exitCode=1;});
