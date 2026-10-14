'use client';
import {useState} from 'react';
export default function PendingCheckout({orderId}:{orderId:string}){
 const[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 async function act(action:string){setBusy(true);try{const response=await fetch(`/api/tickets/orders/${orderId}/checkout`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action})});const result=await response.json();if(!response.ok)throw new Error(result.error);if(result.url)window.location.assign(result.url);else setMessage(result.message);}catch(error){setMessage(error instanceof Error?error.message:'Please try again.');}finally{setBusy(false);}}
 return <section><p>This checkout is awaiting payment confirmation. Check its status before paying again.</p><button disabled={busy} onClick={()=>act('resume')}>Resume checkout</button> <button disabled={busy} onClick={()=>act('cancel')}>Cancel unpaid checkout</button><p role="status">{message}</p></section>;
}
