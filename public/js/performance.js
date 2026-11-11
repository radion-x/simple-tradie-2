(() => {
  const $=id=>document.getElementById(id), today=new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Sydney',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const stages={new:'New enquiry',qualified:'Qualified',quoted:'Quote sent',paid:'First payment received',lost:'Lost',excluded:'Excluded'};
  const channels={website:'Website',gumtree_message:'Gumtree message',phone:'Phone',manual:'Other',contact_form:'Website form',chat_booking:'Callback request',chatbot:'Chat callback',download_chat:'Transcript request',assessment:'Project brief',footer_form:'Website form'};
  const money=cents=>new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD'}).format(Number(cents||0)/100);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const day=s=>s?new Date(s).toLocaleDateString('en-AU',{timeZone:'Australia/Sydney'}):'Not recorded';
  let rows=[], manualId;
  async function request(path,body,method='POST') {
    const r=await fetch(path,body?{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{});
    const data=await r.json();
    if(r.status===401) throw Error('Please sign in through the enquiry dashboard, then return to this report.');
    if(!r.ok) throw Error(data.error||'The report could not be loaded. Try refreshing.');
    return data;
  }
  async function load() {
    $('reportStatus').textContent='Loading report…';
    try {
      const params=new URLSearchParams(new FormData($('reportFilters'))), data=await request('/api/performance?'+params), m=data.metrics;
      rows=data.rows; $('reportBody').hidden=false; $('reportStatus').textContent='';
      $('metricVisits').textContent=m.visits; $('metricEnquiries').textContent=m.enquiries; $('metricPaid').textContent=m.paid_customers;
      const rate=m.visits?`${(100*m.visits_with_enquiry/m.visits).toFixed(1)}%`:'not available yet';
      $('visitFunnel').textContent=`Of ${m.visits} measured visits that started in this period, ${m.visits_with_enquiry} have a matched enquiry and ${m.visits_with_customer} have a confirmed paying customer. Visit-to-enquiry rate: ${rate}.`;
      $('paymentSummary').textContent=`By payment date, ${m.payments_in_period} first payments cleared in this period, totalling ${money(m.first_payments_cents)}. These can include customers who enquired earlier. This is first-payment cash, not total project revenue.`;
      $('dataCoverage').textContent=`Private visit measurement began ${day(data.measurement_started_at)}. Earlier visits are not backfilled. ${m.excluded} excluded records and ${m.transcript_only} transcript-only requests are omitted from enquiry totals. Staff visits are excluded when signed in. Visits are retained for 13 months.`;
      $('rowCount').textContent=`Showing ${rows.length} of ${m.submissions} saved records. Use a shorter date range if more than 200. Select an enquiry to record follow-up or a first payment.`;
      $('emptyRows').hidden=rows.length>0;
      $('salesRows').innerHTML=rows.map(r=>`<tr><td><strong>SP-${r.id} · ${esc(r.name)}</strong><small>${esc(r.email||r.phone||'Conversation reference in details')}</small></td><td>${esc(r.acquisition_source)}${r.source_override?' (customer confirmed)':''}<small>${esc(channels[r.capture_method==='website'?r.source:r.capture_method]||'Website')}</small></td><td><span class="stage">${esc(stages[r.sales_stage])}</span></td><td>${day(r.created_at)}</td><td>${r.sales_stage==='paid'?`${money(r.paid_amount_cents)}<small>${day(r.paid_on)}</small>`:'Not recorded'}</td><td><button type="button" data-sale="${r.id}">Update SP-${r.id}</button></td></tr>`).join('');
    } catch(e) { $('reportStatus').textContent=e.message; }
  }
  function paymentFields() {
    const paid=$('saleForm').elements.sales_stage.value==='paid'; $('paymentFields').hidden=!paid;
    $('paymentFields').querySelectorAll('input').forEach(e=>{e.required=paid;e.disabled=!paid;});
  }
  $('reportFilters').elements.startDate.value='2026-11-11'; $('reportFilters').elements.endDate.value=today;
  $('reportFilters').addEventListener('submit',e=>{e.preventDefault();load();});
  $('salesRows').addEventListener('click',e=>{
    const button=e.target.closest('[data-sale]'); if(!button)return;
    const r=rows.find(r=>r.id===Number(button.dataset.sale)), form=$('saleForm'); form.reset();
    for(const key of ['id','sales_stage','sales_notes','source_override','source_note','customer_key','payment_reference']) form.elements[key].value=r[key]||'';
    form.elements.paid_on.value=r.paid_on?String(r.paid_on).slice(0,10):today;
    form.elements.paid_amount.value=r.paid_amount_cents?(r.paid_amount_cents/100).toFixed(2):'';
    $('saleHeading').textContent=`SP-${r.id} · ${r.name}`;
    $('saleContext').textContent=`Recorded source: ${r.acquisition_source}. ${r.message||''}`;
    $('saleStatus').textContent='';paymentFields();$('saleDialog').showModal();
  });
  $('saleForm').elements.sales_stage.addEventListener('change',paymentFields);
  $('saleForm').addEventListener('submit',async e=>{
    e.preventDefault(); const form=e.currentTarget, button=form.querySelector('[type=submit]'), data=Object.fromEntries(new FormData(form));
    data.payment_confirmed=form.elements.payment_confirmed.checked; button.disabled=true; $('saleStatus').textContent='Saving…';
    try { await request('/api/sales/'+data.id,data,'PATCH'); $('saleDialog').close(); await load(); } catch(error){$('saleStatus').textContent=error.message;} finally{button.disabled=false;}
  });
  $('addEnquiry').addEventListener('click',()=>{$('manualForm').reset();$('manualForm').elements.enquired_on.value=today;manualId=crypto.randomUUID();$('manualStatus').textContent='';$('manualDialog').showModal();});
  $('manualForm').addEventListener('submit',async e=>{
    e.preventDefault(); const button=e.currentTarget.querySelector('[type=submit]'); button.disabled=true;
    try {const data=Object.fromEntries(new FormData(e.currentTarget));data.event_id=manualId;await request('/api/sales/manual',data);$('manualDialog').close();await load();}catch(error){$('manualStatus').textContent=error.message;}finally{button.disabled=false;}
  });
  document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>$(b.dataset.close).close()));
  request('/api/admin/session').then(()=>{$('reportBody').hidden=false;load();}).catch(e=>{$('reportStatus').textContent=e.message;});
})();
