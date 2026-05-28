# Content Queue Frontend

หน้าเว็บนี้ใช้สำหรับกรอกคอนเทนต์ลง Google Sheet `n8n Facebook Multi Page Content Queue`

## ไฟล์สำคัญ

- `index.html` หน้าเว็บหลัก
- `styles.css` ดีไซน์ responsive สำหรับมือถือ แท็บเล็ต และเดสก์ท็อป
- `app.js` ฟอร์ม เลือกหลายเพจ โหลดตาราง และส่งข้อมูล
- `config.js` ตั้งค่า URL ของ API
- `functions/api/queue.js` Cloudflare Pages Function สำหรับส่งต่อข้อมูลไป Apps Script
- `apps-script/Code.gs` ตัวกลาง Google Apps Script สำหรับเขียนลงชีตและอัปโหลดไฟล์

## วิธีติดตั้ง Google Apps Script

1. เปิด Google Sheet ปลายทาง
2. ไปที่ Extensions > Apps Script
3. วางโค้ดจาก `apps-script/Code.gs`
4. ถ้าต้องการให้ไฟล์อัปโหลดเข้าโฟลเดอร์เฉพาะ ให้ใส่ `DRIVE_FOLDER_ID`
5. Deploy > New deployment > Web app
6. Execute as: Me
7. Who has access: Anyone with the link
8. Copy Web app URL เก็บไว้ใช้ใน Cloudflare variable ชื่อ `APPS_SCRIPT_URL`

## Deploy ผ่าน Cloudflare Pages

1. Push โฟลเดอร์นี้ขึ้น GitHub
2. สร้าง Cloudflare Pages project แล้วเลือก repo
3. Build command เว้นว่าง
4. Output directory ใช้ `.`
5. ตั้งค่า Environment variable ชื่อ `APPS_SCRIPT_URL` เป็น Web app URL จาก Apps Script
6. Deploy ได้ทันที

ค่าเริ่มต้นใน `config.js` คือ `/api/queue` เพื่อให้หน้าเว็บเรียก Cloudflare Function ในโดเมนเดียวกัน
