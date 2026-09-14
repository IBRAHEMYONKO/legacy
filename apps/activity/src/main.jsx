import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { DiscordSDK } from '@discord/embedded-app-sdk';
import './style.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const discordClientId = import.meta.env.VITE_DISCORD_CLIENT_ID || '';

function App(){
  const [discordUser,setDiscordUser]=useState(null);
  const [me,setMe]=useState(null);
  const [error,setError]=useState('');

  useEffect(()=>{
    let active=true;
    (async()=>{
      if(!discordClientId) return;
      try{
        const sdk=new DiscordSDK(discordClientId);
        await sdk.ready();
        const auth=await sdk.commands.authorize({client_id:discordClientId,response_type:'code',state:'legacy',prompt:'none',scope:['identify']});
        const r=await fetch(`${API}/activity/auth`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:auth.code})});
        const data=await r.json();
        if(active){setDiscordUser(data.discordUser||null);setMe(data.me||null)}
      }catch(e){if(active)setError('تعذر ربط Activity بالحساب حالياً.')}
    })();
    return()=>{active=false};
  },[]);

  return <main className="activity"><div className="top"><b>LEGACY</b><span>DISCORD ACTIVITY</span></div><section className="card"><div className="logo">L</div><h1>LEGACY</h1><p>تجربة اجتماعية داخل Discord مرتبطة بنفس حسابك في الموقع والبوت.</p>{error&&<div className="error">{error}</div>}<div className="profile"><span>{discordUser?.global_name||discordUser?.username||'جارٍ التحقق من حساب Discord...'}</span><strong>{me?.points??'—'} نقطة</strong></div><div className="features"><span>👤 بروفايل</span><span>🪙 نقاط</span><span>🎒 حقيبة</span><span>👥 مجتمع</span><span>🛒 متجر</span><span>💎 Premium</span></div></section></main>
}
createRoot(document.getElementById('root')).render(<App/>);
