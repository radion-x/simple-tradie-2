const router=require('express').Router();
const pool=require('../db/pool');
const {authenticateAdmin,getSession}=require('../services/adminAuth');
const sales=require('../services/salesReporting');
function sameOrigin(req,res,next) {
  const expected=process.env.SITE_URL ? new URL(process.env.SITE_URL).origin : `${req.protocol}://${req.get('host')}`;
  if(req.get('origin')!==expected || !req.is('application/json')) return res.status(403).json({error:'Open this form on the website and try again.'});
  next();
}
router.post('/measurement/visit',sameOrigin,async(req,res,next)=>{
  try {
    if(req.body.consent!==true||!sales.channels.includes(req.body.source)||!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(req.body.visit_id||'')) return res.status(400).json({error:'Invalid visit.'});
    if(await getSession(req)||/bot|crawler|spider|preview|headless/i.test(req.get('user-agent')||'')) return res.json({saved:false,excluded:true});
    await pool.query('INSERT INTO campaign_visits(id,source) VALUES($1,$2) ON CONFLICT(id) DO NOTHING',[req.body.visit_id,req.body.source]);
    await pool.query("DELETE FROM campaign_visits WHERE created_at < NOW() - INTERVAL '13 months'");
    res.json({saved:true});
  } catch(e) { next(e); }
});
router.get('/performance',authenticateAdmin,async(req,res,next)=>{
  try { res.set('Cache-Control','no-store').json({success:true,...await sales.report(req.query)}); } catch(e) { next(e); }
});
router.patch('/sales/:id',authenticateAdmin,sameOrigin,async(req,res,next)=>{
  try { res.json({success:true,data:await sales.updateSale(req.params.id,req.body,req.admin.email)}); } catch(e) { if(e.status) return res.status(e.status).json({error:e.message}); next(e); }
});
router.post('/sales/manual',authenticateAdmin,sameOrigin,async(req,res,next)=>{
  try { res.json({success:true,...await sales.manualLead(req.body)}); } catch(e) { if(e.status) return res.status(e.status).json({error:e.message}); next(e); }
});
module.exports=router;
