import { auth0 } from "../../../../../../lib/auth0";
import { getSupabaseAdmin } from "../../../../../../lib/supabase-admin";

export async function GET(request: Request,{params}:{params:Promise<{id:string}>}){
  const session=await auth0.getSession(); if(!session?.user)return Response.json({error:"Unauthorized"},{status:401});
  const {id}=await params; const hours=Math.min(Math.max(Number(new URL(request.url).searchParams.get("hours")||24),1),168);
  const supabase=getSupabaseAdmin();
  const {data:server,error:serverError}=await supabase.from("servers").select("id,name,host,os,status,last_seen_at,collection_interval,system_info,agent_version,created_at").eq("id",id).eq("owner_id",session.user.sub).single();
  if(serverError||!server)return Response.json({error:"Server not found"},{status:404});
  const since=new Date(Date.now()-hours*3600000).toISOString();
  const [{data:metrics},{data:processes},{data:logs},{data:errors},{data:alerts}]=await Promise.all([
    supabase.from("metrics").select("recorded_at,cpu_percent,memory_percent,gpu_percent,disk_percent,download_mbps,upload_mbps,uptime_seconds,network_interfaces,disk_details").eq("server_id",id).gte("recorded_at",since).order("recorded_at",{ascending:true}).limit(5000),
    supabase.from("processes").select("name,cpu_percent,memory_mb,recorded_at").eq("server_id",id).gte("recorded_at",since).order("recorded_at",{ascending:false}).limit(1000),
    supabase.from("logs").select("id,created_at,level,source,message").eq("server_id",id).gte("created_at",since).order("created_at",{ascending:false}).limit(1000),
    supabase.from("errors").select("id,created_at,resolved_at,severity,code,message").eq("server_id",id).gte("created_at",since).order("created_at",{ascending:false}).limit(500),
    supabase.from("alert_history").select("id,code,severity,message,started_at,ended_at").eq("server_id",id).gte("started_at",since).order("started_at",{ascending:false}).limit(500)
  ]);
  const nums=(key:string)=>{const values=(metrics??[]).map((m:any)=>Number(m[key])).filter(Number.isFinite);if(!values.length)return {avg:null,max:null,min:null};return {avg:values.reduce((a,b)=>a+b,0)/values.length,max:Math.max(...values),min:Math.min(...values)};};
  const topMap=new Map<string,{cpu:number;memory:number;samples:number}>();for(const p of processes??[]){const row=topMap.get(p.name)||{cpu:0,memory:0,samples:0};row.cpu=Math.max(row.cpu,Number(p.cpu_percent)||0);row.memory=Math.max(row.memory,Number(p.memory_mb)||0);row.samples++;topMap.set(p.name,row);}const topProcesses=[...topMap.entries()].map(([name,v])=>({name,...v})).sort((a,b)=>b.cpu-a.cpu).slice(0,20);
  return Response.json({report:{server,period_hours:hours,since,generated_at:new Date().toISOString(),samples:metrics?.length||0,resources:{cpu:nums("cpu_percent"),memory:nums("memory_percent"),gpu:nums("gpu_percent"),disk:nums("disk_percent"),download_mbps:nums("download_mbps"),upload_mbps:nums("upload_mbps")},logs:{total:logs?.length||0,errors:(logs??[]).filter((l:any)=>l.level==="error").length,warnings:(logs??[]).filter((l:any)=>l.level==="warn").length},errors:{total:errors?.length||0,unresolved:(errors??[]).filter((e:any)=>!e.resolved_at).length},alerts:alerts||[],top_processes:topProcesses}});
}
