import{n as e,r as t,t as n}from"./supabase-CQA5XZYd.js";import{t as r}from"./whatsapp-BBMi4IOw.js";var i=t((()=>{n();var t=e=>e.toLowerCase().split(` `).map(e=>e.charAt(0).toUpperCase()+e.slice(1)).join(` `),r=e=>{let t=e.replace(/\D/g,``);return t.startsWith(`0`)&&(t=`62`+t.slice(1)),t},i=document.getElementById(`fullName`),a=document.getElementById(`wa`);i.addEventListener(`blur`,()=>{i.value&&=t(i.value.trim())}),a.addEventListener(`blur`,()=>{a.value&&=r(a.value.trim())}),document.getElementById(`registerForm`).addEventListener(`submit`,async t=>{t.preventDefault();let n=document.getElementById(`fullName`).value.trim(),r=document.getElementById(`wa`).value.trim(),i=document.getElementById(`email`).value.trim(),a=document.getElementById(`password`).value;if(!n||!r||!i||!a){document.getElementById(`errorMessage`).textContent=`Semua data wajib diisi.`;return}let o=document.getElementById(`registerBtn`),s=o.querySelector(`span`);s.textContent=`Memproses...`,o.disabled=!0;try{let{data:t,error:o}=await e.auth.signUp({email:i.includes(`@`)?i:`${i}@qurban.com`,password:a,options:{data:{full_name:n,wa_number:r}}});if(o)throw o;if(t.user){let{error:o}=await e.from(`profiles`).insert({id:t.user.id,full_name:n,wa_number:r,email:i,role:`staff`,status:`pending`});if(o)throw o;try{if(window.sendWa&&window.parseWaTemplate){let e=(window.getWaConfig?await window.getWaConfig():{}).templateDaftar||`*Pendaftaran Berhasil*
==========================

Assalamu’Alaikum, *[[NAMA]]*.

Terima Kasih Telah Mendaftar Menjadi Bagian Pejuang Qurban.

Berikut Adalah Data Yang Anda Entri:
👤 Nama: [[NAMA]]
📧 Username/Email: [[EMAIL]]
🔑 Password: [[PASSWORD]]

⚠️ *Penting:*
1. Mohon Jangan Memberitahukan Username Dan Password Anda Kepada Siapapun.
2. Saat Ini Anda *Belum Bisa Login*. Akun Anda Sedang Dalam Status *Pending*. Silakan Menunggu Konfirmasi (Approval) Dari Manajemen Sebelum Dapat Digunakan.

Terima Kasih.`,t=await window.parseWaTemplate(e,{nama:n,email:i,password:a});await window.sendWa(r,t)}}catch(e){console.warn(`WA Auth notification failed:`,e)}let s=document.createElement(`div`);s.className=`modal-overlay-custom`,s.innerHTML=`
                        <div class="modal-custom">
                            <div class="modal-custom-icon" style="color:var(--success);">✅</div>
                            <h3 class="modal-custom-title" style="margin-bottom:1rem; color:var(--text-main);">Pendaftaran Berhasil!</h3>
                            <p class="modal-custom-body" style="margin-bottom:1.5rem; color:var(--text-muted);">Akun Anda sedang menunggu persetujuan admin. Silakan tunggu konfirmasi melalui WhatsApp.</p>
                            <button class="btn btn-primary btn-block" id="btnCustomAlertOk">Lanjutkan ke Halaman Login</button>
                        </div>
                    `,document.body.appendChild(s),document.getElementById(`btnCustomAlertOk`).onclick=()=>{window.location.href=`index.html`}}}catch(e){console.error(e),document.getElementById(`errorMessage`).textContent=`Terjadi kesalahan: `+e.message,s.textContent=`Daftar Sekarang`,o.disabled=!1}})}));r(),i();