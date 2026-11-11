const pool = require('../db/pool');
const channels = ['gumtree','google','other'];
const stages = ['new','qualified','quoted','paid','lost','excluded'];
const sourceSql = `COALESCE(source_override, CASE WHEN latest_utm_source IN ('gumtree','google') THEN latest_utm_source WHEN utm_source IN ('gumtree','google') THEN utm_source WHEN referrer_host ~ '(^|[.])gumtree[.]com[.]au$' THEN 'gumtree' ELSE 'other' END)`;
const eligibleSql = `sales_stage <> 'excluded' AND (source <> 'download_chat' OR sales_stage <> 'new')`;
const prospectSql = `COALESCE(NULLIF(lower(trim(email)),''), NULLIF(regexp_replace(phone,'[^0-9]','','g'),''), 'lead-' || id::text)`;
function validDate(s) { return typeof s==='string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0,10)===s; }
function today() { return new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Sydney',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()); }
function bounds(query) {
  const start=query.startDate || today(), end=query.endDate || today(), source=query.source || 'gumtree';
  if(!validDate(start)||!validDate(end)||start>end||end>today()||!['all',...channels].includes(source)) throw Object.assign(Error('Choose a valid date range and source.'),{status:400});
  return [start,end,source];
}
async function report(query) {
  const values=bounds(query);
  const scoped=`WITH leads AS (SELECT *, ${sourceSql} AS acquisition_source, ${prospectSql} AS prospect FROM callback_requests), cohort AS (SELECT * FROM leads WHERE (created_at AT TIME ZONE current_setting('TIMEZONE') AT TIME ZONE 'Australia/Sydney')::date BETWEEN $1::date AND $2::date AND ($3='all' OR acquisition_source=$3))`;
  const metrics=(await pool.query(`${scoped} SELECT COUNT(*)::int AS submissions, COUNT(DISTINCT prospect) FILTER (WHERE ${eligibleSql})::int AS enquiries, COUNT(DISTINCT customer_key) FILTER (WHERE sales_stage='paid')::int AS paid_customers, COUNT(*) FILTER (WHERE sales_stage='excluded')::int AS excluded, COUNT(*) FILTER (WHERE source='download_chat' AND sales_stage='new')::int AS transcript_only FROM cohort`,values)).rows[0];
  const rows=(await pool.query(`${scoped} SELECT * FROM cohort ORDER BY created_at DESC LIMIT 200`,values)).rows;
  const visits=(await pool.query(`SELECT COUNT(*)::int AS visits, COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM callback_requests c WHERE c.visit_id=v.id AND ${eligibleSql}))::int AS visits_with_enquiry, COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM callback_requests c WHERE c.visit_id=v.id AND c.sales_stage='paid'))::int AS visits_with_customer FROM campaign_visits v WHERE (v.created_at AT TIME ZONE 'Australia/Sydney')::date BETWEEN $1::date AND $2::date AND ($3='all' OR v.source=$3)`,values)).rows[0];
  const payments=(await pool.query(`SELECT COUNT(*)::int AS payments_in_period, COALESCE(SUM(paid_amount_cents),0)::bigint AS first_payments_cents FROM callback_requests WHERE sales_stage='paid' AND paid_on BETWEEN $1::date AND $2::date AND ($3='all' OR ${sourceSql}=$3)`,values)).rows[0];
  const started=(await pool.query("SELECT applied_at FROM schema_migrations WHERE name='010_acquisition_reporting.sql'")).rows[0]?.applied_at;
  return {range:{start:values[0],end:values[1],source:values[2]},metrics:{...metrics,...visits,...payments},rows,measurement_started_at:started};
}
function text(body,key,max=1000) {
  if(body[key]!=null && typeof body[key]!=='string') throw Object.assign(Error('Check the sales details and try again.'),{status:400});
  const s=(body[key]||'').trim();
  if(s.length>max || /\x00/.test(s)) throw Object.assign(Error('Please shorten the sales notes.'),{status:400});
  return s;
}
async function updateSale(id,body,author) {
  if(!/^[1-9]\d*$/.test(String(id)) || !stages.includes(body.sales_stage)) throw Object.assign(Error('Choose a valid enquiry and stage.'),{status:400});
  const stage=body.sales_stage, notes=text(body,'sales_notes',2000), source=body.source_override || null, sourceNote=text(body,'source_note',500);
  if(source && (!channels.includes(source)||!sourceNote)) throw Object.assign(Error('Add how the customer confirmed their source.'),{status:400});
  if(stage==='excluded'&&!notes) throw Object.assign(Error('Add a reason, such as test, spam or duplicate of SP-123.'),{status:400});
  let key=null,date=null,amount=null,reference=null;
  if(stage==='paid') {
    key=text(body,'customer_key',160).toLowerCase(); date=body.paid_on; reference=text(body,'payment_reference',160);
    if(!key||!reference||!validDate(date)||date>today()||body.payment_confirmed!==true||typeof body.paid_amount!=='string'||!/^\d{1,7}(\.\d{1,2})?$/.test(body.paid_amount)) throw Object.assign(Error('Confirm the agreed scope and cleared payment, with its date, amount, customer and payment references.'),{status:400});
    amount=Math.round(Number(body.paid_amount)*100);
    if(amount<=0) throw Object.assign(Error('Enter the amount actually received.'),{status:400});
  }
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    const previous=(await client.query('SELECT * FROM callback_requests WHERE id=$1 FOR UPDATE',[id])).rows[0];
    if(!previous) throw Object.assign(Error('This enquiry was not found. Refresh the report.'),{status:404});
    if(previous.sales_stage==='paid' && stage!=='paid' && !notes) throw Object.assign(Error('Explain why the recorded payment is being corrected in the notes.'),{status:400});
    if(date && date < new Date(previous.created_at).toLocaleDateString('en-CA',{timeZone:'Australia/Sydney'})) throw Object.assign(Error('The first payment date cannot be before the enquiry date.'),{status:400});
    const row=(await client.query(`UPDATE callback_requests SET sales_stage=$2,sales_notes=$3,source_override=$4,source_note=$5,customer_key=$6,paid_on=$7,paid_amount_cents=$8,payment_reference=$9 WHERE id=$1 RETURNING *`,[id,stage,notes,source,sourceNote,key,date,amount,reference])).rows[0];
    const keys=['sales_stage','sales_notes','source_override','source_note','customer_key','paid_on','paid_amount_cents','payment_reference'];
    const pick=r=>Object.fromEntries(keys.map(k=>[k,r[k]]));
    await client.query('INSERT INTO sales_changes(callback_id,changed_by,previous,current) VALUES($1,$2,$3,$4)',[id,author,JSON.stringify(pick(previous)),JSON.stringify(pick(row))]);
    await client.query('COMMIT'); return row;
  } catch(e) { await client.query('ROLLBACK'); if(e.code==='23505') throw Object.assign(Error('That customer is already counted as paid. Use the original enquiry and mark this one as a duplicate.'),{status:409}); throw e; } finally { client.release(); }
}
async function manualLead(body) {
  const name=text(body,'name',120), phone=text(body,'phone',40), email=text(body,'email',254), note=text(body,'message',2000);
  if(!name||!channels.includes(body.source)||!['gumtree_message','phone','manual'].includes(body.capture_method)||(!phone&&!email&&!note)) throw Object.assign(Error('Add the prospect name, source and a contact detail or conversation reference.'),{status:400});
  if(!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(body.event_id||'')) throw Object.assign(Error('Refresh the page and try again.'),{status:400});
  if(!validDate(body.enquired_on)||body.enquired_on>today()) throw Object.assign(Error('Choose the date of the first enquiry.'),{status:400});
  return (await pool.query(`INSERT INTO callback_requests(name,phone,email,message,source,funnel,utm_source,capture_method,event_id,notification_status,created_at) VALUES($1,$2,$3,$4,'contact_form','tradie_website',$5,$6,$7,'not_required',($8::date + TIME '12:00') AT TIME ZONE 'Australia/Sydney' AT TIME ZONE current_setting('TIMEZONE')) ON CONFLICT(event_id) WHERE event_id IS NOT NULL DO UPDATE SET event_id=EXCLUDED.event_id RETURNING id`,[name,phone||null,email||null,note,body.source,body.capture_method,body.event_id,body.enquired_on])).rows[0];
}
module.exports={report,updateSale,manualLead,channels,validDate,today};
