const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createVisitMeasurement}=require('../public/js/visit-measurement');
const {createAnalytics}=require('../public/js/analytics');
const {createFunnel}=require('../public/js/funnel');
test('private visits start only with consent, survive reload, expire and stop when consent is withdrawn',async()=>{
  const values=new Map(),storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
  let now=1000,count=0,source='gumtree';const sent=[];
  const config={storage,uuid:()=>`12345678-1234-4123-8123-${String(++count).padStart(12,'0')}`,now:()=>now,source:()=>source,send:async body=>{sent.push(body);return {saved:true};}};
  const v=createVisitMeasurement(config);
  const a=createAnalytics({location:{hostname:'tradie.simplepage.com.au',pathname:'/'},storage,load:()=>{},send:()=>{},disable:()=>{},recordVisit:()=>v.start(),stopVisit:()=>v.stop()});
  assert.equal(v.id(),null);a.setChoice('declined');assert.equal(sent.length,0);
  a.setChoice('accepted');await v.start();assert.equal(sent.length,1);const first=v.id();
  const reload=createVisitMeasurement(config);await reload.start();assert.equal(reload.id(),first);assert.equal(sent.length,1);
  now+=1800001;await reload.start();assert.notEqual(reload.id(),first);assert.equal(sent.length,2);
  a.setChoice('declined');assert.equal(v.id(),null);assert.equal(values.has('tradie_measured_visit_v1'),false);
});
test('a blocked or failed visit never adds an unconfirmed reference to an enquiry',async()=>{
  const v=createVisitMeasurement({storage:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}},uuid:()=> '12345678-1234-4123-8123-123456789012',source:()=> 'gumtree',send:async()=>({excluded:true})});
  await v.start();assert.equal(v.id(),null);v.stop();assert.equal(v.id(),null);
});
test('capture keeps first entry and records a later Gumtree source and allowed visit reference separately',()=>{
  const values=new Map([['tradie_entry',JSON.stringify({landing_path:'/',utm_source:'google'})]]),storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};
  const f=createFunnel({location:{pathname:'/',hostname:'tradie.simplepage.com.au',search:'?utm_source=gumtree'},storage,emit:()=>{},visitId:()=> '12345678-1234-4123-8123-123456789012'});
  assert.equal(f.attribution().utm_source,'google');assert.equal(f.captureAttribution().latest_utm_source,'gumtree');assert.equal(f.captureAttribution().visit_id,'12345678-1234-4123-8123-123456789012');
});
