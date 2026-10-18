# NomNom — Food Delivery

Илгээсэн Food Delivery шаардлага, ERD, архитектур болон Figma-ийн хэрэглэгч/админы дэлгэцүүдэд тулгуурласан Next.js + Express төсөл.

## Харах

- Нүүр: http://localhost:3001
- Бүртгэл: http://localhost:3001/signup
- Нэвтрэх: http://localhost:3001/login
- Админы хоолны цэсийн жишээ: http://localhost:3001/admin/food-menu/preview
- Админы захиалгын жишээ: http://localhost:3001/admin/orders/preview
- Бодит админ: http://localhost:3001/admin/food-menu болон /admin/orders
- API health: http://127.0.0.1:4000/health

`/preview` замын админ хэсэг нь 32 зохиомол захиалга, локал жишээ хоолтой. Энд хийсэн засвар тухайн браузерийн preview-д л үйлчилж, refresh хийхэд анхны байдалдаа орно. Бодит админ хуудсууд API-тай холбогддог бөгөөд ADMIN эрх шаардана.

## Ажиллуулах

Node.js 24, npm ашигласан. Эх код: `/Users/megna/Desktop/food-delivery`.

```bash
cd ~/Desktop/food-delivery
npm run install:all
npm run dev
```

Сангууд суусан бол install-ыг давтах шаардлагагүй. Root dev нь API 4000, frontend 3000-ыг хамт асаана; ажиллаж байгаа серверийг давхар асаахгүй. Frontend webpack болон polling ашиглаж, энэ компьютерийн file-watcher хязгаарыг тойрдог.

Тогтвортой production preview-г тусдаа хоёр terminal-д асаана:

```bash
cd ~/Desktop/food-delivery/server
npm start
```

```bash
cd ~/Desktop/food-delivery
npm run preview
```

Preview нь 3001 дээр ажиллаж, `.next-preview` хавтсанд build хийнэ. Код өөрчилбөл preview-ийн terminal-ыг Ctrl+C-ээр зогсоож `npm run preview` дахин ажиллуулна. Хэрэглэгчийн өмнө асаасан 3000 серверийг энэ ажлын үед зогсоогоогүй; хуучин харагдац үзүүлбэл түүний terminal-аас restart хийнэ.

## Бэлэн үйлдлүүд

- Имэйл → нууц үг/давталт гэсэн хоёр алхамт signup; show/hide, validation, disabled/active button.
- Имэйл баталгаажуулах, дахин илгээх cooldown, login/logout, password reset link болон шинэ нууц үг.
- Нийтэд нээлттэй цэс, Figma-ийн эх offer banner болон эх хоолны зургууд, гурван баганат картууд, footer.
- Хоолны дэлгэрэнгүй, тоо ширхэг сонгох, нэмэх toast; нэмсний дараа modal нээлттэй үлдэнэ.
- Cart/Order drawer; нэмэх/хасах/устгах; хоосон төлөв; хаяг оруулах/шалгах; Items/Shipping/Total.
- Нэвтрээгүй checkout-д login сануулга; login дамжихад сагс хадгалах; захиалгын амжилтын modal болон түүх.
- Админы ангиллын шүүлтүүр, бодит тоолуур, ангилал нэмэх.
- Хоол нэмэх, зураг сонгох/drop хийх, урьдчилан харах/арилгах; нэр, орц, үнэ, ангилал, зураг засах.
- Хоол устгах, 60 секундийн Undo. Хуучин захиалгын хоолны мэдээлэл snapshot-аар хадгалагдана.
- Захиалгын хүснэгт: хоолны дэлгэрэнгүй hover/click, огноо/төлөвийн эрэмбэ, огнооны хүрээ, 12 мөрийн pagination.
- Checkbox сонголт; нэг болон олон захиалгын Pending/Delivered/Cancelled төлөв шинэчлэх.
- API дээр USER/ADMIN эрх, серверийн үнэ/тоон шалгалт, давхар checkout-оос хамгаалах request ID.

## Админ эрх олгох

Бүртгэл үүсгэхэд USER эрхтэй. Өөрийн админ болгох имэйлийг зориудаар сонгоно; хэн нэгний бүртгэлийг автоматаар дэвшүүлээгүй.

1. Signup хийж имэйлээ баталгаажуулна. SMTP-гүй local горимд UI-ийн `Development email preview` холбоос ашиглаж болно.
2. Local API ажиллаж байгаа terminal дээр Ctrl+C дарж зогсооно.
3. Дараах командыг **өөрийн баталгаажсан имэйлээр** ажиллуулна.

```bash
cd ~/Desktop/food-delivery/server
npm run admin:grant -- --email your-verified-email@example.com
npm start
```

4. Браузерт дахин login хийгээд `/admin/food-menu` эсвэл `/admin/orders` нээнэ.

Local JSON store-ийн in-memory мэдээллийг давхар дарж бичихээс сэргийлж, role олгох script ажиллаж байгаа API-г илрүүлбэл зогсоно. MongoDB ашиглаж байгаа үед мөн ADMIN эрхийг зөвхөн сонгосон баталгаажсан хэрэглэгчид өгнө.

## Өгөгдөл болон үйлчилгээний тохиргоо

Одоогийн preview нь local development горимд байна:

- User/category/food/order/session мэдээлэл `server/.data/database.json`-д хадгалагдана.
- Password bcrypt hash; JWT нь HttpOnly cookie; password/JWT localStorage-д хадгалахгүй.
- Browser localStorage-д сагс болон хаяг хадгалагдана. Logout хаягийг цэвэрлэнэ.
- SMTP-гүй үед баталгаажуулах/reset холбоосыг зөвхөн development UI харуулна; бодит имэйл явуулахгүй.
- JWT_SECRET-гүй local горимд сервер restart бүр шинэ secret үүсэх тул дахин login шаардана.
- Upload: JPG/PNG/WebP, 5 MB хүртэл; сервер бодит дүрсийг шалгаж, EXIF metadata-г арилган WebP болгоно. Local файл `server/.data/uploads`-д хадгалагдана.
- Захиалгын хүргэлт $0.99. Онлайн төлбөр, жолоочийн tracking, бараа материалын удирдлага нь өгөгдсөн NON-GOALS-д багтсан тул хийгдээгүй.

Бодит үйлчилгээнд холбохдоо `server/.env.example`-ээс `server/.env` үүсгээд:

- `MONGODB_URI`, тогтмол урт `JWT_SECRET`;
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`;
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`;
- `CLIENT_ORIGIN`-д бодит frontend origin тохируулна.

Frontend `client/.env.local`-ийн `API_URL` нь Express серверийн URL. `/api/*` хүсэлтийг Next.js proxy дамжуулдаг тул энэ утгыг сольсны дараа frontend-ийг rebuild/restart хийнэ. Cloudinary secret зөвхөн серверт байна. Production-д MongoDB/JWT_SECRET/SMTP байхгүй бол сервер асахгүй; Cloudinary-гүй production upload 503 өгнө.

MongoDB Atlas, бодит SMTP, Cloudinary account болон Vercel/Render deployment-ийг credentials өгөөгүй тул гадаад үйлчилгээнд ажиллуулж шалгаагүй. Эдгээрийг холбох code/config бэлэн.

## Загварын өгөгдлийн тайлбар

Хоолны нэр, $12.99 үнэ, давтагдсан description нь Figma-ийн demo content. Жинхэнэ цэсийг админ хэсгээс солих боломжтой. Seed: 10 ангилал, 17 хоол; нүүрэнд хоолтой дөрвөн бүлэг харагдана; тоолуур нь жинхэнэ тоог бодно, prototype-ийн жишээ 112-г тогтмол харуулахгүй.

Сүүлийн гурван картын гарчгийг prototype дээр дахин `Salads` гэж бичсэн. Давхар нэртэй ангилал үүсгэхийн оронд энэ бүлгийг `Main dishes` болгон ялгасан. Footer дахь хоосон ангилал, нийтлээгүй policy/social/contact мэдээлэл нь тайлбарын цонх нээдэг. Бодит холбоос/контент өгөөгүй тул зохиож оруулаагүй.

Figma-ийн 43 дахь хар frame хоёр удаа орсон гэдгийг хэрэглэгч тодруулсан; үүнийг сайтын тусдаа хуудас болгоогүй. Захиалгын амжилтын хүүхэд/бөмбөлгийн дүрслэл нь кодоор хийсэн SVG; эх artwork-ийн яг экспорт биш.

## Бүтэц

```text
client/src/app/                 Next.js routes, styles
client/src/components/auth/     Auth forms
client/src/components/admin/    Food menu and orders dashboards
client/src/components/          Storefront, food detail, cart, shared UI
client/src/lib/                 API client, types, seed catalog
client/public/images/           Local design assets
server/src/app.js               Auth, category/food CRUD, customer orders
server/src/admin.js             Admin orders, bulk status, image upload
server/src/store.js             MongoDB models + local JSON development store
server/scripts/grant-admin.js   Explicit admin role setup
server/test/api.test.js         Isolated API integration tests
```

## Шалгах

```bash
cd ~/Desktop/food-delivery
npm test
npm run build
```

API-ийн 11 integration test: hash/verification, серверийн total/idempotency, хэрэглэгчийн эрх, validation/origin, reset expiry/one-use/session revoke, logout, admin pagination/sort/redaction, Улаанбаатарын огнооны хил, single/bulk status, food CRUD/Undo/order snapshot, image upload болон category constraints.

Browser дээр storefront modal/cart/guest login gate, admin selection/bulk/single status/pagination/date filter, category add, empty validation, image chooser/preview, dish add/edit/category change/delete/Undo-ийг шалгасан. Auth/signup/verification/login/address/checkout/history урсгалыг өмнөх шатанд local test account-аар шалгасан. Production build болон TypeScript шалгалт амжилттай.

Эх кодын архивт `.env`, local database/upload, node_modules, `.next*` build болон test account мэдээлэл орохгүй.
