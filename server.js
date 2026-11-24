const express = require("express");
const session = require("express-session");
const SQLiteStore = require("connect-sqlite3")(session);
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const helmet = require("helmet");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const DATA = path.join(ROOT, "data");
const UPLOADS = path.join(ROOT, "uploads");
for (const dir of [DATA, UPLOADS]) fs.mkdirSync(dir, {recursive:true});

if (!process.env.SESSION_SECRET || !process.env.ADMIN_PASSWORD) {
  console.error("Thiếu SESSION_SECRET hoặc ADMIN_PASSWORD. Hãy tạo file .env từ .env.example và nạp biến môi trường.");
  process.exit(1);
}

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({limit:"1mb"}));
app.use(express.urlencoded({extended:true}));
app.use(session({
  store: new SQLiteStore({db:"sessions.sqlite", dir:DATA}),
  secret:process.env.SESSION_SECRET,
  resave:false, saveUninitialized:false,
  cookie:{httpOnly:true, sameSite:"lax", secure:process.env.NODE_ENV === "production", maxAge: 8*60*60*1000}
}));

const db = new Database(path.join(DATA,"shop.sqlite"));
db.pragma("journal_mode = WAL");
db.exec(`
CREATE TABLE IF NOT EXISTS admins (id INTEGER PRIMARY KEY, username TEXT UNIQUE, password_hash TEXT);
CREATE TABLE IF NOT EXISTS products (
 id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, category TEXT DEFAULT 'Sản phẩm số',
 version TEXT DEFAULT '', description TEXT DEFAULT '', price INTEGER NOT NULL DEFAULT 0,
 image TEXT DEFAULT '', download_file TEXT DEFAULT '', active INTEGER DEFAULT 1,
 created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS orders (
 id INTEGER PRIMARY KEY AUTOINCREMENT, customer TEXT NOT NULL, phone TEXT DEFAULT '',
 product_id INTEGER, product_name TEXT NOT NULL, amount INTEGER NOT NULL,
 note TEXT DEFAULT '', status TEXT DEFAULT 'Chờ xác nhận',
 created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT DEFAULT '');
`);
const adminCount = db.prepare("SELECT COUNT(*) n FROM admins").get().n;
if (!adminCount) {
  db.prepare("INSERT INTO admins(username,password_hash) VALUES(?,?)")
    .run(process.env.ADMIN_USERNAME || "admin", bcrypt.hashSync(process.env.ADMIN_PASSWORD, 12));
}
const defaultSettings = {
 shop_name: process.env.SHOP_NAME || "ANHPHUC SHOP",
 bank_name: process.env.BANK_NAME || "",
 bank_account: process.env.BANK_ACCOUNT || "",
 bank_owner: process.env.BANK_OWNER || "",
 payment_note: "Ghi nội dung chuyển khoản theo mã đơn hàng. Đơn chỉ được xác nhận sau khi chủ shop kiểm tra."
};
const insertSetting = db.prepare("INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)");
for (const [k,v] of Object.entries(defaultSettings)) insertSetting.run(k,v);

const storage = multer.diskStorage({
 destination:(req,file,cb)=>cb(null,UPLOADS),
 filename:(req,file,cb)=>{
   const ext = path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g,"");
   cb(null, Date.now()+"-"+Math.random().toString(36).slice(2,10)+ext);
 }
});
const upload = multer({
 storage,
 limits:{fileSize:50*1024*1024},
 fileFilter:(req,file,cb)=>{
   const ok = /\.(png|jpe?g|webp|gif|zip|7z|rar|txt|pdf|apk|sh|json)$/i.test(file.originalname);
   cb(ok ? null : new Error("Định dạng tệp chưa được hỗ trợ."), ok);
 }
});
app.use("/uploads", express.static(UPLOADS));
app.use(express.static(path.join(ROOT,"public")));

function adminOnly(req,res,next){ if(req.session.adminId) return next(); return res.status(401).json({error:"Vui lòng đăng nhập ADMIN."}); }
function getSettings(){
 const rows=db.prepare("SELECT key,value FROM settings").all();
 return Object.fromEntries(rows.map(x=>[x.key,x.value]));
}
app.get("/api/shop",(req,res)=>{
 const products=db.prepare("SELECT id,name,category,version,description,price,image FROM products WHERE active=1 ORDER BY id DESC").all();
 const s=getSettings();
 res.json({products, settings:{shop_name:s.shop_name,bank_name:s.bank_name,bank_account:s.bank_account,bank_owner:s.bank_owner,payment_note:s.payment_note}});
});
app.post("/api/orders",(req,res)=>{
 const {customer,phone,productId,note}=req.body||{};
 if(!customer || !productId) return res.status(400).json({error:"Thiếu tên người mua hoặc sản phẩm."});
 const p=db.prepare("SELECT * FROM products WHERE id=? AND active=1").get(Number(productId));
 if(!p) return res.status(404).json({error:"Sản phẩm không tồn tại hoặc đã ẩn."});
 const info=db.prepare("INSERT INTO orders(customer,phone,product_id,product_name,amount,note) VALUES(?,?,?,?,?,?)")
  .run(String(customer).slice(0,100),String(phone||"").slice(0,40),p.id,p.name,p.price,String(note||"").slice(0,500));
 res.json({ok:true,orderId:info.lastInsertRowid,amount:p.price,message:"Đã tạo đơn. Hãy chuyển khoản và chờ ADMIN xác nhận."});
});
app.post("/api/admin/login",(req,res)=>{
 const {username,password}=req.body||{};
 const a=db.prepare("SELECT * FROM admins WHERE username=?").get(String(username||""));
 if(!a || !bcrypt.compareSync(String(password||""),a.password_hash)) return res.status(401).json({error:"Sai tài khoản hoặc mật khẩu."});
 req.session.adminId=a.id;
 res.json({ok:true});
});
app.post("/api/admin/logout",adminOnly,(req,res)=>req.session.destroy(()=>res.json({ok:true})));
app.get("/api/admin/me",(req,res)=>res.json({loggedIn:!!req.session.adminId}));
app.get("/api/admin/products",adminOnly,(req,res)=>res.json(db.prepare("SELECT * FROM products ORDER BY id DESC").all()));
app.post("/api/admin/products",adminOnly,upload.fields([{name:"image",maxCount:1},{name:"download",maxCount:1}]),(req,res)=>{
 const b=req.body, image=req.files.image?.[0]?.filename || "", download=req.files.download?.[0]?.filename || "";
 if(!b.name || !Number.isFinite(Number(b.price)) || Number(b.price)<0) return res.status(400).json({error:"Tên và giá sản phẩm không hợp lệ."});
 const r=db.prepare("INSERT INTO products(name,category,version,description,price,image,download_file,active) VALUES(?,?,?,?,?,?,?,?)")
  .run(b.name,b.category||"Sản phẩm số",b.version||"",b.description||"",Math.round(Number(b.price)),image,download,b.active==="false"?0:1);
 res.json({ok:true,id:r.lastInsertRowid});
});
app.put("/api/admin/products/:id",adminOnly,upload.fields([{name:"image",maxCount:1},{name:"download",maxCount:1}]),(req,res)=>{
 const old=db.prepare("SELECT * FROM products WHERE id=?").get(Number(req.params.id));
 if(!old) return res.status(404).json({error:"Không tìm thấy sản phẩm."});
 const b=req.body;
 db.prepare("UPDATE products SET name=?,category=?,version=?,description=?,price=?,image=?,download_file=?,active=? WHERE id=?")
 .run(b.name||old.name,b.category||old.category,b.version??old.version,b.description??old.description,
 Math.max(0,Math.round(Number(b.price??old.price))),req.files.image?.[0]?.filename||old.image,
 req.files.download?.[0]?.filename||old.download_file,b.active==="false"?0:1,old.id);
 res.json({ok:true});
});
app.delete("/api/admin/products/:id",adminOnly,(req,res)=>{
 db.prepare("DELETE FROM products WHERE id=?").run(Number(req.params.id)); res.json({ok:true});
});
app.get("/api/admin/orders",adminOnly,(req,res)=>res.json(db.prepare("SELECT * FROM orders ORDER BY id DESC").all()));
app.patch("/api/admin/orders/:id",adminOnly,(req,res)=>{
 const allowed=["Chờ xác nhận","Đã thanh toán","Đã giao file","Đã hủy"];
 if(!allowed.includes(req.body.status)) return res.status(400).json({error:"Trạng thái không hợp lệ."});
 db.prepare("UPDATE orders SET status=? WHERE id=?").run(req.body.status,Number(req.params.id)); res.json({ok:true});
});
app.get("/api/admin/settings",adminOnly,(req,res)=>res.json(getSettings()));
app.put("/api/admin/settings",adminOnly,(req,res)=>{
 const allowed=["shop_name","bank_name","bank_account","bank_owner","payment_note"];
 const stmt=db.prepare("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value");
 for(const k of allowed) if(req.body[k]!==undefined) stmt.run(k,String(req.body[k]));
 res.json({ok:true});
});
app.post("/api/admin/password",adminOnly,(req,res)=>{
 const {oldPassword,newPassword}=req.body||{};
 const a=db.prepare("SELECT * FROM admins WHERE id=?").get(req.session.adminId);
 if(!bcrypt.compareSync(String(oldPassword||""),a.password_hash)) return res.status(400).json({error:"Mật khẩu hiện tại không đúng."});
 if(String(newPassword||"").length<12) return res.status(400).json({error:"Mật khẩu mới cần ít nhất 12 ký tự."});
 db.prepare("UPDATE admins SET password_hash=? WHERE id=?").run(bcrypt.hashSync(newPassword,12),a.id);
 res.json({ok:true});
});
app.get("/api/download/:id",adminOnly,(req,res)=>{
 const o=db.prepare("SELECT * FROM orders WHERE id=? AND status IN ('Đã thanh toán','Đã giao file')").get(Number(req.params.id));
 if(!o) return res.status(403).send("Đơn chưa được xác nhận thanh toán.");
 const p=db.prepare("SELECT download_file FROM products WHERE id=?").get(o.product_id);
 if(!p?.download_file) return res.status(404).send("Sản phẩm chưa có tệp tải lên.");
 res.download(path.join(UPLOADS,p.download_file));
});
app.use((err,req,res,next)=>{ console.error(err.message); res.status(400).json({error:err.message||"Có lỗi xảy ra."}); });
app.listen(PORT,()=>console.log(`ANHPHUC SHOP đang chạy tại http://localhost:${PORT}`));
