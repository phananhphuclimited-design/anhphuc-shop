const money=n=>new Intl.NumberFormat("vi-VN").format(n)+"đ";
let shop={};
async function loadShop(){
 const r=await fetch("/api/shop");shop=await r.json();
 document.title=shop.settings.shop_name;document.getElementById("shopName").textContent=shop.settings.shop_name;
 document.getElementById("paymentNote").textContent=shop.settings.payment_note||"";
 const s=shop.settings;
 document.getElementById("bankInfo").innerHTML=`<b>${esc(s.bank_name||"Chưa cập nhật ngân hàng")}</b><br>Chủ TK: ${esc(s.bank_owner||"")}<br>Số tài khoản: ${esc(s.bank_account||"")}`;
 const root=document.getElementById("products");
 root.innerHTML=shop.products.length?shop.products.map(p=>`<article class="product"><img src="${p.image?"/uploads/"+encodeURIComponent(p.image):"https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800"}" alt=""><div class="body"><span class="tag">${esc(p.category)} ${p.version? "• "+esc(p.version):""}</span><h3>${esc(p.name)}</h3><p>${esc(p.description||"Sản phẩm số từ ANHPHUC SHOP.")}</p><div class="price">${money(p.price)}</div><button class="buy" onclick="openBuy(${p.id},'${jsq(p.name)}')">MUA NGAY →</button></div></article>`).join(""):'<div class="empty">Chưa có sản phẩm. Chủ shop có thể đăng sản phẩm trong trang QUẢN TRỊ.</div>';
}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function jsq(s){return String(s).replace(/\\/g,"\\\\").replace(/'/g,"\\'");}
function openBuy(id,name){document.getElementById("productId").value=id;document.getElementById("buyTitle").textContent=name;document.getElementById("orderResult").textContent="";document.getElementById("buyModal").classList.remove("hidden")}
function closeModal(){document.getElementById("buyModal").classList.add("hidden")}
document.getElementById("orderForm").addEventListener("submit",async e=>{
 e.preventDefault();const data={customer:customer.value,phone:phone.value,productId:productId.value,note:note.value};
 const r=await fetch("/api/orders",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});const j=await r.json();
 document.getElementById("orderResult").textContent=j.ok?`Tạo đơn thành công! Mã đơn #${j.orderId}. Giá trị: ${money(j.amount)}. ${j.message}`:j.error;
});
document.getElementById("year").textContent=new Date().getFullYear();loadShop().catch(()=>document.getElementById("products").innerHTML='<div class="empty">Không kết nối được máy chủ.</div>');