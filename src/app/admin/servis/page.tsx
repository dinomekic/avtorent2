'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const GDRIVE_URL = 'https://script.google.com/macros/s/AKfycbyunN3qJRFk-bydMWkEImsYoXdw-n-e7nln3aerDLGtc5gxXUmwkBPgCFMNzS7qBitpjg/exec'

function getCookie(name: string): string {
  if (typeof document === 'undefined') return ''
  const match = document.cookie.match(new RegExp(`${name}=([^;]+)`))
  return match ? decodeURIComponent(match[1]) : ''
}

const SERVICE_TYPES = [
  { key: 'mali_servis',   label: 'Mali servis',   icon: '🔧' },
  { key: 'veliki_servis', label: 'Veliki servis', icon: '⚙️' },
  { key: 'kvarovi',       label: 'Kvar',          icon: '⚠️' },
  { key: 'gume',          label: 'Gume',          icon: '🛞' },
  { key: 'registracija',  label: 'Registracija',  icon: '📋' },
  { key: 'provjera',      label: 'Provjera',      icon: '🔍' },
  { key: 'ostalo',        label: 'Ostalo',        icon: '📝' },
]
const FAULT_TYPES = ['Mjenjač','Motor','Kočnice','Instrument tabla','Paljenje','Svjetla','Brisači','Hlađenje / Voda','Podizači stakala','Ostalo']
const TYRE_SEASONS = ['Ljetne','Zimske','Cjelogodišnje']
const CHECKLIST = [
  { key: 'check_ulje',            label: '🛢️ Ulje' },
  { key: 'check_voda',            label: '💧 Rashladna tečnost' },
  { key: 'check_tecnost_brisaci', label: '🪣 Tečnost za brisače' },
  { key: 'check_svetla',          label: '💡 Svjetla' },
  { key: 'check_klima',           label: '❄️ Klima' },
  { key: 'check_brave',           label: '🔒 Brave / Vrata' },
  { key: 'check_enterijer',       label: '🪑 Enterijer' },
  { key: 'check_brisaci',         label: '🌧️ Brisači' },
  { key: 'check_prskalice',       label: '💦 Prskalice' },
  { key: 'check_podizaci',        label: '🪟 Podizači stakala' },
]
const STATUS_CFG: Record<string,{label:string;bg:string;color:string}> = {
  pending:     {label:'Na čekanju',bg:'#FAEEDA',color:'#633806'},
  in_progress: {label:'U toku',    bg:'#E6F1FB',color:'#0C447C'},
  completed:   {label:'Završeno',  bg:'#E1F5EE',color:'#085041'},
  cancelled:   {label:'Otkazano',  bg:'#f3f4f6',color:'#6b7280'},
}
const PRIORITY_CFG: Record<string,{label:string;color:string}> = {
  low:    {label:'Nizak',   color:'#9ca3af'},
  normal: {label:'Normalan',color:'#185FA5'},
  high:   {label:'Visok',   color:'#d97706'},
  urgent: {label:'🔴 HITNO',color:'#dc2626'},
}

type Vozilo = {
  id:number; license_plate:string; agregirani_2:string; marka:string; model:string
  fleet_status:string; lokacija:string; current_mileage?:number; is_available?:boolean
  istek_reg?:string; dana_do_isteka?:number|null; mjesto_reg?:string
  stare_tablice?:string; vlasnik?:string; transmission?:string; year?:number
}
type Servis = {
  id:string; vehicle_id:number; service_type:string; service_date:string
  mileage_at_service?:number; description?:string; cost?:number
  performed_by?:string; external_shop?:string; priority?:string
  next_service_date?:string; next_service_mileage?:number
  status:string; notes?:string; created_at:string
  tyre_brand?:string; tyre_size?:string; tyre_season?:string; tyre_price?:number; receipt_url?:string
}
type RegHistory = {
  id:number; vehicle_id:number; license_plate:string|null; istek_reg:string|null
  mjesto_reg:string|null; datum_registracije:string|null; napomena:string|null
  created_at:string; created_by:string|null
}
type Serviser = {
  id:string; full_name:string; phone?:string; portal_email?:string
  is_active:boolean; bonus_per_service?:number; bonus_per_repair?:number; salary?:number; notes?:string
}
type VoziloTab = 'servis'|'registracija'|'istorija'|'nova'
type MainTab = 'vozila'|'serviseri'

export default function ServisPage() {
  const [mainTab, setMainTab] = useState<MainTab>('vozila')
  const [vozila, setVozila] = useState<Vozilo[]>([])
  const [servisi, setServisi] = useState<Servis[]>([])
  const [serviseri, setServiseri] = useState<Serviser[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterLok, setFilterLok] = useState('sve')
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedVozilo, setSelectedVozilo] = useState<Vozilo|null>(null)
  const [voziloTab, setVoziloTab] = useState<VoziloTab>('servis')
  const [selectedServis, setSelectedServis] = useState<Servis|null>(null)
  const [editMode, setEditMode] = useState(false)
  const [editForm, setEditForm] = useState<any>({})
  const [editSaving, setEditSaving] = useState(false)
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterType, setFilterType] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [regHistory, setRegHistory] = useState<RegHistory[]>([])
  const [regHistoryLoading, setRegHistoryLoading] = useState(false)
  const [regForm, setRegForm] = useState({license_plate:'',istek_reg:'',mjesto_reg:'',datum_registracije:new Date().toISOString().split('T')[0],napomena:''})
  const [regSaving, setRegSaving] = useState(false)
  const [regFormMode, setRegFormMode] = useState<'view'|'edit'>('view')
  const [showServiserForm, setShowServiserForm] = useState(false)
  const [editServiser, setEditServiser] = useState<Serviser|null>(null)
  const [serviserForm, setServiserForm] = useState<any>({full_name:'',phone:'',portal_email:'',is_active:true,bonus_per_service:'',bonus_per_repair:'',salary:'',notes:''})
  const [serviserSaving, setServiserSaving] = useState(false)

  const emptyForm = {
    service_type:'mali_servis', service_date:new Date().toISOString().split('T')[0],
    mileage_at_service:'', description:'', cost:'', priority:'normal',
    performed_by:'', external_shop:'', next_service_date:'', next_service_mileage:'',
    status:'completed', notes:'', fault_type:'', tyre_brand:'', tyre_size:'',
    tyre_season:'Ljetne', tyre_price:'', receipt_url:'',
    is_drivable:true, can_be_rented:true, remove_from_calendar:false,
    check_ulje:true, check_voda:true, check_tecnost_brisaci:true, check_svetla:true,
    check_klima:true, check_brave:true, check_enterijer:true, check_brisaci:true,
    check_prskalice:true, check_podizaci:true,
  }
  const [form, setForm] = useState<any>(emptyForm)
  const agentName = getCookie('avtorent-agent-name')

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [{data:v},{data:s},{data:t}] = await Promise.all([
      supabase.from('vozila_fleet').select('id,license_plate,agregirani_2,marka,model,fleet_status,lokacija,current_mileage,is_available,istek_reg,dana_do_isteka,mjesto_reg,stare_tablice,vlasnik,transmission,year').order('agregirani_2'),
      supabase.from('vehicle_services').select('*').order('service_date',{ascending:false}),
      supabase.from('technicians').select('*').order('full_name'),
    ])
    setVozila(v||[]); setServisi(s||[]); setServiseri(t||[])
    setLoading(false)
  },[])

  useEffect(()=>{ fetchAll() },[fetchAll])

  async function loadRegHistory(id:number) {
    setRegHistoryLoading(true)
    const {data} = await supabase.from('vehicle_reg_history').select('*').eq('vehicle_id',id).order('created_at',{ascending:false})
    setRegHistory(data||[])
    setRegHistoryLoading(false)
  }

  function selectVozilo(v:Vozilo) {
    setSelectedVozilo(v); setVoziloTab('servis'); setSelectedServis(null); setEditMode(false)
    setSearch(v.agregirani_2||v.license_plate); setShowDropdown(false)
    setRegForm({license_plate:v.license_plate||'',istek_reg:v.istek_reg||'',mjesto_reg:v.mjesto_reg||'',datum_registracije:new Date().toISOString().split('T')[0],napomena:''})
    setRegFormMode('view')
    loadRegHistory(v.id)
  }

  function handleTabChange(tab:VoziloTab) {
    setVoziloTab(tab)
    if (tab==='nova'){setForm(emptyForm);setSelectedServis(null);setEditMode(false)}
  }

  const lokacije = ['sve',...Array.from(new Set(vozila.map(v=>v.lokacija).filter(Boolean)))]
  const searchResults = vozila.filter(v=>{
    if (filterLok!=='sve'&&v.lokacija!==filterLok) return false
    const q=search.toLowerCase()
    return !q||(v.agregirani_2||'').toLowerCase().includes(q)||(v.license_plate||'').toLowerCase().includes(q)||(v.marka||'').toLowerCase().includes(q)
  }).slice(0,12)

  function getVoziloServisi(id:number){return servisi.filter(s=>Number(s.vehicle_id)===id).sort((a,b)=>new Date(b.service_date).getTime()-new Date(a.service_date).getTime())}
  function getAktivan(id:number){return servisi.find(s=>Number(s.vehicle_id)===id&&(s.status==='in_progress'||s.status==='pending'))}

  const filteredServisi = selectedVozilo ? getVoziloServisi(selectedVozilo.id).filter(s=>{
    if (filterStatus==='active'&&(s.status==='completed'||s.status==='cancelled')) return false
    if (filterStatus==='done'&&s.status!=='completed'&&s.status!=='cancelled') return false
    if (filterType&&s.service_type!==filterType) return false
    return true
  }) : []

  async function uploadToGDrive(file:File):Promise<string|null>{
    setUploading(true)
    try{const reader=new FileReader();return await new Promise(resolve=>{reader.onload=async e=>{const base64=(e.target?.result as string).split(',')[1];const fd=new FormData();fd.append('file',base64);fd.append('filename',file.name);fd.append('mimeType',file.type);fd.append('folder','racuni_servis');const res=await fetch(GDRIVE_URL,{method:'POST',body:fd});const data=await res.json();resolve(data.url||data.fileUrl||null)};reader.readAsDataURL(file)})}catch{return null}finally{setUploading(false)}
  }

  async function saveServis(){
    if(!selectedVozilo) return; setSaving(true)
    const checklistProblems=CHECKLIST.filter(c=>form[c.key]===false).map(c=>`❌ ${c.label}`)
    const notesParts:string[]=[]
    if(form.notes) notesParts.push(form.notes)
    if(form.fault_type) notesParts.push(`Kvar: ${form.fault_type}`)
    notesParts.push(...checklistProblems)
    const payload:any={
      vehicle_id:selectedVozilo.id, service_type:form.service_type, service_date:form.service_date,
      mileage_at_service:form.mileage_at_service?parseInt(form.mileage_at_service):null,
      description:form.description||null, cost:form.cost?parseFloat(form.cost):null,
      performed_by:form.performed_by||agentName||null, external_shop:form.external_shop||null,
      next_service_date:form.next_service_date||null, next_service_mileage:form.next_service_mileage?parseInt(form.next_service_mileage):null,
      status:form.status, priority:form.priority, notes:notesParts.join(' | ')||null, receipt_url:form.receipt_url||null,
    }
    if(form.service_type==='gume'){payload.tyre_brand=form.tyre_brand||null;payload.tyre_size=form.tyre_size||null;payload.tyre_season=form.tyre_season||null;payload.tyre_price=form.tyre_price?parseFloat(form.tyre_price):null}
    const {error}=await supabase.from('vehicle_services').insert([payload])
    if(error){alert('Greška: '+error.message);setSaving(false);return}
    const fu:any={}
    if(form.remove_from_calendar||!form.can_be_rented){fu.fleet_status='service_other';fu.is_available=false}
    if(form.mileage_at_service) fu.current_mileage=parseInt(form.mileage_at_service)
    if(Object.keys(fu).length>0) await supabase.from('vozila_fleet').update(fu).eq('id',selectedVozilo.id)
    setSaving(false);setForm(emptyForm);setVoziloTab('istorija');fetchAll()
  }

  async function saveEdit(){
    if(!selectedServis) return; setEditSaving(true)
    const updates:any={
      service_type:editForm.service_type, service_date:editForm.service_date,
      mileage_at_service:editForm.mileage_at_service?parseInt(editForm.mileage_at_service):null,
      description:editForm.description||null, cost:editForm.cost?parseFloat(editForm.cost):null,
      performed_by:editForm.performed_by||null, external_shop:editForm.external_shop||null,
      next_service_date:editForm.next_service_date||null, next_service_mileage:editForm.next_service_mileage?parseInt(editForm.next_service_mileage):null,
      status:editForm.status, notes:editForm.notes||null, priority:editForm.priority||'normal',
      receipt_url:editForm.receipt_url||null, tyre_brand:editForm.tyre_brand||null, tyre_size:editForm.tyre_size||null,
      tyre_season:editForm.tyre_season||null, tyre_price:editForm.tyre_price?parseFloat(editForm.tyre_price):null,
    }
    const {error}=await supabase.from('vehicle_services').update(updates).eq('id',selectedServis.id)
    if(error){alert('Greška: '+error.message);setEditSaving(false);return}
    if(editForm.status==='completed') await supabase.from('vozila_fleet').update({fleet_status:'available',is_available:true}).eq('id',selectedServis.vehicle_id)
    setEditMode(false);setSelectedServis(null);setEditSaving(false);fetchAll()
  }

  async function deleteServis(id:string){
    if(!confirm('Obrisati?')) return
    await supabase.from('vehicle_services').delete().eq('id',id)
    setSelectedServis(null);fetchAll()
  }

  async function saveRegistracija(){
    if(!selectedVozilo) return
    if(!regForm.license_plate||!regForm.istek_reg){alert('Unesite tablice i datum isteka!');return}
    setRegSaving(true)
    await supabase.from('vehicle_reg_history').insert([{vehicle_id:selectedVozilo.id,license_plate:selectedVozilo.license_plate,istek_reg:selectedVozilo.istek_reg,mjesto_reg:selectedVozilo.mjesto_reg,datum_registracije:regForm.datum_registracije,napomena:`[Arhivirano] ${regForm.napomena||''}`.trim(),created_by:agentName||'Agent'}])
    const noviAgr=`${selectedVozilo.marka} ${selectedVozilo.model} ${regForm.license_plate} ${selectedVozilo.year||''} ${selectedVozilo.transmission==='automatic'?'AUTOMATIC':'MANUAL'}`.trim()
    await supabase.from('vozila_fleet').update({license_plate:regForm.license_plate,istek_reg:regForm.istek_reg,mjesto_reg:regForm.mjesto_reg||selectedVozilo.mjesto_reg,stare_tablice:selectedVozilo.license_plate!==regForm.license_plate?selectedVozilo.license_plate:selectedVozilo.stare_tablice,agregirani_2:noviAgr,name:noviAgr}).eq('id',selectedVozilo.id)
    await supabase.from('vehicle_reg_history').insert([{vehicle_id:selectedVozilo.id,license_plate:regForm.license_plate,istek_reg:regForm.istek_reg,mjesto_reg:regForm.mjesto_reg,datum_registracije:regForm.datum_registracije,napomena:regForm.napomena||null,created_by:agentName||'Agent'}])
    setRegSaving(false);setRegFormMode('view');await loadRegHistory(selectedVozilo.id);fetchAll()
  }

  async function saveServiser(){
    if(!serviserForm.full_name){alert('Unesite ime!');return}; setServiserSaving(true)
    const payload={full_name:serviserForm.full_name,phone:serviserForm.phone||null,portal_email:serviserForm.portal_email||null,is_active:serviserForm.is_active,bonus_per_service:serviserForm.bonus_per_service?parseFloat(serviserForm.bonus_per_service):null,bonus_per_repair:serviserForm.bonus_per_repair?parseFloat(serviserForm.bonus_per_repair):null,salary:serviserForm.salary?parseFloat(serviserForm.salary):null,notes:serviserForm.notes||null}
    if(editServiser) await supabase.from('technicians').update(payload).eq('id',editServiser.id)
    else await supabase.from('technicians').insert([payload])
    setServiserSaving(false);setShowServiserForm(false);setEditServiser(null)
    setServiserForm({full_name:'',phone:'',portal_email:'',is_active:true,bonus_per_service:'',bonus_per_repair:'',salary:'',notes:''})
    fetchAll()
  }

  const inp:React.CSSProperties={width:'100%',padding:'8px 10px',fontSize:12,border:'1px solid #d1d5db',borderRadius:6,color:'#111',background:'#fff',boxSizing:'border-box'}
  const lbl:React.CSSProperties={fontSize:11,color:'#6b7280',display:'block',marginBottom:3,fontWeight:500}
  const totalAktivnih=servisi.filter(s=>s.status==='in_progress'||s.status==='pending').length
  const regIstekla=(selectedVozilo?.dana_do_isteka??1)<=0&&selectedVozilo?.dana_do_isteka!==null&&selectedVozilo?.dana_do_isteka!==undefined
  const regSkoro=(selectedVozilo?.dana_do_isteka??100)>0&&(selectedVozilo?.dana_do_isteka??100)<=30&&selectedVozilo?.dana_do_isteka!==null&&selectedVozilo?.dana_do_isteka!==undefined

  return (
    <div>
      {/* HEADER */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
        <div>
          <h1 style={{fontSize:20,fontWeight:600,color:'#111',margin:0}}>Servis vozila</h1>
          <div style={{fontSize:12,color:'#6b7280',marginTop:3}}>
            {vozila.length} vozila · {serviseri.filter(s=>s.is_active).length} servisera
            {totalAktivnih>0&&<span style={{color:'#d97706',fontWeight:600,marginLeft:8}}>· {totalAktivnih} aktivnih</span>}
          </div>
        </div>
        {mainTab==='serviseri'&&(
          <button onClick={()=>{setShowServiserForm(s=>!s);setEditServiser(null)}}
            style={{padding:'7px 14px',background:showServiserForm?'#f3f4f6':'#1D9E75',color:showServiserForm?'#374151':'#fff',border:'none',borderRadius:8,fontSize:12,fontWeight:600,cursor:'pointer'}}>
            {showServiserForm?'Zatvori':'+ Novi serviser'}
          </button>
        )}
      </div>

      {/* MAIN TABS */}
      <div style={{display:'flex',gap:0,marginBottom:20,borderBottom:'2px solid #f3f4f6'}}>
        {[{id:'vozila' as MainTab,label:'🚗 Vozila'},{id:'serviseri' as MainTab,label:`🔧 Serviseri (${serviseri.filter(s=>s.is_active).length})`}].map(t=>(
          <button key={t.id} onClick={()=>setMainTab(t.id)}
            style={{padding:'8px 18px',fontSize:13,border:'none',background:'none',cursor:'pointer',fontWeight:mainTab===t.id?600:400,color:mainTab===t.id?'#111':'#9ca3af',borderBottom:mainTab===t.id?'2px solid #111':'2px solid transparent',marginBottom:-2}}>
            {t.label}
          </button>
        ))}
      </div>

      {mainTab==='vozila'&&(
        <div>
          {/* SEARCH PANEL */}
          <div style={{background:'#fff',border:'1px solid #e5e7eb',borderRadius:12,padding:'16px 20px',marginBottom:16}}>
            <div style={{fontSize:13,fontWeight:600,color:'#374151',marginBottom:12}}>🔍 Odaberi vozilo</div>
            <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'flex-start'}}>
              <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                {lokacije.map(l=>(
                  <button key={l} onClick={()=>setFilterLok(l)}
                    style={{padding:'6px 12px',fontSize:11,border:`1px solid ${filterLok===l?'#1D9E75':'#e5e7eb'}`,borderRadius:20,background:filterLok===l?'#E1F5EE':'#fff',color:filterLok===l?'#085041':'#6b7280',cursor:'pointer',fontWeight:filterLok===l?700:400}}>
                    {l==='sve'?'Sve lokacije':l}
                  </button>
                ))}
              </div>
              <div style={{flex:1,minWidth:260,position:'relative'}}>
                <input value={search} onChange={e=>{setSearch(e.target.value);setShowDropdown(true);if(!e.target.value)setSelectedVozilo(null)}} onFocus={()=>setShowDropdown(true)}
                  placeholder="Pretraži po tablicama, nazivu vozila..."
                  style={{...inp,fontSize:14,padding:'10px 14px',borderRadius:10,borderColor:selectedVozilo?'#1D9E75':'#d1d5db'}} />
                {showDropdown&&search.length>0&&(
                  <div style={{position:'absolute',top:'100%',left:0,right:0,background:'#fff',border:'1px solid #d1d5db',borderRadius:10,boxShadow:'0 8px 24px rgba(0,0,0,0.12)',zIndex:50,maxHeight:320,overflowY:'auto',marginTop:4}}>
                    {searchResults.length===0?<div style={{padding:'12px 14px',fontSize:12,color:'#9ca3af'}}>Nema rezultata.</div>:searchResults.map(v=>{
                      const aktivan=getAktivan(v.id); const brS=getVoziloServisi(v.id).length
                      const ist=(v.dana_do_isteka??1)<=0&&v.dana_do_isteka!==null&&v.dana_do_isteka!==undefined
                      const sk=(v.dana_do_isteka??100)>0&&(v.dana_do_isteka??100)<=30&&v.dana_do_isteka!==null
                      return (
                        <div key={v.id} onClick={()=>selectVozilo(v)}
                          style={{padding:'10px 14px',cursor:'pointer',borderBottom:'1px solid #f3f4f6',display:'flex',justifyContent:'space-between',alignItems:'center'}}
                          onMouseEnter={e=>(e.currentTarget.style.background='#f0fdf8')} onMouseLeave={e=>(e.currentTarget.style.background='#fff')}>
                          <div>
                            <div style={{fontWeight:600,fontSize:13,color:'#111'}}>{v.agregirani_2||`${v.marka} ${v.model}`}</div>
                            <div style={{fontSize:11,color:'#9ca3af',display:'flex',gap:8,marginTop:2}}>
                              <span style={{fontFamily:'monospace',fontWeight:700}}>{v.license_plate}</span>
                              <span>📍 {v.lokacija}</span>
                              {v.current_mileage&&<span>📏 {v.current_mileage.toLocaleString()} km</span>}
                            </div>
                          </div>
                          <div style={{display:'flex',gap:5,alignItems:'center'}}>
                            {ist&&<span style={{fontSize:9,background:'#FEE2E2',color:'#DC2626',padding:'1px 6px',borderRadius:20,fontWeight:700}}>🚫 Reg.</span>}
                            {sk&&!ist&&<span style={{fontSize:9,background:'#FAEEDA',color:'#BA7517',padding:'1px 6px',borderRadius:20,fontWeight:700}}>⚠️ Reg.</span>}
                            {aktivan&&<span style={{fontSize:9,background:'#FAEEDA',color:'#633806',padding:'1px 5px',borderRadius:20,fontWeight:700}}>Servis</span>}
                            {brS>0&&<span style={{fontSize:10,color:'#9ca3af',background:'#f3f4f6',padding:'1px 6px',borderRadius:10}}>{brS}</span>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
              {selectedVozilo&&<button onClick={()=>{setSelectedVozilo(null);setSearch('')}} style={{padding:'10px 14px',border:'1px solid #e5e7eb',borderRadius:10,background:'#f9fafb',fontSize:12,cursor:'pointer',color:'#6b7280'}}>✕ Poništi</button>}
            </div>
            {!selectedVozilo&&!loading&&(
              <div style={{display:'flex',gap:16,marginTop:14,flexWrap:'wrap'}}>
                {[{label:'Ukupno vozila',val:vozila.length,color:'#374151'},{label:'Aktivni servisi',val:totalAktivnih,color:'#d97706'},{label:'Istekla reg.',val:vozila.filter(v=>(v.dana_do_isteka??1)<=0&&v.dana_do_isteka!==null&&v.dana_do_isteka!==undefined).length,color:'#DC2626'},{label:'Reg. ≤30 dana',val:vozila.filter(v=>(v.dana_do_isteka??100)>0&&(v.dana_do_isteka??100)<=30&&v.dana_do_isteka!==null).length,color:'#BA7517'}].map(s=>(
                  <div key={s.label} style={{textAlign:'center',padding:'8px 16px',background:'#f9fafb',borderRadius:10,minWidth:90}}>
                    <div style={{fontSize:20,fontWeight:700,color:s.color}}>{s.val}</div>
                    <div style={{fontSize:11,color:'#9ca3af'}}>{s.label}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* VOZILO PANEL */}
          {selectedVozilo&&(
            <div>
              {/* Header */}
              <div style={{background:'#fff',border:'1px solid #e5e7eb',borderRadius:'12px 12px 0 0',padding:'14px 20px',borderBottom:'none'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:10}}>
                  <div>
                    <div style={{fontWeight:700,fontSize:17,color:'#111'}}>{selectedVozilo.agregirani_2}</div>
                    <div style={{fontSize:12,color:'#6b7280',marginTop:4,display:'flex',gap:12,flexWrap:'wrap',alignItems:'center'}}>
                      <span style={{fontFamily:'monospace',fontWeight:700,fontSize:13,background:'#f3f4f6',padding:'1px 8px',borderRadius:4}}>{selectedVozilo.license_plate}</span>
                      <span>📍 {selectedVozilo.lokacija}</span>
                      {selectedVozilo.current_mileage&&<span>📏 {selectedVozilo.current_mileage.toLocaleString()} km</span>}
                      <span style={{background:selectedVozilo.fleet_status.startsWith('service')?'#FAEEDA':'#E1F5EE',color:selectedVozilo.fleet_status.startsWith('service')?'#633806':'#085041',padding:'1px 8px',borderRadius:20,fontSize:11,fontWeight:600}}>{selectedVozilo.fleet_status}</span>
                      {!selectedVozilo.is_available&&<span style={{fontSize:11,color:'#dc2626',fontWeight:600}}>⛔ Van kalendara</span>}
                    </div>
                  </div>
                  <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
                    {selectedVozilo.istek_reg&&(
                      <div style={{padding:'6px 12px',borderRadius:10,background:regIstekla?'#FEE2E2':regSkoro?'#FAEEDA':'#E1F5EE',border:`1px solid ${regIstekla?'#DC2626':regSkoro?'#EF9F27':'#5DCAA5'}`,fontSize:12}}>
                        <span style={{color:regIstekla?'#DC2626':regSkoro?'#BA7517':'#085041',fontWeight:700}}>
                          📋 Reg: {selectedVozilo.istek_reg}
                          {selectedVozilo.dana_do_isteka!==null&&selectedVozilo.dana_do_isteka!==undefined&&<span style={{marginLeft:6,fontWeight:400}}>{regIstekla?'(istekla!)':`(${Math.round(selectedVozilo.dana_do_isteka!)}d)`}</span>}
                        </span>
                      </div>
                    )}
                    <div style={{fontSize:12,color:'#9ca3af'}}>{getVoziloServisi(selectedVozilo.id).length} servisnih zapisa</div>
                  </div>
                </div>
              </div>

              {/* Tabovi */}
              <div style={{background:'#fff',borderLeft:'1px solid #e5e7eb',borderRight:'1px solid #e5e7eb',display:'flex',gap:0,borderBottom:'2px solid #f3f4f6'}}>
                {[
                  {id:'servis' as VoziloTab,label:'🔧 Servis',badge:getVoziloServisi(selectedVozilo.id).filter(s=>s.status==='in_progress'||s.status==='pending').length||null,badgeColor:''},
                  {id:'registracija' as VoziloTab,label:'📋 Registracija',badge:regIstekla?'!':null,badgeColor:'#DC2626'},
                  {id:'istorija' as VoziloTab,label:'📜 Istorija',badge:getVoziloServisi(selectedVozilo.id).length||null,badgeColor:''},
                  {id:'nova' as VoziloTab,label:'+ Novi servis',badge:null,badgeColor:''},
                ].map(t=>(
                  <button key={t.id} onClick={()=>handleTabChange(t.id)}
                    style={{padding:'10px 18px',fontSize:12,border:'none',background:'none',cursor:'pointer',fontWeight:voziloTab===t.id?600:400,color:voziloTab===t.id?'#111':'#9ca3af',borderBottom:voziloTab===t.id?'2px solid #111':'2px solid transparent',marginBottom:-2,display:'flex',gap:6,alignItems:'center'}}>
                    {t.label}
                    {t.badge?<span style={{fontSize:10,background:t.badgeColor||'#e5e7eb',color:t.badgeColor?'#fff':'#374151',padding:'1px 6px',borderRadius:10,fontWeight:700}}>{t.badge}</span>:null}
                  </button>
                ))}
              </div>

              {/* Panel sadržaj */}
              <div style={{background:'#fff',border:'1px solid #e5e7eb',borderTop:'none',borderRadius:'0 0 12px 12px',padding:'20px'}}>

                {/* SERVIS TAB */}
                {voziloTab==='servis'&&(()=>{
                  const aktivni=getVoziloServisi(selectedVozilo.id).filter(s=>s.status==='pending'||s.status==='in_progress')
                  if(aktivni.length===0) return (
                    <div style={{textAlign:'center',padding:40,color:'#9ca3af',border:'1px dashed #e5e7eb',borderRadius:10,fontSize:13}}>
                      Nema aktivnih servisa.
                      <button onClick={()=>handleTabChange('nova')} style={{display:'block',margin:'10px auto 0',background:'none',border:'none',color:'#1D9E75',cursor:'pointer',fontWeight:600,fontSize:13}}>+ Dodaj novi →</button>
                    </div>
                  )
                  return (<div>
                    <div style={{fontSize:12,fontWeight:600,color:'#374151',marginBottom:12}}>Aktivni servisi ({aktivni.length})</div>
                    {aktivni.map(s=>{
                      const st=STATUS_CFG[s.status]; const tip=SERVICE_TYPES.find(t=>t.key===s.service_type); const pr=PRIORITY_CFG[s.priority||'normal']
                      return (
                        <div key={s.id} style={{background:'#fffbeb',border:'2px solid #fbbf24',borderRadius:10,padding:'12px 16px',marginBottom:10}}>
                          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                            <div style={{display:'flex',gap:10,alignItems:'center'}}>
                              <span style={{fontSize:22}}>{tip?.icon}</span>
                              <div>
                                <div style={{fontWeight:700,fontSize:14,color:'#111'}}>{tip?.label}</div>
                                <div style={{fontSize:11,color:'#9ca3af'}}>{s.service_date} · {s.performed_by||'Nije dodijeljeno'}</div>
                              </div>
                            </div>
                            <div style={{display:'flex',gap:8,alignItems:'center'}}>
                              {s.priority&&s.priority!=='normal'&&<span style={{fontSize:11,color:pr.color,fontWeight:700}}>{pr.label}</span>}
                              <span style={{fontSize:11,background:st.bg,color:st.color,padding:'3px 10px',borderRadius:20,fontWeight:600}}>{st.label}</span>
                            </div>
                          </div>
                          {s.description&&<div style={{fontSize:12,color:'#6b7280',marginTop:8,padding:'6px 10px',background:'#fff',borderRadius:6}}>{s.description}</div>}
                          {s.cost&&<div style={{fontSize:13,fontWeight:700,color:'#1D9E75',marginTop:6}}>{s.cost}€</div>}
                          <div style={{display:'flex',gap:8,marginTop:10}}>
                            <button onClick={()=>{setVoziloTab('istorija');setSelectedServis(s);setEditMode(true);setEditForm({...s,priority:s.priority||'normal'})}} style={{padding:'6px 14px',fontSize:11,border:'1px solid #d1d5db',borderRadius:8,background:'#fff',cursor:'pointer',color:'#374151',fontWeight:600}}>✏️ Uredi</button>
                            <button onClick={async()=>{await supabase.from('vehicle_services').update({status:'completed'}).eq('id',s.id);await supabase.from('vozila_fleet').update({fleet_status:'available',is_available:true}).eq('id',selectedVozilo.id);fetchAll()}} style={{padding:'6px 14px',fontSize:11,border:'1px solid #1D9E75',borderRadius:8,background:'#E1F5EE',cursor:'pointer',color:'#085041',fontWeight:600}}>✓ Završi</button>
                          </div>
                        </div>
                      )
                    })}
                  </div>)
                })()}

                {/* REGISTRACIJA TAB */}
                {voziloTab==='registracija'&&(
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>
                    <div>
                      <div style={{background:regIstekla?'#FEE2E2':regSkoro?'#FAEEDA':'#f0fdf8',border:`1px solid ${regIstekla?'#DC2626':regSkoro?'#EF9F27':'#5DCAA5'}`,borderRadius:10,padding:'14px 16px',marginBottom:16}}>
                        <div style={{fontSize:12,fontWeight:700,color:regIstekla?'#DC2626':regSkoro?'#BA7517':'#085041',marginBottom:10}}>
                          {regIstekla?'🚫 Registracija istekla!':regSkoro?'⚠️ Registracija uskoro ističe':'✅ Registracija uredna'}
                        </div>
                        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,fontSize:12}}>
                          {[['Tablice',selectedVozilo.license_plate||'—'],['Istek reg.',selectedVozilo.istek_reg||'—'],['Mjesto reg.',selectedVozilo.mjesto_reg||'—'],['Dana do isteka',selectedVozilo.dana_do_isteka!==null&&selectedVozilo.dana_do_isteka!==undefined?`${Math.round(selectedVozilo.dana_do_isteka!)} dana`:'—'],['Vlasnik',selectedVozilo.vlasnik||'—'],['Stare tablice',selectedVozilo.stare_tablice||'—']].map(([l,v])=>(
                            <div key={l}><div style={{fontSize:10,color:'#9ca3af',fontWeight:700,textTransform:'uppercase'}}>{l}</div><div style={{fontWeight:600,color:'#111'}}>{v}</div></div>
                          ))}
                        </div>
                      </div>
                      {regFormMode==='view'?(
                        <button onClick={()=>setRegFormMode('edit')} style={{width:'100%',padding:'10px',background:'#1D9E75',color:'#fff',border:'none',borderRadius:8,fontSize:13,fontWeight:600,cursor:'pointer'}}>📋 Unesi novu registraciju</button>
                      ):(
                        <div style={{border:'1px solid #e5e7eb',borderRadius:10,padding:16}}>
                          <div style={{fontSize:13,fontWeight:700,color:'#111',marginBottom:14}}>Nova registracija</div>
                          <div style={{background:'#E6F1FB',border:'1px solid #85B7EB',borderRadius:8,padding:'8px 12px',marginBottom:14,fontSize:11,color:'#0C447C'}}>Stari podaci bit će arhivirani.</div>
                          <div style={{marginBottom:10}}>
                            <label style={lbl}>Registarske tablice *</label>
                            <input style={{...inp,fontFamily:'monospace',fontWeight:700,fontSize:14,letterSpacing:1}} value={regForm.license_plate} onChange={e=>setRegForm(f=>({...f,license_plate:e.target.value.toUpperCase()}))} placeholder="PG-AA111" />
                            {selectedVozilo.license_plate&&regForm.license_plate!==selectedVozilo.license_plate&&regForm.license_plate&&(
                              <div style={{marginTop:4,fontSize:11,color:'#185FA5',background:'#E6F1FB',padding:'3px 8px',borderRadius:6}}>ℹ️ Mijenjaju se: {selectedVozilo.license_plate} → {regForm.license_plate}</div>
                            )}
                          </div>
                          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
                            <div><label style={lbl}>Istek registracije *</label><input style={inp} value={regForm.istek_reg} onChange={e=>setRegForm(f=>({...f,istek_reg:e.target.value}))} placeholder="15.06.2027." /></div>
                            <div><label style={lbl}>Datum registracije</label><input type="date" style={inp} value={regForm.datum_registracije} onChange={e=>setRegForm(f=>({...f,datum_registracije:e.target.value}))} /></div>
                          </div>
                          <div style={{marginBottom:10}}><label style={lbl}>Mjesto registracije</label><input style={inp} value={regForm.mjesto_reg} onChange={e=>setRegForm(f=>({...f,mjesto_reg:e.target.value}))} placeholder="Podgorica" /></div>
                          <div style={{marginBottom:16}}><label style={lbl}>Napomena</label><textarea style={{...inp,minHeight:50,resize:'vertical' as const}} value={regForm.napomena} onChange={e=>setRegForm(f=>({...f,napomena:e.target.value}))} /></div>
                          <div style={{display:'flex',gap:8}}>
                            <button onClick={()=>setRegFormMode('view')} style={{flex:1,padding:'9px',border:'1px solid #e5e7eb',borderRadius:8,background:'transparent',fontSize:12,cursor:'pointer',color:'#374151'}}>Odustani</button>
                            <button onClick={saveRegistracija} disabled={regSaving||!regForm.license_plate||!regForm.istek_reg}
                              style={{flex:2,padding:'9px',background:regSaving?'#5DCAA5':!regForm.license_plate||!regForm.istek_reg?'#9ca3af':'#1D9E75',color:'#fff',border:'none',borderRadius:8,fontSize:13,fontWeight:700,cursor:'pointer'}}>
                              {regSaving?'⏳ Snimanje...':'💾 Snimi registraciju'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                    <div>
                      <div style={{fontSize:12,fontWeight:700,color:'#374151',marginBottom:12}}>📜 Istorija registracija</div>
                      {regHistoryLoading?<div style={{padding:20,textAlign:'center',color:'#9ca3af',fontSize:12}}>Učitavanje...</div>
                        :regHistory.length===0?<div style={{padding:20,textAlign:'center',color:'#9ca3af',fontSize:12,border:'1px dashed #e5e7eb',borderRadius:10}}>Nema historije.</div>
                        :<div style={{display:'flex',flexDirection:'column',gap:8}}>
                          {regHistory.map((r,i)=>(
                            <div key={r.id} style={{border:`1px solid ${i===0?'#1D9E75':'#e5e7eb'}`,borderRadius:10,padding:'10px 14px',background:i===0?'#f0fdf8':'#fff'}}>
                              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
                                <div style={{display:'flex',gap:8,alignItems:'center'}}>
                                  {i===0&&<span style={{fontSize:10,background:'#E1F5EE',color:'#085041',padding:'1px 7px',borderRadius:20,fontWeight:700}}>Zadnji</span>}
                                  <span style={{fontFamily:'monospace',fontSize:13,fontWeight:700,color:'#111'}}>{r.license_plate||'—'}</span>
                                </div>
                                <span style={{fontSize:11,color:'#9ca3af'}}>{new Date(r.created_at).toLocaleDateString('sr-RS')}</span>
                              </div>
                              <div style={{display:'flex',gap:12,fontSize:11,color:'#6b7280',flexWrap:'wrap'}}>
                                {r.istek_reg&&<span>Istek: <strong style={{color:'#374151'}}>{r.istek_reg}</strong></span>}
                                {r.mjesto_reg&&<span>Mjesto: <strong style={{color:'#374151'}}>{r.mjesto_reg}</strong></span>}
                                {r.datum_registracije&&<span>Datum: <strong style={{color:'#374151'}}>{r.datum_registracije}</strong></span>}
                              </div>
                              {r.napomena&&<div style={{marginTop:4,fontSize:10,color:'#9ca3af',fontStyle:'italic'}}>{r.napomena}</div>}
                              {r.created_by&&<div style={{marginTop:3,fontSize:10,color:'#d1d5db'}}>👤 {r.created_by}</div>}
                            </div>
                          ))}
                        </div>
                      }
                    </div>
                  </div>
                )}

                {/* ISTORIJA TAB */}
                {voziloTab==='istorija'&&(
                  <div>
                    <div style={{display:'flex',gap:6,marginBottom:14,flexWrap:'wrap'}}>
                      {[['all','Svi'],['active','Aktivni'],['done','Završeni']].map(([val,label])=>(
                        <button key={val} onClick={()=>setFilterStatus(val)}
                          style={{padding:'4px 12px',fontSize:11,border:`1px solid ${filterStatus===val?'#1D9E75':'#e5e7eb'}`,borderRadius:20,background:filterStatus===val?'#E1F5EE':'#fff',color:filterStatus===val?'#085041':'#6b7280',cursor:'pointer',fontWeight:filterStatus===val?600:400}}>
                          {label}
                        </button>
                      ))}
                      <select value={filterType} onChange={e=>setFilterType(e.target.value)} style={{padding:'4px 10px',fontSize:11,border:'1px solid #e5e7eb',borderRadius:20,background:'#fff',color:'#6b7280',cursor:'pointer'}}>
                        <option value="">Svi tipovi</option>
                        {SERVICE_TYPES.map(t=><option key={t.key} value={t.key}>{t.icon} {t.label}</option>)}
                      </select>
                    </div>
                    {filteredServisi.length===0?(
                      <div style={{textAlign:'center',padding:40,color:'#9ca3af',border:'1px dashed #e5e7eb',borderRadius:10,fontSize:13}}>
                        Nema zapisa. <button onClick={()=>handleTabChange('nova')} style={{background:'none',border:'none',color:'#1D9E75',cursor:'pointer',fontWeight:600}}>Dodaj →</button>
                      </div>
                    ):(
                      <div style={{display:'grid',gridTemplateColumns:selectedServis?'1fr 360px':'1fr',gap:16,alignItems:'start'}}>
                        <div>
                          {filteredServisi.map(s=>{
                            const st=STATUS_CFG[s.status]||STATUS_CFG.pending; const tip=SERVICE_TYPES.find(t=>t.key===s.service_type)
                            const pr=PRIORITY_CFG[s.priority||'normal']||PRIORITY_CFG.normal; const isSel=selectedServis?.id===s.id
                            const hasProblems=s.notes?.includes('❌')
                            return (
                              <div key={s.id} onClick={()=>{setSelectedServis(isSel?null:s);setEditMode(false);setEditForm({...s,priority:s.priority||'normal'})}}
                                style={{background:'#fff',border:`2px solid ${isSel?'#1D9E75':hasProblems?'#fecaca':'#e5e7eb'}`,borderRadius:10,padding:'10px 14px',marginBottom:8,cursor:'pointer'}}>
                                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                                  <div style={{display:'flex',gap:8,alignItems:'center'}}>
                                    <span style={{fontSize:18}}>{tip?.icon}</span>
                                    <div><div style={{fontWeight:600,fontSize:13,color:'#111'}}>{tip?.label}</div><div style={{fontSize:11,color:'#9ca3af'}}>{s.service_date}</div></div>
                                  </div>
                                  <div style={{display:'flex',gap:6,alignItems:'center'}}>
                                    {s.priority&&s.priority!=='normal'&&<span style={{fontSize:11,color:pr.color,fontWeight:600}}>{pr.label}</span>}
                                    {s.cost&&<span style={{fontSize:13,fontWeight:700,color:'#1D9E75'}}>{s.cost}€</span>}
                                    <span style={{fontSize:11,background:st.bg,color:st.color,padding:'2px 8px',borderRadius:20,fontWeight:500}}>{st.label}</span>
                                  </div>
                                </div>
                                {s.service_type==='gume'&&s.tyre_brand&&<div style={{fontSize:11,color:'#374151',marginTop:4}}>🛞 {s.tyre_brand} {s.tyre_size} · {s.tyre_season}</div>}
                                {s.description&&<div style={{fontSize:11,color:'#6b7280',marginTop:4}}>{s.description}</div>}
                                {hasProblems&&<div style={{fontSize:11,color:'#dc2626',background:'#fff5f5',borderRadius:6,padding:'3px 8px',marginTop:4}}>{s.notes?.split(' | ').filter((n:string)=>n.includes('❌')).join(' ')}</div>}
                                <div style={{fontSize:10,color:'#9ca3af',display:'flex',gap:10,flexWrap:'wrap',marginTop:4}}>
                                  {s.mileage_at_service&&<span>📏 {s.mileage_at_service.toLocaleString()} km</span>}
                                  {s.performed_by&&<span>👤 {s.performed_by}</span>}
                                  {s.next_service_date&&<span>📅 Sljedeći: {s.next_service_date}</span>}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                        {selectedServis&&(
                          <div style={{background:'#fff',border:'1px solid #e5e7eb',borderRadius:10,padding:16,alignSelf:'start',position:'sticky',top:20}}>
                            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
                              <div style={{fontWeight:700,fontSize:14}}>{SERVICE_TYPES.find(t=>t.key===selectedServis.service_type)?.icon} {SERVICE_TYPES.find(t=>t.key===selectedServis.service_type)?.label}</div>
                              <button onClick={()=>setSelectedServis(null)} style={{background:'none',border:'none',fontSize:18,cursor:'pointer',color:'#9ca3af'}}>✕</button>
                            </div>
                            {!editMode?(
                              <>
                                {[['Datum',selectedServis.service_date],['Status',STATUS_CFG[selectedServis.status]?.label],['Prioritet',PRIORITY_CFG[selectedServis.priority||'normal']?.label],['Kilometraža',selectedServis.mileage_at_service?`${selectedServis.mileage_at_service.toLocaleString()} km`:null],['Opis',selectedServis.description],['Ko je radio',selectedServis.performed_by],['Radionica',selectedServis.external_shop],['Cijena',selectedServis.cost?`${selectedServis.cost}€`:null],['Brend guma',selectedServis.tyre_brand],['Veličina',selectedServis.tyre_size],['Sezona',selectedServis.tyre_season],['Sljedeći',selectedServis.next_service_date]].filter(([,v])=>v).map(([l,v])=>(
                                  <div key={l as string} style={{display:'flex',justifyContent:'space-between',padding:'5px 0',borderBottom:'1px solid #f3f4f6',fontSize:12}}>
                                    <span style={{color:'#9ca3af'}}>{l}</span><span style={{color:'#111',textAlign:'right',maxWidth:200}}>{v}</span>
                                  </div>
                                ))}
                                {selectedServis.receipt_url&&<div style={{marginTop:8}}><a href={selectedServis.receipt_url} target="_blank" rel="noreferrer" style={{fontSize:12,padding:'6px 12px',background:'#eff6ff',color:'#185FA5',borderRadius:8,textDecoration:'none',fontWeight:600}}>📄 Otvori račun</a></div>}
                                {selectedServis.notes&&<div style={{marginTop:8}}>{selectedServis.notes.split(' | ').filter((n:string)=>!n.includes('❌')).map((n:string,i:number)=>n&&<div key={i} style={{background:'#f9fafb',borderRadius:6,padding:'4px 8px',fontSize:11,color:'#374151',marginBottom:3}}>📝 {n}</div>)}{selectedServis.notes.split(' | ').filter((n:string)=>n.includes('❌')).map((n:string,i:number)=><div key={i} style={{fontSize:11,color:'#dc2626',background:'#fff5f5',borderRadius:6,padding:'2px 8px',marginBottom:2}}>{n}</div>)}</div>}
                                <div style={{display:'flex',gap:6,marginTop:12}}>
                                  <button onClick={()=>setEditMode(true)} style={{flex:1,padding:'7px',fontSize:11,border:'1px solid #d1d5db',borderRadius:8,background:'#fff',cursor:'pointer',color:'#374151'}}>✏️ Uredi</button>
                                  <button onClick={()=>deleteServis(selectedServis.id)} style={{padding:'7px 10px',fontSize:11,border:'1px solid #fecaca',borderRadius:8,background:'#fff',cursor:'pointer',color:'#dc2626'}}>🗑️</button>
                                </div>
                              </>
                            ):(
                              <div>
                                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
                                  <div><label style={lbl}>Tip</label><select value={editForm.service_type} onChange={e=>setEditForm((f:any)=>({...f,service_type:e.target.value}))} style={inp}>{SERVICE_TYPES.map(t=><option key={t.key} value={t.key}>{t.icon} {t.label}</option>)}</select></div>
                                  <div><label style={lbl}>Status</label><select value={editForm.status} onChange={e=>setEditForm((f:any)=>({...f,status:e.target.value}))} style={inp}>{Object.entries(STATUS_CFG).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select></div>
                                  <div><label style={lbl}>Datum</label><input type="date" value={editForm.service_date||''} onChange={e=>setEditForm((f:any)=>({...f,service_date:e.target.value}))} style={inp} /></div>
                                  <div><label style={lbl}>Cijena (€)</label><input type="number" value={editForm.cost||''} onChange={e=>setEditForm((f:any)=>({...f,cost:e.target.value}))} style={inp} /></div>
                                  <div><label style={lbl}>Km</label><input type="number" value={editForm.mileage_at_service||''} onChange={e=>setEditForm((f:any)=>({...f,mileage_at_service:e.target.value}))} style={inp} /></div>
                                  <div><label style={lbl}>Ko je radio</label><input list="se-edit" value={editForm.performed_by||''} onChange={e=>setEditForm((f:any)=>({...f,performed_by:e.target.value}))} style={inp} /><datalist id="se-edit">{serviseri.filter(s=>s.is_active).map(s=><option key={s.id} value={s.full_name}/>)}</datalist></div>
                                </div>
                                <div style={{marginBottom:8}}><label style={lbl}>Opis</label><textarea value={editForm.description||''} onChange={e=>setEditForm((f:any)=>({...f,description:e.target.value}))} style={{...inp,minHeight:50,resize:'vertical' as const}} /></div>
                                <div style={{marginBottom:10}}><label style={lbl}>Napomena</label><textarea value={editForm.notes||''} onChange={e=>setEditForm((f:any)=>({...f,notes:e.target.value}))} style={{...inp,minHeight:40,resize:'vertical' as const}} /></div>
                                <div style={{display:'flex',gap:8}}>
                                  <button onClick={()=>setEditMode(false)} style={{flex:1,padding:8,border:'1px solid #d1d5db',borderRadius:8,background:'transparent',fontSize:12,cursor:'pointer'}}>Odustani</button>
                                  <button onClick={saveEdit} disabled={editSaving} style={{flex:2,padding:8,background:'#1D9E75',color:'#fff',border:'none',borderRadius:8,fontSize:12,fontWeight:600,cursor:'pointer'}}>{editSaving?'⏳...':'💾 Sačuvaj'}</button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* NOVA FORMA TAB */}
                {voziloTab==='nova'&&(
                  <div style={{maxWidth:720}}>
                    <div style={{marginBottom:14}}>
                      <label style={lbl}>Tip servisa *</label>
                      <div style={{display:'grid',gridTemplateColumns:'repeat(7, 1fr)',gap:6}}>
                        {SERVICE_TYPES.map(t=>(
                          <button key={t.key} onClick={()=>setForm((f:any)=>({...f,service_type:t.key}))}
                            style={{padding:'8px 4px',fontSize:10,border:`1px solid ${form.service_type===t.key?'#1D9E75':'#e5e7eb'}`,borderRadius:8,background:form.service_type===t.key?'#E1F5EE':'#fff',color:form.service_type===t.key?'#085041':'#6b7280',cursor:'pointer',fontWeight:form.service_type===t.key?600:400,textAlign:'center' as const}}>
                            {t.icon}<br/><span style={{fontSize:9}}>{t.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:12}}>
                      <div><label style={lbl}>Datum *</label><input type="date" value={form.service_date} onChange={e=>setForm((f:any)=>({...f,service_date:e.target.value}))} style={inp} /></div>
                      <div><label style={lbl}>Kilometraža</label><input type="number" value={form.mileage_at_service} onChange={e=>setForm((f:any)=>({...f,mileage_at_service:e.target.value}))} placeholder={selectedVozilo.current_mileage?String(selectedVozilo.current_mileage):''} style={inp} /></div>
                      <div><label style={lbl}>Prioritet</label><select value={form.priority} onChange={e=>setForm((f:any)=>({...f,priority:e.target.value}))} style={inp}>{Object.entries(PRIORITY_CFG).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select></div>
                    </div>
                    <div style={{marginBottom:12}}>
                      <label style={lbl}>Status</label>
                      <div style={{display:'flex',gap:6}}>
                        {Object.entries(STATUS_CFG).map(([key,cfg])=>(
                          <button key={key} onClick={()=>setForm((f:any)=>({...f,status:key}))}
                            style={{flex:1,padding:'6px',fontSize:11,border:`1px solid ${form.status===key?'#1D9E75':'#e5e7eb'}`,borderRadius:8,background:form.status===key?cfg.bg:'#fff',color:form.status===key?cfg.color:'#9ca3af',cursor:'pointer',fontWeight:form.status===key?600:400}}>
                            {cfg.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    {form.service_type==='kvarovi'&&(
                      <div style={{marginBottom:12,background:'#fff5f5',border:'1px solid #fecaca',borderRadius:8,padding:'10px 12px'}}>
                        <label style={{...lbl,color:'#dc2626',fontWeight:700}}>⚠️ Tip kvara</label>
                        <div style={{display:'grid',gridTemplateColumns:'repeat(5, 1fr)',gap:5}}>
                          {FAULT_TYPES.map(ft=>(
                            <button key={ft} onClick={()=>setForm((f:any)=>({...f,fault_type:f.fault_type===ft?'':ft}))}
                              style={{padding:'5px 4px',fontSize:10,border:`1px solid ${form.fault_type===ft?'#dc2626':'#fecaca'}`,borderRadius:6,background:form.fault_type===ft?'#FCEBEB':'#fff',color:form.fault_type===ft?'#dc2626':'#9ca3af',cursor:'pointer',fontWeight:form.fault_type===ft?700:400,textAlign:'center' as const}}>
                              {ft}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {form.service_type==='gume'&&(
                      <div style={{marginBottom:12,background:'#f9fafb',border:'1px solid #e5e7eb',borderRadius:8,padding:'12px 14px'}}>
                        <div style={{fontSize:12,fontWeight:700,color:'#374151',marginBottom:10}}>🛞 Detalji guma</div>
                        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
                          <div><label style={lbl}>Brend *</label><input value={form.tyre_brand} onChange={e=>setForm((f:any)=>({...f,tyre_brand:e.target.value}))} placeholder="Michelin, Pirelli..." style={inp} /></div>
                          <div><label style={lbl}>Veličina *</label><input value={form.tyre_size} onChange={e=>setForm((f:any)=>({...f,tyre_size:e.target.value}))} placeholder="205/55R16" style={inp} /></div>
                          <div><label style={lbl}>Sezona</label><div style={{display:'flex',gap:6}}>{TYRE_SEASONS.map(s=><button key={s} onClick={()=>setForm((f:any)=>({...f,tyre_season:s}))} style={{flex:1,padding:'6px',fontSize:11,border:`1px solid ${form.tyre_season===s?'#185FA5':'#e5e7eb'}`,borderRadius:6,background:form.tyre_season===s?'#E6F1FB':'#fff',color:form.tyre_season===s?'#0C447C':'#9ca3af',cursor:'pointer',fontWeight:form.tyre_season===s?600:400}}>{s}</button>)}</div></div>
                          <div><label style={lbl}>Cijena (€)</label><input type="number" value={form.tyre_price} onChange={e=>setForm((f:any)=>({...f,tyre_price:e.target.value}))} placeholder="0.00" style={inp} /></div>
                        </div>
                        <div>
                          <label style={lbl}>📄 Račun za gume</label>
                          <div style={{display:'flex',gap:8,alignItems:'center'}}>
                            <label style={{display:'flex',alignItems:'center',gap:6,padding:'7px 12px',border:'1px dashed #d1d5db',borderRadius:8,cursor:uploading?'not-allowed':'pointer',fontSize:12,color:'#6b7280',background:'#fff',whiteSpace:'nowrap' as const}}>
                              {uploading?'⏳ Upload...':'📁 Odaberi fajl'}
                              <input type="file" accept=".pdf,.jpg,.jpeg,.png" style={{display:'none'}} disabled={uploading}
                                onChange={async e=>{const file=e.target.files?.[0];if(!file) return;const url=await uploadToGDrive(file);if(url)setForm((f:any)=>({...f,receipt_url:url}));else alert('Greška pri uploadu')}} />
                            </label>
                            {form.receipt_url&&<a href={form.receipt_url} target="_blank" rel="noreferrer" style={{fontSize:12,color:'#185FA5',background:'#eff6ff',padding:'6px 10px',borderRadius:8,textDecoration:'none',fontWeight:600}}>📄 Vidi</a>}
                          </div>
                        </div>
                      </div>
                    )}
                    <div style={{marginBottom:10}}><label style={lbl}>Opis radova</label><textarea value={form.description} onChange={e=>setForm((f:any)=>({...f,description:e.target.value}))} placeholder="Šta je rađeno..." style={{...inp,minHeight:60,resize:'vertical' as const}} /></div>
                    <div style={{marginBottom:12}}>
                      <label style={{...lbl,fontSize:12,fontWeight:600,color:'#374151',marginBottom:8}}>Checklist provjere</label>
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:5}}>
                        {CHECKLIST.map(item=>(
                          <div key={item.key} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'5px 8px',border:`1px solid ${form[item.key]===false?'#fecaca':'#e5e7eb'}`,borderRadius:6,background:form[item.key]===false?'#fff5f5':'#f9fafb'}}>
                            <span style={{fontSize:11,color:'#374151'}}>{item.label}</span>
                            <div style={{display:'flex',gap:3}}>
                              <button onClick={()=>setForm((f:any)=>({...f,[item.key]:true}))} style={{padding:'2px 7px',fontSize:10,border:`1px solid ${form[item.key]!==false?'#1D9E75':'#e5e7eb'}`,borderRadius:4,background:form[item.key]!==false?'#E1F5EE':'#fff',color:form[item.key]!==false?'#085041':'#9ca3af',cursor:'pointer',fontWeight:600}}>✓</button>
                              <button onClick={()=>setForm((f:any)=>({...f,[item.key]:false}))} style={{padding:'2px 7px',fontSize:10,border:`1px solid ${form[item.key]===false?'#dc2626':'#e5e7eb'}`,borderRadius:4,background:form[item.key]===false?'#FCEBEB':'#fff',color:form[item.key]===false?'#dc2626':'#9ca3af',cursor:'pointer',fontWeight:600}}>✗</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:10}}>
                      <div><label style={lbl}>Ko je radio</label><input list="se-nova" value={form.performed_by} onChange={e=>setForm((f:any)=>({...f,performed_by:e.target.value}))} style={inp}/><datalist id="se-nova">{serviseri.filter(s=>s.is_active).map(s=><option key={s.id} value={s.full_name}/>)}</datalist></div>
                      <div><label style={lbl}>Radionica</label><input value={form.external_shop} onChange={e=>setForm((f:any)=>({...f,external_shop:e.target.value}))} style={inp}/></div>
                      <div><label style={lbl}>Cijena (€)</label><input type="number" step="0.01" value={form.cost} onChange={e=>setForm((f:any)=>({...f,cost:e.target.value}))} placeholder="0.00" style={inp}/></div>
                      <div><label style={lbl}>Sljedeći servis</label><input type="date" value={form.next_service_date} onChange={e=>setForm((f:any)=>({...f,next_service_date:e.target.value}))} style={inp}/></div>
                      <div><label style={lbl}>Sljedeći (km)</label><input type="number" value={form.next_service_mileage} onChange={e=>setForm((f:any)=>({...f,next_service_mileage:e.target.value}))} placeholder="50000" style={inp}/></div>
                    </div>
                    <div style={{marginBottom:14}}><label style={lbl}>Napomena</label><textarea value={form.notes} onChange={e=>setForm((f:any)=>({...f,notes:e.target.value}))} style={{...inp,minHeight:40,resize:'vertical' as const}} /></div>
                    <div style={{background:'#f9fafb',border:'1px solid #e5e7eb',borderRadius:10,padding:'14px 16px',marginBottom:14}}>
                      <div style={{fontSize:12,fontWeight:700,color:'#374151',marginBottom:10}}>🚗 Status vozila</div>
                      <div style={{display:'flex',flexDirection:'column',gap:10}}>
                        {[{key:'is_drivable',label:'Vozilo je u voznom stanju',desc:'Može se fizički koristiti',accent:'#1D9E75'},{key:'can_be_rented',label:'Vozilo se može izdavati',desc:'Dostupno za rentanje',accent:'#1D9E75'},{key:'remove_from_calendar',label:'Makni vozilo iz kalendara',desc:'Status → service_other',accent:'#dc2626'}].map(item=>(
                          <label key={item.key} style={{display:'flex',alignItems:'center',gap:10,cursor:'pointer',padding:'8px 10px',borderRadius:8,background:form[item.key]?item.key==='remove_from_calendar'?'#FCEBEB':'#E1F5EE':'#fff5f5',border:`1px solid ${form[item.key]?item.key==='remove_from_calendar'?'#fecaca':'#5DCAA5':'#fecaca'}`}}>
                            <input type="checkbox" checked={form[item.key]} onChange={e=>setForm((f:any)=>({...f,[item.key]:e.target.checked}))} style={{width:16,height:16,accentColor:item.accent}}/>
                            <div><div style={{fontSize:13,fontWeight:600,color:form[item.key]&&item.key==='remove_from_calendar'?'#dc2626':'#111'}}>{item.label}</div><div style={{fontSize:11,color:'#6b7280'}}>{item.desc}</div></div>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div style={{display:'flex',gap:8}}>
                      <button onClick={()=>{setVoziloTab('istorija');setForm(emptyForm)}} style={{flex:1,padding:9,border:'1px solid #d1d5db',borderRadius:8,background:'transparent',fontSize:12,cursor:'pointer',color:'#374151'}}>Odustani</button>
                      <button onClick={saveServis} disabled={saving} style={{flex:2,padding:9,background:saving?'#5DCAA5':'#1D9E75',color:'#fff',border:'none',borderRadius:8,fontSize:13,fontWeight:600,cursor:'pointer'}}>
                        {saving?'⏳ Snimam...':'💾 Snimi servis'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {!selectedVozilo&&!loading&&(
            <div>
              {vozila.filter(v=>getAktivan(v.id)).length>0&&(
                <div style={{marginBottom:16}}>
                  <div style={{fontSize:13,fontWeight:600,color:'#374151',marginBottom:10}}>🔧 Vozila u servisu</div>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(220px, 1fr))',gap:8}}>
                    {vozila.filter(v=>getAktivan(v.id)).map(v=>{
                      const aktivan=getAktivan(v.id)!; const tip=SERVICE_TYPES.find(t=>t.key===aktivan.service_type)
                      return (
                        <div key={v.id} onClick={()=>selectVozilo(v)} style={{background:'#fffbeb',border:'1px solid #fbbf24',borderRadius:10,padding:'12px 14px',cursor:'pointer'}}
                          onMouseEnter={e=>(e.currentTarget.style.background='#fef3c7')} onMouseLeave={e=>(e.currentTarget.style.background='#fffbeb')}>
                          <div style={{fontWeight:700,fontSize:13,color:'#111',marginBottom:4}}>{v.agregirani_2}</div>
                          <div style={{fontSize:11,color:'#9ca3af',fontFamily:'monospace'}}>{v.license_plate}</div>
                          <div style={{marginTop:8,fontSize:12,color:'#633806'}}>{tip?.icon} {tip?.label} · {aktivan.service_date}</div>
                          {aktivan.priority==='urgent'&&<div style={{fontSize:11,color:'#dc2626',fontWeight:700,marginTop:4}}>🔴 HITNO</div>}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
              <div style={{textAlign:'center',padding:'40px 20px',color:'#9ca3af',border:'1px dashed #e5e7eb',borderRadius:12,fontSize:13}}>
                Pretraži i odaberi vozilo gore da vidiš servisnu historiju i registraciju.
              </div>
            </div>
          )}
        </div>
      )}

      {/* SERVISERI TAB */}
      {mainTab==='serviseri'&&(
        <div style={{display:'grid',gridTemplateColumns:showServiserForm?'1fr 340px':'1fr',gap:20}}>
          <div>
            {loading?<div style={{padding:40,textAlign:'center',color:'#9ca3af'}}>Učitavanje...</div>
              :serviseri.length===0?<div style={{textAlign:'center',padding:40,color:'#9ca3af',border:'1px dashed #e5e7eb',borderRadius:10}}>Nema servisera.</div>
              :serviseri.map(s=>(
                <div key={s.id} style={{background:'#fff',border:'1px solid #e5e7eb',borderRadius:10,padding:14,marginBottom:8,opacity:s.is_active?1:0.6}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                    <div style={{flex:1}}>
                      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                        <div style={{fontWeight:700,fontSize:14}}>{s.full_name}</div>
                        <span style={{fontSize:10,background:s.is_active?'#E1F5EE':'#f3f4f6',color:s.is_active?'#085041':'#6b7280',padding:'2px 7px',borderRadius:20,fontWeight:600}}>{s.is_active?'Aktivan':'Neaktivan'}</span>
                      </div>
                      <div style={{display:'flex',gap:14,flexWrap:'wrap',fontSize:12,color:'#6b7280'}}>
                        {s.phone&&<span>📞 {s.phone}</span>}{s.portal_email&&<span>✉️ {s.portal_email}</span>}
                      </div>
                      <div style={{display:'flex',gap:6,flexWrap:'wrap',fontSize:12,marginTop:6}}>
                        {s.salary&&<span style={{background:'#f9fafb',borderRadius:6,padding:'2px 8px',color:'#374151'}}>💰 {s.salary}€</span>}
                        {s.bonus_per_service&&<span style={{background:'#E1F5EE',borderRadius:6,padding:'2px 8px',color:'#085041'}}>🔧 +{s.bonus_per_service}€</span>}
                        {s.bonus_per_repair&&<span style={{background:'#E6F1FB',borderRadius:6,padding:'2px 8px',color:'#0C447C'}}>⚠️ +{s.bonus_per_repair}€</span>}
                      </div>
                    </div>
                    <div style={{display:'flex',gap:5,marginLeft:10}}>
                      <button onClick={()=>{setEditServiser(s);setServiserForm({full_name:s.full_name,phone:s.phone||'',portal_email:s.portal_email||'',is_active:s.is_active,bonus_per_service:s.bonus_per_service||'',bonus_per_repair:s.bonus_per_repair||'',salary:s.salary||'',notes:s.notes||''});setShowServiserForm(true)}} style={{padding:'5px 9px',fontSize:11,border:'1px solid #d1d5db',borderRadius:8,background:'#fff',cursor:'pointer',color:'#374151'}}>✏️</button>
                      <button onClick={async()=>{await supabase.from('technicians').update({is_active:!s.is_active}).eq('id',s.id);fetchAll()}} style={{padding:'5px 9px',fontSize:11,border:`1px solid ${s.is_active?'#fbbf24':'#1D9E75'}`,borderRadius:8,background:s.is_active?'#fffbeb':'#E1F5EE',cursor:'pointer',color:s.is_active?'#d97706':'#085041'}}>{s.is_active?'Deaktiviraj':'Aktiviraj'}</button>
                      <button onClick={async()=>{if(!confirm('Obrisati?'))return;await supabase.from('technicians').delete().eq('id',s.id);fetchAll()}} style={{padding:'5px 9px',fontSize:11,border:'1px solid #fecaca',borderRadius:8,background:'#fff',cursor:'pointer',color:'#dc2626'}}>🗑️</button>
                    </div>
                  </div>
                </div>
              ))}
          </div>
          {showServiserForm&&(
            <div style={{background:'#fff',border:'1px solid #e5e7eb',borderRadius:10,padding:18,alignSelf:'start'}}>
              <div style={{fontSize:14,fontWeight:600,marginBottom:14}}>{editServiser?'Uredi servisera':'Novi serviser'}</div>
              <div style={{marginBottom:10}}><label style={lbl}>Ime i prezime *</label><input value={serviserForm.full_name} onChange={e=>setServiserForm((f:any)=>({...f,full_name:e.target.value}))} style={inp}/></div>
              <div style={{marginBottom:10}}><label style={lbl}>Telefon</label><input value={serviserForm.phone} onChange={e=>setServiserForm((f:any)=>({...f,phone:e.target.value}))} style={inp}/></div>
              <div style={{marginBottom:10}}><label style={lbl}>Email</label><input value={serviserForm.portal_email} onChange={e=>setServiserForm((f:any)=>({...f,portal_email:e.target.value}))} style={inp}/></div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginBottom:10}}>
                <div><label style={lbl}>Plata (€)</label><input type="number" value={serviserForm.salary} onChange={e=>setServiserForm((f:any)=>({...f,salary:e.target.value}))} style={inp}/></div>
                <div><label style={lbl}>Bonus servis</label><input type="number" value={serviserForm.bonus_per_service} onChange={e=>setServiserForm((f:any)=>({...f,bonus_per_service:e.target.value}))} style={inp}/></div>
                <div><label style={lbl}>Bonus popravka</label><input type="number" value={serviserForm.bonus_per_repair} onChange={e=>setServiserForm((f:any)=>({...f,bonus_per_repair:e.target.value}))} style={inp}/></div>
              </div>
              <div style={{marginBottom:10}}><label style={lbl}>Napomena</label><textarea value={serviserForm.notes} onChange={e=>setServiserForm((f:any)=>({...f,notes:e.target.value}))} style={{...inp,minHeight:50,resize:'vertical' as const}}/></div>
              <div style={{marginBottom:14}}><label style={{display:'flex',alignItems:'center',gap:8,fontSize:13,cursor:'pointer'}}><input type="checkbox" checked={serviserForm.is_active} onChange={e=>setServiserForm((f:any)=>({...f,is_active:e.target.checked}))}/>Serviser je aktivan</label></div>
              <div style={{display:'flex',gap:8}}>
                <button onClick={()=>{setShowServiserForm(false);setEditServiser(null)}} style={{flex:1,padding:9,border:'1px solid #d1d5db',borderRadius:8,background:'transparent',fontSize:12,cursor:'pointer',color:'#374151'}}>Odustani</button>
                <button onClick={saveServiser} disabled={serviserSaving} style={{flex:2,padding:9,background:serviserSaving?'#5DCAA5':'#1D9E75',color:'#fff',border:'none',borderRadius:8,fontSize:13,fontWeight:600,cursor:'pointer'}}>{serviserSaving?'⏳...':'💾 Snimi'}</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
