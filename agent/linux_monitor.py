"""ServerMonitor Linux agent."""
import argparse,json,platform,subprocess,time,os
from pathlib import Path
import psutil,requests
AGENT_VERSION="1.1.0"; DEFAULT_STATE=Path("/var/lib/server-monitor/state.json")

def load_state(path):
    try:return json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError,ValueError):return {"journal_cursors":[]}
def save_state(path,state):
    try:
        p=Path(path);p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(state),encoding="utf-8")
    except OSError:pass

def gpu_percent():
    try:
        output=subprocess.check_output(["nvidia-smi","--query-gpu=utilization.gpu","--format=csv,noheader,nounits"],text=True,timeout=3);values=[float(x.strip()) for x in output.splitlines() if x.strip()];return max(0.0,min(100.0,max(values))) if values else 0.0
    except (FileNotFoundError,subprocess.SubprocessError,ValueError):return 0.0

def journal_events(seen):
    try:output=subprocess.check_output(["journalctl","-n","40","--no-pager","-o","json"],text=True,stderr=subprocess.DEVNULL,timeout=5)
    except (FileNotFoundError,subprocess.SubprocessError):return [],[],seen
    logs=[];errors=[]
    for line in output.splitlines():
        try:event=json.loads(line)
        except json.JSONDecodeError:continue
        cursor=event.get("__CURSOR")
        if not cursor or cursor in seen:continue
        seen.add(cursor);priority=str(event.get("PRIORITY","6"));level="error" if priority in {"0","1","2","3"} else "warn" if priority=="4" else "info";message=str(event.get("MESSAGE","")).strip()[:2000]
        if not message:continue
        source=str(event.get("SYSLOG_IDENTIFIER") or event.get("_SYSTEMD_UNIT") or "systemd");code=event.get("MESSAGE_ID") or event.get("SYSLOG_IDENTIFIER");logs.append({"level":level,"source":source,"message":message})
        if level=="error":errors.append({"severity":"critical" if priority in {"0","1"} else "error","code":str(code)[:120] if code else None,"message":message})
    return logs[-20:],errors[-20:],seen

def process_snapshot():
    processes=list(psutil.process_iter(["pid","name","memory_info"]));
    for p in processes:
        try:p.cpu_percent(None)
        except (psutil.NoSuchProcess,psutil.AccessDenied):pass
    time.sleep(.1);rows=[]
    for p in processes:
        try:
            info=p.info;mem=info["memory_info"];rows.append({"pid":info["pid"],"name":info["name"] or "unknown","cpu_percent":round(p.cpu_percent(None),1),"memory_mb":round((mem.rss if mem else 0)/1024/1024,1)})
        except (psutil.NoSuchProcess,psutil.AccessDenied):pass
    rows.sort(key=lambda p:p["cpu_percent"],reverse=True);return rows[:25]

def snapshot(previous_net,previous_time,server_id,seen):
    now=time.monotonic();net=psutil.net_io_counters();elapsed=max(now-previous_time,.001);down=max(0,net.bytes_recv-previous_net.bytes_recv)*8/elapsed/1_000_000;up=max(0,net.bytes_sent-previous_net.bytes_sent)*8/elapsed/1_000_000;logs,errors,seen=journal_events(seen)
    interfaces=[]
    for name,addrs in psutil.net_if_addrs().items():
        ipv4=next((a.address for a in addrs if a.family==getattr(__import__('socket'),'AF_INET')),None);interfaces.append({"name":name,"ipv4":ipv4,"bytes_recv":getattr(psutil.net_io_counters(pernic=True).get(name),"bytes_recv",0),"bytes_sent":getattr(psutil.net_io_counters(pernic=True).get(name),"bytes_sent",0)})
    return {"server_id":server_id,"agent_version":AGENT_VERSION,"system":{"hostname":platform.node(),"platform":platform.system(),"release":platform.release(),"architecture":platform.machine(),"cpu_count":psutil.cpu_count(logical=True) or 0,"memory_total_mb":int(psutil.virtual_memory().total/1024/1024)},"metrics":{"cpu_percent":psutil.cpu_percent(interval=.5),"memory_percent":psutil.virtual_memory().percent,"gpu_percent":gpu_percent(),"disk_percent":psutil.disk_usage("/").percent,"download_mbps":round(down,2),"upload_mbps":round(up,2),"uptime_seconds":int(time.time()-psutil.boot_time()),"network_interfaces":interfaces},"processes":process_snapshot(),"logs":logs,"errors":errors},net,now,seen

def load_config(path):
    with open(path,encoding="utf-8") as f:config=json.load(f)
    for key in ("server_id","token","url"):
        if not str(config.get(key,"")).strip():raise ValueError(f"Missing config value: {key}")
    config["interval"]=max(1,int(config.get("interval",5)));return config

def main():
    parser=argparse.ArgumentParser();parser.add_argument("--server-id");parser.add_argument("--token");parser.add_argument("--url");parser.add_argument("--interval",type=int,default=5);parser.add_argument("--config");parser.add_argument("--state",default=str(DEFAULT_STATE));args=parser.parse_args()
    if args.config:config=load_config(args.config);server_id,token,url,interval=config["server_id"],config["token"],config["url"],config["interval"]
    else:
        if not all((args.server_id,args.token,args.url)):parser.error("--server-id, --token and --url are required unless --config is used")
        server_id,token,url,interval=args.server_id,args.token,args.url,max(1,args.interval)
    headers={"Authorization":f"Bearer {token}","Content-Type":"application/json"};previous_net=psutil.net_io_counters();previous_time=time.monotonic();state=load_state(args.state);seen=set(state.get("journal_cursors",[]));connected=False
    while True:
        payload,previous_net,previous_time,seen=snapshot(previous_net,previous_time,server_id,seen);state["journal_cursors"]=list(seen)[-2000:];save_state(args.state,state)
        try:
            response=requests.post(url,json=payload,headers=headers,timeout=10);response.raise_for_status()
            if not connected:print("connected");connected=True
        except requests.RequestException as exc:connected=False;print(f"heartbeat failed: {exc}")
        time.sleep(interval)
if __name__=="__main__":main()
