(function (root) {
  const KEY = 'tradie_measured_visit_v1';
  function createVisitMeasurement({storage, uuid, now = Date.now, send, source}) {
    let allowed = false, current = null, pending = null;
    function stop() { allowed = false; current = null; try { storage.removeItem(KEY); } catch {} }
    function start() {
      allowed = true;
      const channel = source();
      if (!current) { try { current = JSON.parse(storage.getItem(KEY)); } catch {} }
      if (!current || !/^[a-f0-9-]{36}$/i.test(current.id || '') || current.source !== channel || now() - current.last > 1800000) {
        current = {id:uuid(), source:channel, last:now(), saved:false};
      }
      current.last = now();
      try { storage.setItem(KEY, JSON.stringify(current)); } catch {}
      if (!current.saved && !current.excluded && !pending) {
        const visit = current;
        pending = Promise.resolve().then(() => send({visit_id:visit.id,source:visit.source,consent:true})).then(result => {
          if (allowed && current === visit) {
            visit.saved = result.saved === true;
            visit.excluded = result.excluded === true;
            try { storage.setItem(KEY, JSON.stringify(visit)); } catch {}
          }
        }).catch(() => {}).finally(() => { pending = null; });
      }
      return pending;
    }
    return {start, stop, id:() => allowed && current?.saved ? current.id : null};
  }
  if (typeof module !== 'undefined') module.exports = {createVisitMeasurement};
  if (!root?.document || root.location.hostname !== 'tradie.simplepage.com.au' || root.location.pathname !== '/') return;
  let storage;
  try { storage = root.sessionStorage; } catch { storage = {getItem:()=>null,setItem:()=>{},removeItem:()=>{}}; }
  root.tradieVisit = createVisitMeasurement({
    storage, uuid:() => root.crypto.randomUUID(),
    source:() => { const f=root.tradieFunnel; const a=f?.latestAttribution()?.utm_source || f?.attribution()?.utm_source; return ['gumtree','google'].includes(a) ? a : /(^|[.])gumtree[.]com[.]au$/.test(f?.attribution()?.referrer_host || '') ? 'gumtree' : 'other'; },
    send:async body => { const r=await fetch('/api/measurement/visit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}); if(!r.ok) throw Error('Measurement unavailable'); return r.json(); },
  });
})(typeof window === 'undefined' ? null : window);
