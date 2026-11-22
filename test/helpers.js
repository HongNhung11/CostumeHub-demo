// Khung test hộp đen: mỗi file test có CSDL + máy chủ riêng, chỉ nói chuyện qua HTTP / webhook / SQL.
// Không gọi SePay, không gửi email thật.
const cp = require('node:child_process');
const crypto = require('node:crypto');
const net = require('node:net');
const path = require('node:path');
const { Client } = require('pg');

const ROOT = path.join(__dirname, '..');
const HOST = process.env.TEST_DB_HOST;
if (!HOST) {
  throw new Error('Test cần Postgres riêng. Chạy: docker compose -p chregress -f docker-compose.test.yml run --build --rm test');
}
const PASSWORD = process.env.TEST_DB_PASSWORD;
const ADMIN_PASS = 'Admin-Test-12345', STAFF_PASS = 'Staff-Test-12345';
const ACCOUNT = '1017588888', HOOK_SECRET = 'test-only-webhook-secret';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const day = (n = 0) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' })
  .format(new Date(Date.now() + n * 864e5));

async function until(fn, ms = 20000, step = 250) {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v || Date.now() > end) return v;
    await sleep(step);
  }
}

function freePort() {
  return new Promise(resolve => {
    const s = net.createServer().listen(0, '127.0.0.1', () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });
}

// SMTP giả: giữ thư trong RAM, có thể giả lập máy chủ thư bị hỏng
async function fakeSmtp() {
  const state = { mails: [], down: false };
  const server = net.createServer(sock => {
    if (state.down) return sock.destroy();
    let buf = '', data = null, to = '';
    sock.on('error', () => {});
    sock.write('220 test\r\n');
    sock.on('data', d => {
      buf += d;
      let i;
      while ((i = buf.indexOf('\r\n')) >= 0) {
        const line = buf.slice(0, i);
        buf = buf.slice(i + 2);
        if (data !== null) {
          if (line === '.') { state.mails.push({ to, raw: data, text: decodeMail(data) }); data = null; sock.write('250 ok\r\n'); }
          else data += line + '\n';
        } else if (/^(EHLO|HELO)/i.test(line)) sock.write('250 test\r\n');
        else if (/^RCPT TO:/i.test(line)) { to = line.replace(/^RCPT TO:\s*<?([^>]*)>?.*$/i, '$1'); sock.write('250 ok\r\n'); }
        else if (/^DATA/i.test(line)) { data = ''; sock.write('354 go\r\n'); }
        else if (/^QUIT/i.test(line)) sock.end('221 bye\r\n');
        else sock.write('250 ok\r\n');
      }
    });
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  state.port = server.address().port;
  state.close = () => new Promise(r => server.close(r));
  return state;
}

function decodeMail(raw) {
  const qp = raw.replace(/=\n/g, '').replace(/(=[0-9A-F]{2})+/g, s => Buffer.from(s.slice(1).replace(/=/g, ''), 'hex').toString('utf8'));
  const body = raw.split('\n\n').slice(1).join('').replace(/\s/g, '');
  return qp + (/base64/i.test(raw) ? Buffer.from(body, 'base64').toString('utf8') : '');
}

// options.env: ghi đè biến môi trường · options.before(db): chạy trước khi máy chủ khởi động lần đầu
async function start({ env = {} } = {}) {
  const name = 'chtest_' + crypto.randomBytes(6).toString('hex');
  const conn = { host: HOST, user: 'postgres', password: PASSWORD };
  const root = new Client({ ...conn, database: 'postgres' });
  await root.connect();
  await root.query(`CREATE DATABASE ${name}`);
  await root.end();

  const smtp = await fakeSmtp();
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  let child = null, log = '', currentEnv = {};

  const baseEnv = {
    ...process.env,
    NODE_ENV: 'test', TZ: 'Asia/Ho_Chi_Minh', PORT: String(port), APP_URL: base,
    SESSION_SECRET: 'test-session-secret-test-session-secret-0000',
    DB_DIALECT: 'postgres', DB_HOST: HOST, DB_PORT: '5432', DB_NAME: name, DB_USER: 'postgres', DB_PASSWORD: PASSWORD,
    DEMO_DATA: 'true', ADMIN_PASSWORD: ADMIN_PASS, SHOW_DEMO_ACCOUNTS: 'false',
    SEPAY_MODE: 'off', SEPAY_BANK: 'MB', SEPAY_ACCOUNT: ACCOUNT, SEPAY_ACCOUNT_NAME: 'TAI KHOAN THU NGHIEM',
    SEPAY_VA: '', SEPAY_API_TOKEN: '', SEPAY_WEBHOOK_SECRET: HOOK_SECRET,
    SMTP_HOST: '127.0.0.1', SMTP_PORT: String(smtp.port), SMTP_USER: '', SMTP_PASS: '', SMTP_FROM: 'shop@example.test',
    ...env,
  };

  async function boot(extra = {}) {
    currentEnv = { ...baseEnv, ...extra };
    log = '';
    child = cp.spawn(process.execPath, ['server.js'], { cwd: ROOT, env: currentEnv });
    child.stdout.on('data', d => { log += d; });
    child.stderr.on('data', d => { log += d; });
    const up = await until(() => {
      if (child.exitCode !== null) throw new Error('Máy chủ thoát khi khởi động:\n' + log);
      return log.includes('chạy tại');
    }, 90000);
    if (!up) throw new Error('Máy chủ không lên:\n' + log);
  }
  async function halt() {
    if (!child || child.exitCode !== null) return;
    await new Promise(r => { child.once('exit', r); child.kill(); });
  }

  // Lần đầu để off: cần đổi mật khẩu mẫu thì mới bật được tiền thật
  await boot({ SEPAY_MODE: 'off' });
  const db = new Client({ ...conn, database: name });
  await db.connect();

  const bcrypt = require('bcryptjs');
  for (const [u, p] of [['admin', ADMIN_PASS], ['nhanvien', STAFF_PASS]]) {
    await db.query('UPDATE "Users" SET password=$1 WHERE username=$2', [bcrypt.hashSync(p, 10), u]);
  }
  await halt();
  await boot();

  const one = async (sql, params) => (await db.query(sql, params)).rows[0];
  const all = async (sql, params) => (await db.query(sql, params)).rows;

  function client() {
    const jar = new Map();
    const call = async (url, body, { origin = base, headers = {} } = {}) => {
      const h = { ...headers };
      if (jar.size) h.cookie = [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
      if (body !== undefined && origin) h.origin = origin;
      const payload = body && body.constructor === Object ? new URLSearchParams(body) : body;
      const r = await fetch(base + url, { method: body !== undefined ? 'POST' : 'GET', body: payload, headers: h, redirect: 'manual' });
      for (const c of r.headers.getSetCookie()) {
        const pair = c.split(';')[0], i = pair.indexOf('=');
        if (/Expires=Thu, 01 Jan 1970/i.test(c)) jar.delete(pair.slice(0, i));
        else jar.set(pair.slice(0, i), pair.slice(i + 1));
      }
      return { status: r.status, to: r.headers.get('location') || '', text: await r.text() };
    };
    call.jar = jar;
    return call;
  }

  async function login(username, password) {
    const c = client();
    const r = await c('/login', { username, password });
    if (r.to !== '/') throw new Error(`Đăng nhập ${username} thất bại -> ${r.to || r.status}`);
    return c;
  }

  let seq = 0;
  async function customer() {
    seq++;
    const username = `khach${seq}x${crypto.randomBytes(3).toString('hex')}`;
    const email = `${username}@example.test`, password = 'secret123';
    const c = client();
    await c('/register', { username, password, fullName: 'Khach thu', phone: '09123' + String(seq).padStart(5, '0'), email });
    const u = await one('SELECT id FROM "Users" WHERE username=$1', [username]);
    if (!u) throw new Error('Đăng ký khách thử thất bại');
    return { c, id: u.id, username, email, password };
  }

  // Mẫu riêng cho từng test để không đụng lịch của nhau
  async function product({ qty = 1, sizes = ['M'], name = 'Mau test' } = {}) {
    const p = await one(`INSERT INTO "Products" ("ProductName","ProductType","Unit","Price","DepositValue","LateFeePerDay","Color","Size","Quantity","Status","Description","CreateDate","UpdateDate")
      VALUES ($1,'Áo dài','bộ',100000,200000,50000,'Do',$2,$3,'Còn trống','Mau dung de test',now(),now()) RETURNING "ProductID"`, [name, sizes.join(', '), qty * sizes.length]);
    for (const s of sizes) await db.query(`INSERT INTO "ProductVariants" ("ProductID","Size","Color","Quantity") VALUES ($1,$2,'Do',$3)`, [p.ProductID, s, qty]);
    return p.ProductID;
  }

  async function book(c, productId, { start = 30, days = 3, qty = 1, size = 'M', method = 'COD', zone = 'pickup', name = 'Khach thu' } = {}) {
    for (const m of (await c('/cart')).text.matchAll(/action="\/cart\/([a-z0-9]+)\/remove"/g)) await c(`/cart/${m[1]}/remove`, {});
    await c('/cart/add', { ProductID: String(productId), Size: size, Color: 'Do', Quantity: String(qty) });
    const f = new FormData();
    const fields = {
      StartDate: day(start), EndDate: day(start + days - 1), DeliveryZone: zone, DeliveryAddress: 'So 2 duong thu nghiem, Ha Noi',
      CustomerName: name, CustomerPhone: '0912345678', CustomerIDCard: '001234567890',
      CustomerAddress: 'So 1 duong thu nghiem, Ha Noi', method, agree: '1',
    };
    for (const [k, v] of Object.entries(fields)) f.append(k, v);
    const r = await c('/rentals', f);
    return Number((r.to.match(/^\/rentals\/(\d+)\?new=1/) || [])[1]) || 0;
  }

  const rental = (id) => one('SELECT * FROM "Rentals" WHERE "RentalID"=$1', [id]);
  const due = (r) => Number(r.RentFee) - Number(r.Discount || 0) + Number(r.Deposit);
  const age = (id, minutes) => db.query(`UPDATE "Rentals" SET "createdAt" = now() - ($2 || ' minutes')::interval WHERE "RentalID"=$1`, [id, String(minutes)]);

  let txNo = 0;
  async function transfer(code, amount, { minutesAgo = 0, ref, account = ACCOUNT, secret = HOOK_SECRET } = {}) {
    txNo++;
    const when = new Date(Date.now() - minutesAgo * 60e3 + 7 * 36e5).toISOString().slice(0, 19).replace('T', ' ');
    const body = JSON.stringify({
      id: txNo, gateway: 'MBBank', transactionDate: when, accountNumber: account, subAccount: '', code,
      content: `${code} chuyen tien`, transferType: 'in', transferAmount: amount, referenceCode: ref || `FT${Date.now()}${txNo}`,
    });
    const ts = String(Math.floor(Date.now() / 1000));
    const sig = 'sha256=' + crypto.createHmac('sha256', secret).update(`${ts}.${body}`).digest('hex');
    const r = await fetch(`${base}/webhooks/sepay`, { method: 'POST', body, headers: { 'content-type': 'application/json', 'x-sepay-timestamp': ts, 'x-sepay-signature': sig } });
    await r.arrayBuffer();
    return r.status;
  }

  // Chạy 1 đoạn mã với đúng cấu hình của máy chủ (dùng để gọi việc nền ngay, không phải chờ)
  function exec(code, extra = {}) {
    return new Promise((resolve, reject) => cp.execFile(process.execPath, ['-e', code], { cwd: ROOT, env: { ...currentEnv, ...extra }, timeout: 60000 },
      (e, stdout, stderr) => (e ? reject(new Error(stderr || e.message)) : resolve(stdout))));
  }

  return {
    base, db, one, all, client, login, customer, product, book, rental, due, age, transfer, exec, smtp,
    admin: () => login('admin', ADMIN_PASS),
    staff: () => login('nhanvien', STAFF_PASS),
    log: () => log,
    async restart(extra) { await halt(); await boot(extra); },
    async stop() { await halt(); await db.end(); await smtp.close(); },
  };
}

module.exports = { start, day, sleep, until, ADMIN_PASS, STAFF_PASS };
