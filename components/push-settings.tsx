"use client";
import {useEffect,useRef,useState} from 'react';
import {BellRing,Check,Send,Smartphone} from 'lucide-react';
import './push-settings.css';
type PushConfig={enabled:boolean;vapidPublicKey:string|null;scope:'catalog'};
type DeviceStatus={subscribed:boolean;lastCheckedAt?:string;lastAlertAt?:string;sourceFetchedAt?:string;error?:string|null};
type SavedDevice={apiBaseUrl:string;deviceToken:string};
const DEVICE_KEY='meridian-push-device-v1';
class PushServiceError extends Error{constructor(message:string,public status:number){super(message)}}
function device():SavedDevice|null{try{return JSON.parse(localStorage.getItem(DEVICE_KEY)||'null')}catch{return null}}
function publicKey(value:string){const raw=atob(value.replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from(raw,c=>c.charCodeAt(0))}
function validApi(value:unknown){if(typeof value!=='string'||!value)return '';try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password?url.origin:''}catch{return ''}}
async function request<T>(base:string,path:string,token?:string,body?:unknown,method='GET'):Promise<T>{
 const response=await fetch(base+path,{method,mode:'cors',cache:'no-store',signal:AbortSignal.timeout(15000),headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
 if(!response.ok){if(response.status===401||response.status===403)throw new PushServiceError('Код подключения не принят или доступ устройства истёк. Подключите устройство заново.',response.status);if(response.status===410)throw new PushServiceError('Подписка истекла. Включите уведомления снова.',410);if(response.status===429)throw Error('Слишком много попыток. Подождите минуту и повторите.');throw Error('Сервис уведомлений не ответил. Попробуйте позже.')}
 return response.json() as Promise<T>;
}
async function registration(){
 const script=new URL('sw.js',document.baseURI);
 const result=await navigator.serviceWorker.register(script.href,{scope:new URL('./',script).href,updateViaCache:'none'});
 if(result.active)return result;
 const worker=result.installing||result.waiting;
 if(!worker)throw Error('Не удалось подготовить уведомления. Обновите страницу.');
 await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>{worker.removeEventListener('statechange',update);reject(Error('Установка уведомлений заняла слишком много времени. Повторите попытку.'))},15000);function update(){if(worker!.state==='activated'){clearTimeout(timer);worker!.removeEventListener('statechange',update);resolve()}else if(worker!.state==='redundant'){clearTimeout(timer);worker!.removeEventListener('statechange',update);reject(Error('Обновите страницу и повторите подключение.'))}}worker.addEventListener('statechange',update);update()});
 return result;
}
export default function PushSettings(){
 const renewSubscription=useRef(false);
 const [api,setApi]=useState(''),[config,setConfig]=useState<PushConfig|null>(null),[token,setToken]=useState(''),[code,setCode]=useState(''),[status,setStatus]=useState<DeviceStatus|null>(null),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[message,setMessage]=useState(''),[error,setError]=useState(''),[supported,setSupported]=useState(false),[needsInstall,setNeedsInstall]=useState(false),[denied,setDenied]=useState(false);
 function fail(e:unknown){if(e instanceof PushServiceError&&e.status===410){renewSubscription.current=true;setStatus({subscribed:false})}if(e instanceof PushServiceError&&e.status===401){try{localStorage.removeItem(DEVICE_KEY)}catch{}setToken('');setStatus(null)}setError(e instanceof Error?e.message:'Не удалось связаться с сервисом уведомлений.')}
 useEffect(()=>{
  let live=true;
  const ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  const standalone=matchMedia('(display-mode: standalone)').matches||!!(navigator as Navigator&{standalone?:boolean}).standalone;
  setNeedsInstall(ios&&!standalone);setSupported(window.isSecureContext&&'Notification'in window&&'serviceWorker'in navigator&&'PushManager'in window);setDenied('Notification'in window&&Notification.permission==='denied');
  void(async()=>{try{
   const response=await fetch(new URL('push-config.json',document.baseURI),{cache:'no-store',signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error('Настройки уведомлений пока недоступны.');
   const settings=await response.json() as {apiBaseUrl?:unknown};const base=validApi(settings.apiBaseUrl);if(!live||!base)return;setApi(base);
   const remote=await request<PushConfig>(base,'/v1/config');if(!live)return;setConfig(remote);
   const saved=device();if(!remote.enabled||saved?.apiBaseUrl!==base||!saved.deviceToken)return;
   setToken(saved.deviceToken);const current=await request<DeviceStatus>(base,'/v1/status',saved.deviceToken);
   let local=false;if('serviceWorker'in navigator){const reg=await navigator.serviceWorker.getRegistration(new URL('./',document.baseURI).href);local=!!(reg&&await reg.pushManager.getSubscription())}
   if(!current.subscribed&&local)renewSubscription.current=true;
   if(live)setStatus({...current,subscribed:current.subscribed&&local&&'Notification'in window&&Notification.permission==='granted'});
  }catch(e){if(live)fail(e)}finally{if(live)setLoading(false)}})();
  return()=>{live=false};
 },[]);
 async function pair(event:React.FormEvent){event.preventDefault();setBusy(true);setError('');setMessage('');try{
  const paired=await request<{deviceToken:string}>(api,'/v1/pair',code.trim(),{label:/iPhone|iPad/.test(navigator.userAgent)?'iPhone / iPad':'Браузер'},'POST');
  localStorage.setItem(DEVICE_KEY,JSON.stringify({apiBaseUrl:api,deviceToken:paired.deviceToken}));setToken(paired.deviceToken);setCode('');setMessage('Устройство подключено. Теперь разрешите уведомления.');
 }catch(e){fail(e)}finally{setBusy(false)}}
 async function enable(){
  // Request directly in the click handler; iOS requires a user gesture.
  const permission=Notification.requestPermission();setBusy(true);setError('');setMessage('');
  try{const allowed=await permission;if(allowed!=='granted'){setDenied(allowed==='denied');setMessage(allowed==='denied'?'Разрешите уведомления для Meridian в настройках устройства.':'Разрешение не получено. Можно включить позже.');return}
   const reg=await registration();let subscription=await reg.pushManager.getSubscription();if(subscription&&renewSubscription.current){await subscription.unsubscribe();subscription=null}subscription=subscription||await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:publicKey(config!.vapidPublicKey!)});
   await request(api,'/v1/subscription',token,{subscription:subscription.toJSON()},'PUT');renewSubscription.current=false;setStatus(previous=>({...previous,subscribed:true}));setMessage('Уведомления включены для всего каталога.');
  }catch(e){fail(e)}finally{setBusy(false)}
 }
 async function disable(){setBusy(true);setError('');setMessage('');try{
  await request(api,'/v1/subscription',token,undefined,'DELETE');const reg=await navigator.serviceWorker.getRegistration(new URL('./',document.baseURI).href);const subscription=await reg?.pushManager.getSubscription();await subscription?.unsubscribe();setStatus({subscribed:false});setMessage('Уведомления на этом устройстве отключены.');
 }catch(e){fail(e)}finally{setBusy(false)}}
 async function test(){setBusy(true);setError('');setMessage('');try{await request(api,'/v1/test',token,{},'POST');setMessage('Тест отправлен. Проверьте уведомления устройства.')}catch(e){fail(e)}finally{setBusy(false)}}
 const configured=!!(api&&config?.enabled&&config.vapidPublicKey);
 return <section className="push-settings" aria-labelledby="push-settings-title">
  <div className="push-settings-heading"><span><BellRing size={19}/></span><div><h3 id="push-settings-title">Важные события рынка</h3><p>Весь каталог активов</p></div><span className="push-state" data-enabled={!!status?.subscribed}>{status?.subscribed?<><Check size={12}/> Включены</>:loading?'Проверяем…':'Не включены'}</span></div>
  <p className="push-description">Значимое событие, затронутый актив и источник — даже когда сайт закрыт. Сигнал помогает проверить новость; цену входа он не оценивает.</p>
  {needsInstall&&<p className="push-install"><Smartphone size={17}/><span>На iPhone откройте сайт в Safari → «Поделиться» → «На экран Домой». Запустите Meridian с новой иконки и включите уведомления здесь. Нужна iOS 16.4 или новее.</span></p>}
  {!loading&&!configured&&!error&&<p className="push-note">Сервис доставки ещё не подключён. После подключения здесь появится кнопка включения уведомлений.</p>}
  {!loading&&configured&&!needsInstall&&!supported&&<p className="push-note">Этот браузер не поддерживает push-уведомления. Откройте сайт в браузере с поддержкой Web Push.</p>}
  {configured&&supported&&!needsInstall&&<>
   {!token?<form className="push-pair" onSubmit={pair}><label htmlFor="push-pair-code">Код подключения устройства</label><div><input id="push-pair-code" type="password" autoComplete="off" value={code} onChange={event=>setCode(event.target.value)} placeholder="Личный код" required minLength={16} maxLength={256}/><button type="submit" disabled={busy||code.trim().length<16}>Подключить</button></div></form>:<div className="push-actions">{status?.subscribed?<><button className="push-enable" type="button" onClick={()=>void test()} disabled={busy}><Send size={14}/> Проверить доставку</button><button type="button" onClick={()=>void disable()} disabled={busy}>Отключить</button></>:<button className="push-enable" type="button" onClick={()=>void enable()} disabled={busy||denied}><BellRing size={15}/> {busy?'Подключаем…':'Включить уведомления'}</button>}</div>}
   {denied&&<p className="push-note">Уведомления запрещены. Разрешите их в настройках сайта или приложения Meridian на устройстве и откройте сайт снова.</p>}
  </>}
  {status?.subscribed&&<p className="push-note">{status.error?'Сбор новостей временно задерживается. Новые сигналы появятся после восстановления источника.':status.lastCheckedAt?'Сервис проверял новости '+new Date(status.lastCheckedAt).toLocaleString('ru-RU',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'Ожидаем первую проверку новостей.'}</p>}
  {error&&<p className="push-message push-error" role="alert">{error}</p>}{message&&<p className="push-message" role="status">{message}</p>}
 </section>;
}
