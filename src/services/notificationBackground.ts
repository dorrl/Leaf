import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { AppState, Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const STORAGE_KEY='@smartfarm/server-configs';
const SEEN_KEY='@smartfarm/foreground-notification-seen';
const API_PREFIX='smartfarm-api-key-';
const INTERVAL=30000;
let timer: ReturnType<typeof setInterval>|null=null;
let running=false;

type Server={id:string;name:string;address:string};
type Item={id?:string|number;message?:unknown;picoId?:unknown;picoName?:unknown;createdAt?:unknown};

const key=(id:string)=>{const safe=id.replace(/[^A-Za-z0-9._-]/g,'_');return safe?API_PREFIX+safe:''};
const itemKey=(sid:string,n:Item)=>n.id!=null?sid+':'+String(n.id):[sid,n.createdAt??'',n.picoId??'',n.message??''].join(':');

async function servers():Promise<Server[]>{
 try{const v=await AsyncStorage.getItem(STORAGE_KEY);const x=v?JSON.parse(v):[];return Array.isArray(x)?x.filter((s):s is Server=>s&&typeof s.id==='string'&&typeof s.name==='string'&&typeof s.address==='string'):[]}catch{return[]}
}
async function check(){
 if(running||AppState.currentState!=='active')return;
 running=true;
 try{
  const list=await servers();if(!list.length)return;
  const raw=await AsyncStorage.getItem(SEEN_KEY);const seen:Record<string,string[]>=raw?JSON.parse(raw):{};
  for(const s of list){
   try{
    const base=(s.address.startsWith('http')?s.address:'http://'+s.address).replace(/\/+$/,'');
    const api=await SecureStore.getItemAsync(key(s.id));
    const res=await fetch(base+'/notifications',{headers:{Accept:'application/json',...(api?{'X-API-Key':api}:{})}});
    if(!res.ok)continue;
    const json=await res.json();const notes:Array<Item>=Array.isArray(json?.notifications)?json.notifications:[];
    const old=new Set(seen[s.id]??[]);
    if(!seen[s.id]){seen[s.id]=notes.map(n=>itemKey(s.id,n)).slice(-200);continue}
    for(const n of notes.filter(n=>!old.has(itemKey(s.id,n)))){
     await Notifications.scheduleNotificationAsync({content:{title:s.name+' · '+(n.picoName||'센서'),body:typeof n.message==='string'?n.message:'새로운 SmartFarm 알림이 도착했습니다.',sound:'default',data:{serverId:s.id,picoId:typeof n.picoId==='string'?n.picoId:''}},trigger:null});
    }
    seen[s.id]=Array.from(new Set([...old,...notes.map(n=>itemKey(s.id,n))])).slice(-200);
   }catch{}
  }
  await AsyncStorage.setItem(SEEN_KEY,JSON.stringify(seen));
 }finally{running=false}
}
function start(){if(timer)return;void check();timer=setInterval(()=>void check(),INTERVAL)}
function stop(){if(timer){clearInterval(timer);timer=null}}

export async function initializeNotificationForeground(){
 if(Platform.OS==='web')return false;
 if(Platform.OS==='android')await Notifications.setNotificationChannelAsync('smartfarm-alerts',{name:'SmartFarm 알림',importance:Notifications.AndroidImportance.HIGH,sound:'default'});
 const p=await Notifications.getPermissionsAsync();
 const permission=p.granted?p:await Notifications.requestPermissionsAsync({ios:{allowAlert:true,allowBadge:true,allowSound:true}});
 if(!permission.granted)return false;
 if(AppState.currentState==='active')start();
 return true;
}
export function subscribeNotificationForegroundPolling(){
 const sub=AppState.addEventListener('change',s=>s==='active'?start():stop());
 if(AppState.currentState==='active')start();
 return()=>{sub.remove();stop()};
}
