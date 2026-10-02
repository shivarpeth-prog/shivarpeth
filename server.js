const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const Database = require('better-sqlite3');
const multer = require('multer');
const helmet = require('helmet');
const cookieSession = require('cookie-session');
require('dotenv').config?.();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const APP_NAME = process.env.APP_NAME || 'Shivar Peth';
const PAYMENT_AMOUNT = Number(process.env.PAYMENT_AMOUNT || 199);
const UPI_ID = process.env.UPI_ID || '7875721876@slc';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'CHANGE-THIS-PASSWORD';
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB || 5);
const ROOT = __dirname;
const DB_DIR = path.join(ROOT, 'data');
const UPLOAD_DIR = path.join(ROOT, 'uploads');
fs.mkdirSync(DB_DIR, {recursive:true}); fs.mkdirSync(UPLOAD_DIR, {recursive:true});

const db = new Database(path.join(DB_DIR,'shivar-peth.db'));
db.pragma('journal_mode = WAL');
db.exec(`CREATE TABLE IF NOT EXISTS payments (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 utr TEXT NOT NULL UNIQUE,
 screenshot TEXT NOT NULL,
 name TEXT NOT NULL,
 mobile TEXT NOT NULL,
 post_text TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending',
 admin_note TEXT DEFAULT '',
 created_at TEXT NOT NULL,
 reviewed_at TEXT
);`);

db.exec(`CREATE TABLE IF NOT EXISTS posts (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 payment_id INTEGER NOT NULL,
 name TEXT NOT NULL,
 mobile TEXT NOT NULL,
 post_text TEXT NOT NULL,
 created_at TEXT NOT NULL,
 FOREIGN KEY(payment_id) REFERENCES payments(id)
);`);

app.set('view engine','ejs'); app.set('views',path.join(ROOT,'views'));
app.use(helmet({contentSecurityPolicy:false}));
app.use(express.urlencoded({extended:true, limit:'1mb'}));
app.use(express.json({limit:'1mb'}));
app.use(cookieSession({name:'shivar_session',secret:SESSION_SECRET,httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',maxAge:8*60*60*1000}));
app.use('/static',express.static(path.join(ROOT,'public')));
app.use('/uploads',express.static(UPLOAD_DIR,{fallthrough:false}));

const storage = multer.diskStorage({
 destination:(req,file,cb)=>cb(null,UPLOAD_DIR),
 filename:(req,file,cb)=>{
  const ext = path.extname(file.originalname).toLowerCase();
  cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`);
 }
});
const allowed = new Set(['image/jpeg','image/png','image/webp']);
const upload = multer({storage, limits:{fileSize:MAX_UPLOAD_MB*1024*1024}, fileFilter:(req,file,cb)=>allowed.has(file.mimetype)?cb(null,true):cb(new Error('Only JPG, PNG or WEBP screenshots are allowed.'))});

function requireAdmin(req,res,next){ if(req.session?.admin) return next(); res.redirect('/admin/login'); }
function clean(v,max=200){return String(v??'').trim().slice(0,max);}
function validMobile(v){return /^[0-9+()\-\s]{8,18}$/.test(v);}
function validUTR(v){return /^[A-Za-z0-9\-]{6,40}$/.test(v);}
function escError(err){return err?.message || 'Something went wrong.';}

app.get('/',(req,res)=>res.render('index',{appName:APP_NAME,amount:PAYMENT_AMOUNT,upiId:UPI_ID,error:null,success:null}));
app.post('/payment',upload.single('screenshot'),(req,res)=>{
 const name=clean(req.body.name,80), mobile=clean(req.body.mobile,30), utr=clean(req.body.utr,40), postText=clean(req.body.post_text,1000);
 if(!name||!mobile||!validMobile(mobile)||!validUTR(utr)||!postText||!req.file){
  if(req.file) fs.unlinkSync(req.file.path);
  return res.status(400).render('index',{appName:APP_NAME,amount:PAYMENT_AMOUNT,upiId:UPI_ID,error:'कृपया नाव, मोबाईल, योग्य UTR, पोस्ट आणि payment screenshot सर्व भरा.',success:null});
 }
 try{
  const exists=db.prepare('SELECT id FROM payments WHERE utr=?').get(utr);
  if(exists){fs.unlinkSync(req.file.path);return res.status(409).render('index',{appName:APP_NAME,amount:PAYMENT_AMOUNT,upiId:UPI_ID,error:'हा UTR आधीच submit झाला आहे.',success:null});}
  db.prepare('INSERT INTO payments (utr,screenshot,name,mobile,post_text,status,created_at) VALUES (?,?,?,?,?,?,?)').run(utr,'/uploads/'+path.basename(req.file.path),name,mobile,postText,'pending',new Date().toISOString());
  res.render('success',{appName:APP_NAME,utr});
 }catch(e){ if(req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path); res.status(500).render('index',{appName:APP_NAME,amount:PAYMENT_AMOUNT,upiId:UPI_ID,error:'Server error. पुन्हा प्रयत्न करा.',success:null}); }
});

app.get('/posts',(req,res)=>{const posts=db.prepare('SELECT id,name,mobile,post_text,created_at FROM posts ORDER BY id DESC').all();res.render('posts',{appName:APP_NAME,posts});});
app.get('/admin/login',(req,res)=>res.render('admin-login',{appName:APP_NAME,error:null}));
app.post('/admin/login',(req,res)=>{const u=clean(req.body.username,100),p=String(req.body.password||''); if(u===ADMIN_USERNAME&&p===ADMIN_PASSWORD){req.session.admin=true;return res.redirect('/admin');}res.status(401).render('admin-login',{appName:APP_NAME,error:'Invalid username or password.'});});
app.post('/admin/logout',(req,res)=>{req.session=null;res.redirect('/admin/login');});
app.get('/admin',requireAdmin,(req,res)=>{const payments=db.prepare('SELECT * FROM payments ORDER BY id DESC').all();res.render('admin',{appName:APP_NAME,payments});});
app.post('/admin/payment/:id/approve',requireAdmin,(req,res)=>{const id=Number(req.params.id);const p=db.prepare('SELECT * FROM payments WHERE id=?').get(id);if(!p||p.status!=='pending')return res.redirect('/admin');const tx=db.transaction(()=>{db.prepare("UPDATE payments SET status='approved',reviewed_at=?,admin_note=? WHERE id=?").run(new Date().toISOString(),clean(req.body.admin_note,300),id);db.prepare('INSERT INTO posts (payment_id,name,mobile,post_text,created_at) VALUES (?,?,?,?,?)').run(id,p.name,p.mobile,p.post_text,new Date().toISOString());});tx();res.redirect('/admin');});
app.post('/admin/payment/:id/reject',requireAdmin,(req,res)=>{const id=Number(req.params.id);const p=db.prepare('SELECT * FROM payments WHERE id=?').get(id);if(p&&p.status==='pending'){db.prepare("UPDATE payments SET status='rejected',reviewed_at=?,admin_note=? WHERE id=?").run(new Date().toISOString(),clean(req.body.admin_note,300),id);}res.redirect('/admin');});

app.use((err,req,res,next)=>{if(err instanceof multer.MulterError || err?.message?.includes('screenshot')) return res.status(400).render('index',{appName:APP_NAME,amount:PAYMENT_AMOUNT,upiId:UPI_ID,error:escError(err),success:null});next(err);});
app.use((req,res)=>res.status(404).send('Not found'));
app.listen(PORT,()=>console.log(`${APP_NAME} running on http://localhost:${PORT}`));
