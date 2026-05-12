"use client";
import { useState, useMemo, useEffect, useCallback } from "react";
import useSWR from "swr";
import { useAuthStore } from "@/features/auth/stores/auth-store";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { SERIF_STYLE } from "@/lib/constants";
import { Loader2, Calendar, ClipboardList, Plus, CheckCircle, XCircle, Search, X } from "lucide-react";
import { getJobPlans, getJobPlanDropdowns, approveJobPlan, type JobPlanItem } from "@/features/operational/services/job-plan-service";
import { cn } from "@/lib/utils";

/** Backend kadang kirim time sebagai detik (number) atau string "HH:MM:SS" */
function fmtTime(t: string | number | null | undefined): string {
  if (t == null) return "—";
  if (typeof t === "number") {
    const h = Math.floor(t / 3600).toString().padStart(2, "0");
    const m = Math.floor((t % 3600) / 60).toString().padStart(2, "0");
    return `${h}:${m}`;
  }
  return String(t).slice(0, 5) || "—";
}

const STATUS_CLS: Record<string,string> = {
  PLAN:"bg-blue-500/10 text-blue-400",
  ONPROGRESS:"bg-amber-500/10 text-amber-400",
  DONE:"bg-emerald-500/10 text-emerald-400",
  READY_QC:"bg-purple-500/10 text-purple-400",
  PENDING_ADV:"bg-orange-500/10 text-orange-400",
  PENDING_KP:"bg-orange-500/10 text-orange-400",
  PENDING_MP:"bg-orange-500/10 text-orange-400",
  REJECTED:"bg-red-500/10 text-red-400",
  DRAFT:"bg-white/5 text-white/40",
};
function SBadge({s}:{s:string}){
  const cls=STATUS_CLS[s?.toUpperCase?.()] ?? "bg-white/5 text-white/30";
  return <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${cls}`}>{s||"—"}</span>;
}

// ── Searchable Combobox ─────────────────────────────────────────────────────
function Combobox({
  label, items, value, onChange, labelKey="name", valueKey="id",
  placeholder="Pilih…", allowCustom=false, customLabel="+ Tambah baru"
}:{
  label:string; items:any[]; value:string; onChange:(val:string,item?:any)=>void;
  labelKey?:string; valueKey?:string; placeholder?:string;
  allowCustom?:boolean; customLabel?:string;
}) {
  const [open,setOpen]=useState(false);
  const [q,setQ]=useState("");
  const filtered=items.filter(i=>(i[labelKey]||"").toLowerCase().includes(q.toLowerCase()));
  const selected=items.find(i=>String(i[valueKey])===String(value));
  return (
    <div className="relative">
      <div
        onClick={()=>setOpen(o=>!o)}
        className="flex items-center justify-between bg-white/5 border border-white/10 rounded px-2.5 py-1.5 text-xs cursor-pointer hover:border-amber-500/40 transition-colors"
      >
        <span className={selected?"text-white/80":"text-white/30"}>
          {selected?selected[labelKey]:placeholder}
        </span>
        <span className="text-white/20 text-[10px]">▼</span>
      </div>
      {open&&(
        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-[#111] border border-white/10 rounded-md shadow-xl overflow-hidden">
          <div className="p-2 border-b border-white/[0.06]">
            <div className="flex items-center gap-1.5 bg-white/5 rounded px-2 py-1">
              <Search className="w-3 h-3 text-white/30"/>
              <input autoFocus value={q} onChange={e=>setQ(e.target.value)}
                placeholder={`Cari ${label.toLowerCase()}…`}
                className="bg-transparent text-xs text-white/80 w-full focus:outline-none placeholder:text-white/20"/>
              {q&&<X className="w-3 h-3 text-white/30 cursor-pointer" onClick={()=>setQ("")}/>}
            </div>
          </div>
          <div className="max-h-44 overflow-y-auto">
            {filtered.map(i=>(
              <div key={i[valueKey]} onClick={()=>{onChange(String(i[valueKey]),i);setOpen(false);setQ("");}}
                className={cn("px-3 py-2 text-xs cursor-pointer hover:bg-white/[0.05] transition-colors",
                  String(i[valueKey])===String(value)?"text-amber-400":"text-white/70")}>
                {i[labelKey]}
                {i.subtitle&&<div className="text-[10px] text-white/30">{i.subtitle}</div>}
              </div>
            ))}
            {allowCustom&&q&&!filtered.some(i=>i[labelKey]===q)&&(
              <div onClick={()=>{onChange("__custom__",{[labelKey]:q,[valueKey]:"__custom__"});setOpen(false);setQ("");}}
                className="px-3 py-2 text-xs text-amber-400 cursor-pointer hover:bg-amber-500/10 border-t border-white/[0.06]">
                {customLabel}: "<b>{q}</b>"
              </div>
            )}
            {filtered.length===0&&!allowCustom&&<div className="px-3 py-4 text-xs text-white/30 text-center">Tidak ditemukan</div>}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Create Form Dialog ──────────────────────────────────────────────────────
function CreatePlanDialog({
  dropdowns, date, userId, onClose, onCreated
}:{
  dropdowns:any; date:string; userId:string;
  onClose:()=>void; onCreated:()=>void;
}) {
  const BASE = process.env.NEXT_PUBLIC_JOB_PLAN_URL || "";
  const [div,setDiv]=useState("");
  const [unitId,setUnitId]=useState("");
  const [empId,setEmpId]=useState("");
  const [panelId,setPanelId]=useState("");
  const [panelCustom,setPanelCustom]=useState("");
  const [jobs,setJobs]=useState<string[]>([]);
  const [targetHours,setTargetHours]=useState("8");
  const [totalHours,setTotalHours]=useState("");
  const [startTime,setStartTime]=useState("08:00");
  const [finishTime,setFinishTime]=useState("16:00");
  const [overtime,setOvertime]=useState(false);
  const [note,setNote]=useState("");
  const [deadline,setDeadline]=useState("");
  const [saving,setSaving]=useState(false);

  const divs=(dropdowns?.divisions||[]).map((d:any)=>({id:d.id||d.name,name:d.name||d}));
  const cars=(dropdowns?.cars||[]).map((c:any)=>({...c,name:c.unit_name}));
  const emps=(dropdowns?.users||[]).map((u:any)=>({...u,name:u.full_name||u.name}));
  const panels=(dropdowns?.panels||[]).map((p:any)=>({...p,subtitle:p.section||""}));
  const jobTypes=(dropdowns?.jobTypes||[]).map((j:any)=>({id:j.id,name:j.job_name}));

  const toggleJob=(name:string)=>setJobs(prev=>prev.includes(name)?prev.filter(x=>x!==name):[...prev,name]);

  const handleSave=async()=>{
    if(!empId||!unitId) return;
    setSaving(true);
    try {
      const finalPanel=panelId==="__custom__"?panelCustom:undefined;
      await fetch(`${BASE}/sm/job-plans`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
        action:"submit",userId,sourceType:"ADDITIONAL",note,
        items:[{
          carId:unitId, assignedUserId:empId,
          divisionId:div||undefined,
          panelId:panelId==="__custom__"?undefined:panelId||undefined,
          panelCustomNote:finalPanel,
          addPanelToMaster:panelId==="__custom__",
          jobDescription:jobs.join(", "),
          targetHours:parseFloat(targetHours)||8,
          totalProjectHours:totalHours?parseFloat(totalHours):undefined,
          taskDate:date, startTime, finishTime,
          isOvertime:overtime,
          deadlineDate:deadline||undefined,
        }]
      })});
      onCreated();
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="bg-[#0e0e0e] border border-white/10 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <h3 className="text-white/90 font-medium" style={SERIF_STYLE}>Buat Job Plan Baru</h3>
          <button onClick={onClose} className="text-white/30 hover:text-white/60"><X className="w-4 h-4"/></button>
        </div>
        <div className="p-5 space-y-4">
          {/* Divisi */}
          <div>
            <label className="block text-[10px] text-white/40 uppercase tracking-wider mb-1.5">Divisi Pelaksana</label>
            <Combobox label="Divisi" items={divs} value={div} onChange={setDiv} placeholder="Pilih Divisi"/>
          </div>
          {/* Unit */}
          <div>
            <label className="block text-[10px] text-white/40 uppercase tracking-wider mb-1.5">Unit Kendaraan *</label>
            <Combobox label="Unit" items={cars} value={unitId} onChange={(v,i)=>{setUnitId(v);}} labelKey="unit_name" placeholder="Pilih Unit"/>
          </div>
          {/* Pelaksana */}
          <div>
            <label className="block text-[10px] text-white/40 uppercase tracking-wider mb-1.5">Pelaksana *</label>
            <Combobox label="Pelaksana" items={emps} value={empId} onChange={setEmpId} placeholder="Pilih Pelaksana"/>
          </div>
          {/* Panel */}
          <div>
            <label className="block text-[10px] text-white/40 uppercase tracking-wider mb-1.5">Panel / Section</label>
            <Combobox label="Panel" items={panels} value={panelId} onChange={(v,i)=>{setPanelId(v);if(v==="__custom__")setPanelCustom(i?.name||"");}}
              allowCustom customLabel="+ Tambah panel baru" placeholder="Pilih Panel"/>
            {panelId==="__custom__"&&(
              <input value={panelCustom} onChange={e=>setPanelCustom(e.target.value)}
                className="mt-2 w-full bg-white/5 border border-amber-500/30 rounded px-2.5 py-1.5 text-xs text-white/80 focus:outline-none"
                placeholder="Nama panel baru…"/>
            )}
          </div>
          {/* Job */}
          <div>
            <label className="block text-[10px] text-white/40 uppercase tracking-wider mb-1.5">Deskripsi Pekerjaan</label>
            <div className="flex flex-wrap gap-1.5">
              {jobTypes.map((j:any)=>(
                <button key={j.id} onClick={()=>toggleJob(j.name)}
                  className={cn("px-2.5 py-1 rounded text-[10px] border transition-all",
                    jobs.includes(j.name)?"bg-amber-500/15 border-amber-500/40 text-amber-400":"bg-white/5 border-white/10 text-white/40 hover:border-white/20")}>
                  {j.name}
                </button>
              ))}
            </div>
          </div>
          {/* Jam */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] text-white/40 uppercase tracking-wider mb-1.5">Target Jam</label>
              <input type="number" step="0.5" value={targetHours} onChange={e=>setTargetHours(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded px-2.5 py-1.5 text-xs text-white/80 focus:outline-none focus:border-amber-500/50"/>
            </div>
            <div>
              <label className="block text-[10px] text-white/40 uppercase tracking-wider mb-1.5">Mulai</label>
              <input type="time" value={startTime} onChange={e=>setStartTime(e.target.value)} style={{colorScheme:"dark"}}
                className="w-full bg-white/5 border border-white/10 rounded px-2.5 py-1.5 text-xs text-white/80 focus:outline-none focus:border-amber-500/50"/>
            </div>
            <div>
              <label className="block text-[10px] text-white/40 uppercase tracking-wider mb-1.5">Selesai</label>
              <input type="time" value={finishTime} onChange={e=>setFinishTime(e.target.value)} style={{colorScheme:"dark"}}
                className="w-full bg-white/5 border border-white/10 rounded px-2.5 py-1.5 text-xs text-white/80 focus:outline-none focus:border-amber-500/50"/>
            </div>
          </div>
          {/* Total + Deadline */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] text-white/40 uppercase tracking-wider mb-1.5">Total Jam Proyek</label>
              <input type="number" value={totalHours} onChange={e=>setTotalHours(e.target.value)} placeholder="Kosongkan = sama"
                className="w-full bg-white/5 border border-white/10 rounded px-2.5 py-1.5 text-xs text-white/80 focus:outline-none focus:border-amber-500/50"/>
            </div>
            <div>
              <label className="block text-[10px] text-white/40 uppercase tracking-wider mb-1.5">Deadline</label>
              <input type="date" value={deadline} onChange={e=>setDeadline(e.target.value)} style={{colorScheme:"dark"}}
                className="w-full bg-white/5 border border-white/10 rounded px-2.5 py-1.5 text-xs text-white/80 focus:outline-none focus:border-amber-500/50"/>
            </div>
          </div>
          {/* OT + Catatan */}
          <div className="flex items-center gap-2">
            <input type="checkbox" id="ot" checked={overtime} onChange={e=>setOvertime(e.target.checked)} className="accent-amber-500"/>
            <label htmlFor="ot" className="text-xs text-white/50">Lembur (Overtime)</label>
          </div>
          <div>
            <label className="block text-[10px] text-white/40 uppercase tracking-wider mb-1.5">Catatan</label>
            <textarea value={note} onChange={e=>setNote(e.target.value)} rows={2}
              className="w-full bg-white/5 border border-white/10 rounded px-2.5 py-1.5 text-xs text-white/80 focus:outline-none focus:border-amber-500/50 resize-none"/>
          </div>
        </div>
        <div className="flex gap-2 px-5 pb-5">
          <button onClick={onClose} className="flex-1 py-2 rounded-md text-xs text-white/40 border border-white/10 hover:border-white/20 transition-colors">Batal</button>
          <button onClick={handleSave} disabled={saving||!empId||!unitId}
            className="flex-1 py-2 rounded-md text-xs font-medium bg-amber-500/15 text-amber-400 border border-amber-500/20 hover:bg-amber-500/25 transition-colors disabled:opacity-40">
            {saving?"Menyimpan…":"Simpan Plan"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Reject Dialog ───────────────────────────────────────────────────────────
function RejectDialog({planId,userId,onClose,onDone}:{planId:string;userId:string;onClose:()=>void;onDone:()=>void}) {
  const [note,setNote]=useState("");
  const [saving,setSaving]=useState(false);
  const handle=async()=>{
    if(!note.trim()) return;
    setSaving(true);
    await approveJobPlan({userId,planId,action:"reject",rejectNote:note.trim()});
    setSaving(false);
    onDone();
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0e0e0e] border border-white/10 rounded-xl w-full max-w-sm p-5 space-y-3">
        <h3 className="text-white/90 font-medium text-sm">Tolak Plan</h3>
        <textarea value={note} onChange={e=>setNote(e.target.value)} rows={3} autoFocus placeholder="Catatan penolakan…"
          className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-red-500/50 resize-none"/>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 rounded text-xs text-white/40 border border-white/10">Batal</button>
          <button onClick={handle} disabled={!note.trim()||saving}
            className="flex-1 py-2 rounded text-xs font-medium bg-red-500/15 text-red-400 border border-red-500/20 disabled:opacity-40">
            {saving?"…":"Tolak"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────
export function PlanningPageClient() {
  const user = useAuthStore(s=>s.user);
  const [tab,setTab]=useState<"approval"|"rencana">("approval");
  const [date,setDate]=useState(()=>{const d=new Date();d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().split("T")[0];});
  const today=date;
  const [showCreate,setShowCreate]=useState(false);
  const [rejectTarget,setRejectTarget]=useState<string|null>(null);
  const [dropdowns,setDropdowns]=useState<any>(null);

  useEffect(()=>{getJobPlanDropdowns().then(d=>setDropdowns(d?.data??d));},[]); // handle {data:{…}} wrapper

  const {data:approvalData,isLoading:loadingApproval,mutate:mutateApproval}=useSWR(
    user?["jp-approval",user.userId,date]:null,
    ()=>getJobPlans({userId:user!.userId,action:"approval_queue",taskDate:date,limit:200}),
    {revalidateOnFocus:false}
  );
  const {data:rencanaData,isLoading:loadingRencana,mutate:mutateRencana}=useSWR(
    user?["jp-rencana",user.userId,date]:null,
    ()=>getJobPlans({userId:user!.userId,action:"browse",taskDate:date,limit:200}),
    {revalidateOnFocus:false}
  );

  const approvalItems=approvalData?.items??[];
  const rencanaItems=rencanaData?.items??[];
  const isLoading=tab==="approval"?loadingApproval:loadingRencana;
  const items=tab==="approval"?approvalItems:rencanaItems;

  const handleApprove=useCallback(async(planId:string)=>{
    if(!user) return;
    await approveJobPlan({userId:user.userId,planId,action:"approve"});
    mutateApproval();
  },[user,mutateApproval]);

  const handleRejectDone=useCallback(()=>{setRejectTarget(null);mutateApproval();},[mutateApproval]);

  const handleCreated=useCallback(()=>{setShowCreate(false);mutateRencana();mutateApproval();},[mutateRencana,mutateApproval]);

  const cols=useMemo<DataTableColumn<JobPlanItem>[]>(()=>[
    {
      key:"nama",label:"Nama / Divisi",sortable:true,sortValue:r=>r.assignedUserName,
      render:r=>(
        <div>
          <p className="text-[12px] text-white/80 font-medium">{r.assignedUserName||"—"}</p>
          <p className="text-[10px] text-white/30">{r.divisionName||""}</p>
        </div>
      )
    },
    {
      key:"unit",label:"Unit · Panel",
      render:r=>(
        <div>
          <p className="text-[12px] text-white/70">{r.unitName||"—"}</p>
          {r.panelName&&<p className="text-[10px] text-white/30">{r.panelName}</p>}
        </div>
      )
    },
    {key:"job",label:"Pekerjaan",render:r=><span className="text-[11px] text-white/60 line-clamp-2">{r.jobdescription||"—"}</span>},
    {
      key:"waktu",label:"Waktu",align:"right" as const,
      render:r=>(
        <div className="text-right">
          <p className="text-xs text-white/50 tabular-nums">
            {r.targetHours?`${r.targetHours.toFixed(1)}h`:"—"}
            {r.isOvertime&&<span className="ml-1 text-[9px] bg-amber-500/10 text-amber-400 px-1 rounded">OT</span>}
          </p>
          {(r.startTime||r.finishTime)&&(
            <p className="text-[10px] text-white/30 tabular-nums">
              {fmtTime(r.startTime)}–{fmtTime(r.finishTime)}
            </p>
          )}
        </div>
      )
    },
    {key:"tgl",label:"Tgl Kerja",render:r=><span className="text-[10px] text-white/30 tabular-nums">{r.taskDate||"—"}</span>},
    {key:"status",label:"Status",render:r=><SBadge s={r.status}/>},
    ...(tab==="approval"?[{
      key:"actions",label:"",
      render:(r:JobPlanItem)=>(
        <div className="flex gap-1">
          <button onClick={()=>handleApprove(r.planId)}
            className="p-1.5 rounded bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors" title="Setujui">
            <CheckCircle className="w-3.5 h-3.5"/>
          </button>
          <button onClick={()=>setRejectTarget(r.planId)}
            className="p-1.5 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors" title="Tolak">
            <XCircle className="w-3.5 h-3.5"/>
          </button>
        </div>
      )
    }] as DataTableColumn<JobPlanItem>[] :[]),
  ],[tab,handleApprove]);

  if(!user) return null;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-light text-white/90 tracking-wide flex items-center gap-2.5" style={SERIF_STYLE}>
            <span className="text-white/30"><ClipboardList className="w-5 h-5"/></span>
            Job Plan (Planning)
          </h2>
          <p className="text-[11px] text-white/30 tracking-[0.15em] uppercase mt-1">
            {isLoading?"Memuat…":`${items.length} record`}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap justify-end">
          <div className="flex gap-1 bg-white/[0.03] border border-white/[0.06] rounded-lg p-1">
            <button onClick={()=>setTab("approval")}
              className={cn("px-4 py-1.5 rounded-md text-[11px] font-medium transition-all",tab==="approval"?"bg-amber-500/15 text-amber-400":"text-white/30 hover:text-white/50")}>
              Approval Queue
            </button>
            <button onClick={()=>setTab("rencana")}
              className={cn("px-4 py-1.5 rounded-md text-[11px] font-medium transition-all",tab==="rencana"?"bg-amber-500/15 text-amber-400":"text-white/30 hover:text-white/50")}>
              Rencana
            </button>
          </div>
          <div className="flex items-center gap-2 bg-[#0a0a0a] border border-white/10 rounded-md px-3 py-1.5 focus-within:border-amber-500/50 transition-colors">
            <Calendar className="w-3.5 h-3.5 text-amber-500/60 shrink-0"/>
            <input type="date" value={date} onChange={e=>setDate(e.target.value)}
              className="bg-transparent text-white/80 text-xs focus:outline-none min-w-[110px]" style={{colorScheme:"dark"}}/>
          </div>
          <button onClick={()=>setShowCreate(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/20 transition-colors">
            <Plus className="w-3.5 h-3.5"/>Buat Plan
          </button>
        </div>
      </div>

      {isLoading?(
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-5 h-5 animate-spin text-amber-500/40"/>
        </div>
      ):(
        <DataTable
          data={items} columns={cols} rowKey={r=>r.planId}
          selectable={tab==="approval"}
          bulkActions={tab==="approval"?[{
            label:"Setujui Semua",
            icon:<CheckCircle className="w-4 h-4"/>,
            onClick:async(keys)=>{for(const k of keys)await handleApprove(k);mutateApproval();}
          }]:[]}
          searchable searchPlaceholder="Cari nama, unit, panel…"
          searchFn={(r,q)=>
            r.assignedUserName.toLowerCase().includes(q)||
            (r.unitName??"").toLowerCase().includes(q)||
            (r.panelName??"").toLowerCase().includes(q)||
            (r.jobdescription??"").toLowerCase().includes(q)
          }
          emptyMessage={`Tidak ada job plan untuk tanggal ${date}.`}
        />
      )}

      {showCreate&&dropdowns&&user&&(
        <CreatePlanDialog dropdowns={dropdowns} date={date} userId={user.userId}
          onClose={()=>setShowCreate(false)} onCreated={handleCreated}/>
      )}
      {rejectTarget&&user&&(
        <RejectDialog planId={rejectTarget} userId={user.userId}
          onClose={()=>setRejectTarget(null)} onDone={handleRejectDone}/>
      )}
    </div>
  );
}
